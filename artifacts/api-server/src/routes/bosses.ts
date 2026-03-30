import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { bossesTable, characterTable, questLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getOrCreateCharacter, invalidateCharacterCache } from "./character.js";
import { processLevelUp, totalXpEarned, XP_PER_LEVEL } from "@workspace/shared";

const router: IRouter = Router();

router.get("/bosses", async (req, res) => {
  try {
    const char = await getOrCreateCharacter();
    const bosses = await db.select().from(bossesTable).orderBy(bossesTable.xpThreshold);
    const mapped = bosses.map((b) => ({
      ...b,
      isUnlocked: totalXpEarned(char.xp, char.level) >= b.xpThreshold,
      defeatRecordedAt: b.defeatRecordedAt?.toISOString() ?? null,
      failureRecordedAt: b.failureRecordedAt?.toISOString() ?? null,
    }));
    res.json(mapped);
  } catch (err) {
    req.log.error({ err }, "Error listing bosses");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bosses/:id/challenge", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [boss] = await db.select().from(bossesTable).where(eq(bossesTable.id, id));
    if (!boss) return res.status(404).json({ error: "Boss not found" });

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

    const winChance = Math.min(0.85, 0.4 + (char.streak * 0.02) + (char.level * 0.01));
    const victory = Math.random() < winChance;

    let newXp = char.xp;
    let newGold = char.gold;
    let newLevel = char.level;

    if (victory) {
      newXp += boss.xpReward;
      newGold += boss.goldReward;
      const result = processLevelUp(newXp, newLevel);
      newXp = result.xp;
      newLevel = result.level;
    } else {
      newXp = Math.max(0, char.xp - boss.xpPenalty);
    }

    const [updatedChar] = await db.update(characterTable)
      .set({ xp: newXp, gold: newGold, level: newLevel })
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
      xpChange: victory ? boss.xpReward : -boss.xpPenalty,
      goldChange: victory ? boss.goldReward : 0,
      multiplierApplied: 1.0,
      actionType: victory ? "BOSS_DEFEATED" : "FAILED",
      statCategory: null,
    });

    const leveledUp = newLevel > char.level;

    res.json({
      success: true,
      victory,
      message: victory
        ? `VICTORY! ${boss.name} has been defeated! +${boss.xpReward} XP, +${boss.goldReward} Gold!`
        : `DEFEAT. ${boss.name} proved too powerful. -${boss.xpPenalty} XP. This loss is now part of your permanent record.`,
      xpChange: victory ? boss.xpReward : -boss.xpPenalty,
      goldChange: victory ? boss.goldReward : 0,
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
