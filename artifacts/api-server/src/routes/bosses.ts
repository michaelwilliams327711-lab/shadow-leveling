import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { bossesTable, characterTable, questLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getOrCreateCharacter, invalidateCharacterCache } from "./character.js";
import { processLevelUp, totalXpEarned, XP_PER_LEVEL, RANK_BASE_REWARDS, getStreakStatMultiplier } from "@workspace/shared";
import { strictLimiter } from "../lib/rate-limiters.js";

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

    let newXp = char.xp;
    let newGold = char.gold;
    let newLevel = char.level;
    let newStrength = char.strength;
    let newIntellect = char.intellect;
    let newEndurance = char.endurance;
    let newAgility = char.agility;
    let newDiscipline = char.discipline;

    const charMultiplier = char.multiplier ?? 1.0;
    const xpReward = Math.floor(baseXpReward * charMultiplier);

    if (victory) {
      newXp += xpReward;
      newGold += goldReward;
      const result = processLevelUp(newXp, newLevel);
      newXp = result.xp;
      newLevel = result.level;

      const baseDifficultyGain = (() => {
        const r = boss.rank;
        if (r === "S" || r === "SS" || r === "SSS") return 3;
        if (r === "A" || r === "B") return 2;
        return 1;
      })();
      const streakMult = getStreakStatMultiplier(char.streak);
      const statGain = Math.max(1, Math.floor(baseDifficultyGain * streakMult));

      // Fix #4: Distribute stat gains across all five stats rather than always
      // boosting Strength + Discipline. Pick two distinct stats randomly from the full pool.
      const ALL_STATS = ["strength", "intellect", "endurance", "agility", "discipline"] as const;
      type BossStat = typeof ALL_STATS[number];
      const statVars: Record<BossStat, number> = { strength: newStrength, intellect: newIntellect, endurance: newEndurance, agility: newAgility, discipline: newDiscipline };
      const shuffled = [...ALL_STATS].sort(() => Math.random() - 0.5);
      const [statA, statB] = shuffled;
      statVars[statA] += statGain;
      statVars[statB] += statGain;
      newStrength = statVars.strength;
      newIntellect = statVars.intellect;
      newEndurance = statVars.endurance;
      newAgility = statVars.agility;
      newDiscipline = statVars.discipline;
    } else {
      newXp = Math.max(0, char.xp - xpPenalty);
    }

    const [updatedChar] = await db.update(characterTable)
      .set({ xp: newXp, gold: newGold, level: newLevel, strength: newStrength, intellect: newIntellect, endurance: newEndurance, agility: newAgility, discipline: newDiscipline })
      .where(eq(characterTable.id, char.id))
      .returning();
    invalidateCharacterCache();

    await db.update(bossesTable)
      .set(
        victory
          ? { isDefeated: true, defeatRecordedAt: new Date() }
          : { failureRecordedAt: new Date() }
      )
      .where(eq(bossesTable.id, id));

    await db.insert(questLogTable).values({
      questName: boss.name,
      category: "Boss",
      difficulty: boss.rank,
      outcome: victory ? "completed" : "failed",
      xpChange: victory ? xpReward : -xpPenalty,
      goldChange: victory ? goldReward : 0,
      multiplierApplied: victory ? charMultiplier : 1.0,
      actionType: victory ? "BOSS_DEFEATED" : "FAILED",
      statCategory: null,
    });

    const leveledUp = newLevel > char.level;

    res.json({
      success: true,
      victory,
      message: victory
        ? `VICTORY! ${boss.name} has been defeated! +${xpReward} XP, +${goldReward} Gold!`
        : `DEFEAT. ${boss.name} proved too powerful. -${xpPenalty} XP. This loss is now part of your permanent record.`,
      xpChange: victory ? xpReward : -xpPenalty,
      goldChange: victory ? goldReward : 0,
      leveledUp,
      newLevel,
      character: {
        ...updatedChar,
        xpToNextLevel: XP_PER_LEVEL(updatedChar.level),
        lastCheckin: updatedChar.lastCheckin?.toISOString() ?? null,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error challenging boss");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
