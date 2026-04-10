import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { bossesTable, characterTable, questLogTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { getOrCreateCharacter, invalidateCharacterCache } from "./character.js";
import { processLevelUp, totalXpEarned, XP_PER_LEVEL, RANK_BASE_REWARDS, getStreakStatMultiplier, getSystemDateFromReq } from "@workspace/shared";
import { strictLimiter } from "../lib/rate-limiters.js";
import { getActiveRngEvent } from "./rng.js";

const router: IRouter = Router();

router.get("/bosses", async (req, res) => {
  try {
    const char = await getOrCreateCharacter();
    const bosses = await db.select().from(bossesTable).orderBy(bossesTable.xpThreshold);
    const mapped = bosses.map((b) => {
      const rankRewards = RANK_BASE_REWARDS[b.rank] ?? { xp: 350, gold: 175 };
      return {
        ...b,
        xpReward: rankRewards.xp,
        goldReward: rankRewards.gold,
        xpPenalty: Math.floor(rankRewards.xp * 0.6),
        isUnlocked: totalXpEarned(char.xp, char.level) >= b.xpThreshold,
        defeatRecordedAt: b.defeatRecordedAt?.toISOString() ?? null,
        failureRecordedAt: b.failureRecordedAt?.toISOString() ?? null,
      };
    });
    res.json(mapped);
  } catch (err) {
    req.log.error({ err }, "Error listing bosses");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bosses/:id/challenge", strictLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid boss ID" });
    const [boss] = await db.select().from(bossesTable).where(eq(bossesTable.id, id));
    if (!boss) return res.status(404).json({ error: "Boss not found" });

    if (boss.isDefeated) {
      return res.status(400).json({
        success: false,
        victory: false,
        message: `${boss.name} has already been defeated. Seek a worthier challenge.`,
        xpChange: 0,
        goldChange: 0,
      });
    }

    const char = await getOrCreateCharacter();
    const totalXpEquiv = totalXpEarned(char.xp, char.level);

    if (totalXpEquiv < boss.xpThreshold) {
      return res.json({
        success: false,
        victory: false,
        message: `You are not ready. Reach ${boss.xpThreshold} XP threshold to unlock this boss.`,
        xpChange: 0,
        goldChange: 0,
        character: {
          ...char,
          xpToNextLevel: XP_PER_LEVEL(char.level),
          lastCheckin: char.lastCheckin?.toISOString() ?? null,
        },
      });
    }

    const rankRewards = RANK_BASE_REWARDS[boss.rank] ?? { xp: 350, gold: 175 };
    const baseXpReward = rankRewards.xp;
    const goldReward = rankRewards.gold;
    const xpPenalty = Math.floor(baseXpReward * 0.6);

    const winChance = Math.min(0.85, 0.4 + (char.streak * 0.02) + (char.level * 0.01));
    const victory = Math.random() < winChance;

    const charMultiplier = char.multiplier ?? 1.0;
    const today = getSystemDateFromReq(req);
    const activeEvent = getActiveRngEvent(today);
    const eventBonus = activeEvent ? activeEvent.multiplierBonus : 0;
    const totalMultiplier = charMultiplier * (1 + eventBonus);
    const xpReward = Math.floor(baseXpReward * totalMultiplier);
    const goldRewardFinal = Math.floor(goldReward * totalMultiplier);

    const ALL_STATS = ["strength", "intellect", "endurance", "agility", "discipline"] as const;
    type BossStat = typeof ALL_STATS[number];

    let statA: BossStat = "strength";
    let statB: BossStat = "discipline";
    let statGain = 0;

    if (victory) {
      const baseDifficultyGain = (() => {
        const r = boss.rank;
        if (r === "S" || r === "SS" || r === "SSS") return 3;
        if (r === "A" || r === "B") return 2;
        return 1;
      })();
      const streakMult = getStreakStatMultiplier(char.streak);
      statGain = Math.max(1, Math.floor(baseDifficultyGain * streakMult));
      const shuffled = [...ALL_STATS].sort(() => Math.random() - 0.5);
      statA = shuffled[0];
      statB = shuffled[1];
    }

    const statDelta = (s: BossStat): number =>
      (s === statA ? statGain : 0) + (s === statB ? statGain : 0);

    const [updatedChar, newLevel, leveledUp] = await db.transaction(async (tx) => {
      const bossUpdateWhere = victory
        ? and(eq(bossesTable.id, id), eq(bossesTable.isDefeated, false))
        : eq(bossesTable.id, id);

      const bossResult = await tx.update(bossesTable)
        .set(
          victory
            ? { isDefeated: true, defeatRecordedAt: new Date() }
            : { failureRecordedAt: new Date() }
        )
        .where(bossUpdateWhere)
        .returning({ id: bossesTable.id });

      if (victory && bossResult.length === 0) {
        throw Object.assign(new Error("Boss already defeated"), { code: "ALREADY_DEFEATED" });
      }

      const [lockedChar] = await tx
        .select({ xp: characterTable.xp, gold: characterTable.gold, level: characterTable.level })
        .from(characterTable)
        .where(eq(characterTable.id, char.id))
        .for("update");

      const { xp: newXp, level: txNewLevel } = victory
        ? processLevelUp(lockedChar.xp + xpReward, lockedChar.level)
        : { xp: Math.max(0, lockedChar.xp - xpPenalty), level: lockedChar.level };
      const newGold = victory ? lockedChar.gold + goldRewardFinal : lockedChar.gold;
      const txLeveledUp = txNewLevel > lockedChar.level;

      const [updated] = await tx.update(characterTable)
        .set(
          victory
            ? {
                xp: newXp,
                gold: newGold,
                level: txNewLevel,
                strength:   sql`${characterTable.strength}   + ${statDelta("strength")}`,
                intellect:  sql`${characterTable.intellect}  + ${statDelta("intellect")}`,
                endurance:  sql`${characterTable.endurance}  + ${statDelta("endurance")}`,
                agility:    sql`${characterTable.agility}    + ${statDelta("agility")}`,
                discipline: sql`${characterTable.discipline} + ${statDelta("discipline")}`,
              }
            : {
                xp: sql`GREATEST(0, ${characterTable.xp} - ${xpPenalty})`,
              }
        )
        .where(eq(characterTable.id, char.id))
        .returning();

      return [updated, txNewLevel, txLeveledUp] as const;
    });
    invalidateCharacterCache();

    await db.insert(questLogTable).values({
      questName: boss.name,
      category: "Boss",
      difficulty: boss.rank,
      outcome: victory ? "completed" : "failed",
      xpChange: victory ? xpReward : -xpPenalty,
      goldChange: victory ? goldRewardFinal : 0,
      multiplierApplied: victory ? totalMultiplier : 1.0,
      actionType: victory ? "BOSS_DEFEATED" : "FAILED",
      statCategory: null,
    });

    res.json({
      success: true,
      victory,
      message: victory
        ? `VICTORY! ${boss.name} has been defeated! +${xpReward} XP, +${goldRewardFinal} Gold!`
        : `DEFEAT. ${boss.name} proved too powerful. -${xpPenalty} XP. This loss is now part of your permanent record.`,
      xpChange: victory ? xpReward : -xpPenalty,
      goldChange: victory ? goldRewardFinal : 0,
      leveledUp,
      newLevel,
      character: {
        ...updatedChar,
        xpToNextLevel: XP_PER_LEVEL(updatedChar.level),
        lastCheckin: updatedChar.lastCheckin?.toISOString() ?? null,
      },
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ALREADY_DEFEATED") {
      return res.status(400).json({ success: false, victory: false, message: "Boss was already defeated.", xpChange: 0, goldChange: 0 });
    }
    req.log.error({ err }, "Error challenging boss");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
