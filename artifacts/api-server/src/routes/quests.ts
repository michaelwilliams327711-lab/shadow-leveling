import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { questsTable, questLogTable, characterTable, penaltyLogTable } from "@workspace/db";
import { eq, and, isNotNull, lt } from "drizzle-orm";
import {
  CreateQuestBody,
  UpdateQuestBody,
  CompleteQuestResponse,
  FailQuestResponse,
} from "@workspace/api-zod";
import { getOrCreateCharacter, XP_PER_LEVEL, upsertActivity } from "./character.js";

const router: IRouter = Router();

const RANK_BASE_REWARDS: Record<string, { xp: number; gold: number }> = {
  F:   { xp: 10,  gold: 5   },
  E:   { xp: 25,  gold: 12  },
  D:   { xp: 50,  gold: 25  },
  C:   { xp: 100, gold: 50  },
  B:   { xp: 175, gold: 85  },
  A:   { xp: 275, gold: 135 },
  S:   { xp: 350, gold: 175 },
  SS:  { xp: 425, gold: 210 },
  SSS: { xp: 500, gold: 250 },
};

const DURATION_BONUS_PER_MINUTE = { xp: 0.3, gold: 0.15 };

function calculateRewards(difficulty: string, durationMinutes: number) {
  const base = RANK_BASE_REWARDS[difficulty] ?? { xp: 50, gold: 25 };
  const xpReward = Math.floor(base.xp + durationMinutes * DURATION_BONUS_PER_MINUTE.xp);
  const goldReward = Math.floor(base.gold + durationMinutes * DURATION_BONUS_PER_MINUTE.gold);
  return {
    xpReward,
    goldReward,
    xpPenalty: Math.floor(xpReward * 0.5),
    goldPenalty: Math.floor(goldReward * 0.3),
  };
}

const CATEGORY_STAT_GAINS: Record<string, string> = {
  Financial: "intellect",
  Productivity: "intellect",
  Study: "intellect",
  Health: "endurance",
  Creative: "agility",
  Social: "agility",
  Other: "strength",
};

function getAttributePenaltyMultiplier(failStreak: number): number {
  if (failStreak >= 10) return 3.0;
  if (failStreak >= 7) return 2.5;
  if (failStreak >= 4) return 2.0;
  if (failStreak >= 2) return 1.5;
  return 1.0;
}

function getXpGoldPenaltyMultiplier(failStreak: number): number {
  if (failStreak >= 10) return 2.0;
  if (failStreak >= 7) return 1.5;
  if (failStreak >= 4) return 1.25;
  if (failStreak >= 2) return 1.1;
  return 1.0;
}

function getDifficultyStatPenalty(difficulty: string): number {
  if (difficulty === "S" || difficulty === "SS" || difficulty === "SSS") return 3;
  if (difficulty === "A" || difficulty === "B") return 2;
  return 1;
}

function getStreakStatMultiplier(streak: number): number {
  if (streak >= 60) return 2.0;
  if (streak >= 30) return 1.5;
  if (streak >= 14) return 1.25;
  if (streak >= 7) return 1.1;
  return 1.0;
}

router.get("/quests", async (req, res) => {
  try {
    const quests = await db.select().from(questsTable).orderBy(questsTable.createdAt);
    const mapped = quests.map((q) => ({
      ...q,
      createdAt: q.createdAt.toISOString(),
      completedAt: q.completedAt?.toISOString() ?? null,
      deadline: q.deadline?.toISOString() ?? null,
    }));
    res.json(mapped);
  } catch (err) {
    req.log.error({ err }, "Error listing quests");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quests", async (req, res) => {
  try {
    const body = CreateQuestBody.parse(req.body);
    const rewards = calculateRewards(body.difficulty, body.durationMinutes);
    const [quest] = await db
      .insert(questsTable)
      .values({
        name: body.name,
        category: body.category,
        difficulty: body.difficulty,
        durationMinutes: body.durationMinutes,
        isDaily: body.isDaily,
        description: body.description ?? null,
        deadline: body.deadline ? new Date(body.deadline as string) : null,
        statBoost: body.statBoost ?? null,
        ...rewards,
        status: "active",
      })
      .returning();
    res.status(201).json({
      ...quest,
      createdAt: quest.createdAt.toISOString(),
      completedAt: quest.completedAt?.toISOString() ?? null,
      deadline: quest.deadline?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error creating quest");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/quests/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [quest] = await db.select().from(questsTable).where(eq(questsTable.id, id));
    if (!quest) return res.status(404).json({ error: "Quest not found" });
    res.json({ ...quest, createdAt: quest.createdAt.toISOString(), completedAt: quest.completedAt?.toISOString() ?? null, deadline: quest.deadline?.toISOString() ?? null });
  } catch (err) {
    req.log.error({ err }, "Error getting quest");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/quests/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = UpdateQuestBody.parse(req.body);
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.category !== undefined) updates.category = body.category;
    if (body.difficulty !== undefined || body.durationMinutes !== undefined) {
      const [existing] = await db.select().from(questsTable).where(eq(questsTable.id, id));
      if (!existing) return res.status(404).json({ error: "Quest not found" });
      const diff = body.difficulty ?? existing.difficulty;
      const dur = body.durationMinutes ?? existing.durationMinutes;
      const rewards = calculateRewards(diff, dur);
      Object.assign(updates, rewards);
      if (body.difficulty !== undefined) updates.difficulty = body.difficulty;
      if (body.durationMinutes !== undefined) updates.durationMinutes = body.durationMinutes;
    }
    if (body.isDaily !== undefined) updates.isDaily = body.isDaily;
    if (body.description !== undefined) updates.description = body.description;
    if (body.statBoost !== undefined) updates.statBoost = body.statBoost ?? null;

    const [updated] = await db.update(questsTable).set(updates).where(eq(questsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Quest not found" });
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), completedAt: updated.completedAt?.toISOString() ?? null, deadline: updated.deadline?.toISOString() ?? null });
  } catch (err) {
    req.log.error({ err }, "Error updating quest");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/quests/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(questsTable).where(eq(questsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting quest");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quests/:id/complete", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [quest] = await db.select().from(questsTable).where(eq(questsTable.id, id));
    if (!quest) return res.status(404).json({ error: "Quest not found" });

    const char = await getOrCreateCharacter();
    const today = new Date().toISOString().split("T")[0];

    const rngRoll = Math.random();
    const rngBonus = rngRoll < 0.1;
    const rngMultiplier = rngBonus ? 1.5 : 1.0;
    const totalMultiplier = char.multiplier * rngMultiplier;

    const xpAwarded = Math.floor(quest.xpReward * totalMultiplier);
    const goldAwarded = Math.floor(quest.goldReward * totalMultiplier);

    const statField = quest.statBoost ?? CATEGORY_STAT_GAINS[quest.category] ?? "strength";
    const baseDifficultyGain = quest.difficulty === "S" || quest.difficulty === "SS" || quest.difficulty === "SSS" ? 3 : quest.difficulty === "A" || quest.difficulty === "B" ? 2 : 1;
    const streakMult = getStreakStatMultiplier(char.streak);
    const statGain = Math.max(1, Math.floor(baseDifficultyGain * streakMult));
    const disciplineGain = statGain;

    const statUpdates: Record<string, number> = {
      strength: char.strength,
      intellect: char.intellect,
      endurance: char.endurance,
      agility: char.agility,
      discipline: char.discipline,
    };
    statUpdates[statField] = statUpdates[statField] + statGain;
    statUpdates.discipline = statUpdates.discipline + disciplineGain;

    let newXp = char.xp + xpAwarded;
    let newLevel = char.level;
    while (newXp >= XP_PER_LEVEL(newLevel)) {
      newXp -= XP_PER_LEVEL(newLevel);
      newLevel++;
    }

    const leveledUp = newLevel > char.level;

    const [updatedChar] = await db.update(characterTable)
      .set({
        xp: newXp,
        level: newLevel,
        gold: char.gold + goldAwarded,
        strength: statUpdates.strength,
        intellect: statUpdates.intellect,
        endurance: statUpdates.endurance,
        agility: statUpdates.agility,
        discipline: statUpdates.discipline,
        totalQuestsCompleted: char.totalQuestsCompleted + 1,
        failStreak: 0,
        penaltyMultiplier: 1.0,
      })
      .where(eq(characterTable.id, char.id))
      .returning();

    await db.update(questsTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(questsTable.id, id));

    await db.insert(questLogTable).values({
      questName: quest.name,
      category: quest.category,
      difficulty: quest.difficulty,
      outcome: "completed",
      xpChange: xpAwarded,
      goldChange: goldAwarded,
      multiplierApplied: totalMultiplier,
      actionType: "COMPLETED",
      statCategory: quest.statBoost ?? CATEGORY_STAT_GAINS[quest.category] ?? "strength",
    });

    await upsertActivity(today);

    const statGains = {
      strength: statField === "strength" ? statGain : 0,
      intellect: statField === "intellect" ? statGain : 0,
      endurance: statField === "endurance" ? statGain : 0,
      agility: statField === "agility" ? statGain : 0,
      discipline: (statField === "discipline" ? statGain : 0) + disciplineGain,
    };

    const data = CompleteQuestResponse.parse({
      success: true,
      xpAwarded,
      goldAwarded,
      multiplierApplied: totalMultiplier,
      rngBonus,
      newLevel,
      leveledUp,
      statGains,
      character: {
        ...updatedChar,
        xpToNextLevel: XP_PER_LEVEL(updatedChar.level),
        lastCheckin: updatedChar.lastCheckin?.toISOString() ?? null,
      },
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Error completing quest");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quests/:id/fail", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [quest] = await db.select().from(questsTable).where(eq(questsTable.id, id));
    if (!quest) return res.status(404).json({ error: "Quest not found" });

    const char = await getOrCreateCharacter();

    const newFailStreak = char.failStreak + 1;
    const xpGoldMult = getXpGoldPenaltyMultiplier(newFailStreak);
    const attrMult = getAttributePenaltyMultiplier(newFailStreak);

    const xpDeducted = Math.min(char.xp, Math.floor(quest.xpPenalty * xpGoldMult));
    const goldDeducted = Math.min(char.gold, Math.floor(quest.goldPenalty * xpGoldMult));

    const statField = quest.statBoost ?? CATEGORY_STAT_GAINS[quest.category] ?? "strength";
    const baseStatPenalty = getDifficultyStatPenalty(quest.difficulty);
    const catStatPenalty = Math.floor(baseStatPenalty * attrMult);
    const discPenalty = Math.floor(baseStatPenalty * xpGoldMult);

    const statUpdates: Record<string, number> = {
      strength: char.strength,
      intellect: char.intellect,
      endurance: char.endurance,
      agility: char.agility,
      discipline: char.discipline,
    };
    statUpdates[statField] = Math.max(1, statUpdates[statField] - catStatPenalty);
    statUpdates.discipline = Math.max(1, statUpdates.discipline - discPenalty);

    const [updatedChar] = await db.update(characterTable)
      .set({
        xp: Math.max(0, char.xp - xpDeducted),
        gold: Math.max(0, char.gold - goldDeducted),
        strength: statUpdates.strength,
        intellect: statUpdates.intellect,
        endurance: statUpdates.endurance,
        agility: statUpdates.agility,
        discipline: statUpdates.discipline,
        totalQuestsFailed: char.totalQuestsFailed + 1,
        failStreak: newFailStreak,
        penaltyMultiplier: xpGoldMult,
      })
      .where(eq(characterTable.id, char.id))
      .returning();

    await db.update(questsTable)
      .set({ status: "failed" })
      .where(eq(questsTable.id, id));

    await db.insert(questLogTable).values({
      questName: quest.name,
      category: quest.category,
      difficulty: quest.difficulty,
      outcome: "failed",
      xpChange: -xpDeducted,
      goldChange: -goldDeducted,
      multiplierApplied: xpGoldMult,
      actionType: "FAILED",
      statCategory: quest.statBoost ?? CATEGORY_STAT_GAINS[quest.category] ?? "strength",
    });

    const statPenalties = {
      strength: statField === "strength" ? catStatPenalty : 0,
      intellect: statField === "intellect" ? catStatPenalty : 0,
      endurance: statField === "endurance" ? catStatPenalty : 0,
      agility: statField === "agility" ? catStatPenalty : 0,
      discipline: (statField === "discipline" ? catStatPenalty : 0) + discPenalty,
    };

    const data = FailQuestResponse.parse({
      success: true,
      xpDeducted,
      goldDeducted,
      statPenalties,
      character: {
        ...updatedChar,
        xpToNextLevel: XP_PER_LEVEL(updatedChar.level),
        lastCheckin: updatedChar.lastCheckin?.toISOString() ?? null,
      },
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Error failing quest");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quests/process-overdue", async (req, res) => {
  try {
    const now = new Date();
    const overdueQuests = await db
      .select()
      .from(questsTable)
      .where(
        and(
          eq(questsTable.status, "active"),
          isNotNull(questsTable.deadline),
          lt(questsTable.deadline, now)
        )
      );

    if (overdueQuests.length === 0) {
      const char = await getOrCreateCharacter();
      return res.json({
        penalties: [],
        autoFailedQuests: [],
        character: {
          ...char,
          xpToNextLevel: XP_PER_LEVEL(char.level),
          lastCheckin: char.lastCheckin?.toISOString() ?? null,
        },
      });
    }

    const char = await getOrCreateCharacter();

    const penalties: Array<{
      type: string;
      description: string;
      xpDeducted: number;
      goldDeducted: number;
      occurredAt: string;
    }> = [];
    const failedQuestsSerialized: object[] = [];

    const updatedChar = await db.transaction(async (tx) => {
      let totalXpDeducted = 0;
      let totalGoldDeducted = 0;
      let runningFailStreak = char.failStreak;
      const statAccum: Record<string, number> = {
        strength: char.strength,
        intellect: char.intellect,
        endurance: char.endurance,
        agility: char.agility,
        discipline: char.discipline,
      };

      for (const quest of overdueQuests) {
        runningFailStreak += 1;
        const xpGoldMult = getXpGoldPenaltyMultiplier(runningFailStreak);
        const attrMult = getAttributePenaltyMultiplier(runningFailStreak);

        const xpDeducted = Math.min(
          Math.max(0, char.xp - totalXpDeducted),
          Math.floor(quest.xpPenalty * xpGoldMult)
        );
        const goldDeducted = Math.min(
          Math.max(0, char.gold - totalGoldDeducted),
          Math.floor(quest.goldPenalty * xpGoldMult)
        );
        totalXpDeducted += xpDeducted;
        totalGoldDeducted += goldDeducted;

        const statField = quest.statBoost ?? CATEGORY_STAT_GAINS[quest.category] ?? "strength";
        const baseStatPenalty = getDifficultyStatPenalty(quest.difficulty);
        const catStatPenalty = Math.floor(baseStatPenalty * attrMult);
        const discPenalty = Math.floor(baseStatPenalty * xpGoldMult);
        statAccum[statField] = Math.max(1, statAccum[statField] - catStatPenalty);
        statAccum.discipline = Math.max(1, statAccum.discipline - discPenalty);

        await tx
          .update(questsTable)
          .set({ status: "failed" })
          .where(eq(questsTable.id, quest.id));

        await tx.insert(questLogTable).values({
          questName: quest.name,
          category: quest.category,
          difficulty: quest.difficulty,
          outcome: "failed",
          xpChange: -xpDeducted,
          goldChange: -goldDeducted,
          multiplierApplied: xpGoldMult,
          actionType: "MISSED_DAY",
          statCategory: quest.statBoost ?? CATEGORY_STAT_GAINS[quest.category] ?? "strength",
        });

        const penaltyDesc = `Quest deadline missed: "${quest.name}" (Rank ${quest.difficulty})`;

        const [penaltyLog] = await tx.insert(penaltyLogTable).values({
          type: "quest_overdue",
          description: penaltyDesc,
          xpDeducted,
          goldDeducted,
        }).returning();

        penalties.push({
          type: "quest_overdue",
          description: penaltyDesc,
          xpDeducted,
          goldDeducted,
          occurredAt: penaltyLog.occurredAt.toISOString(),
        });

        failedQuestsSerialized.push({
          ...quest,
          status: "failed",
          createdAt: quest.createdAt.toISOString(),
          completedAt: quest.completedAt?.toISOString() ?? null,
          deadline: quest.deadline?.toISOString() ?? null,
        });
      }

      const finalXpGoldMult = getXpGoldPenaltyMultiplier(runningFailStreak);

      const [updated] = await tx
        .update(characterTable)
        .set({
          xp: Math.max(0, char.xp - totalXpDeducted),
          gold: Math.max(0, char.gold - totalGoldDeducted),
          strength: statAccum.strength,
          intellect: statAccum.intellect,
          endurance: statAccum.endurance,
          agility: statAccum.agility,
          discipline: statAccum.discipline,
          totalQuestsFailed: char.totalQuestsFailed + overdueQuests.length,
          failStreak: runningFailStreak,
          penaltyMultiplier: finalXpGoldMult,
        })
        .where(eq(characterTable.id, char.id))
        .returning();

      return updated;
    });

    res.json({
      penalties,
      autoFailedQuests: failedQuestsSerialized,
      character: {
        ...updatedChar,
        xpToNextLevel: XP_PER_LEVEL(updatedChar.level),
        lastCheckin: updatedChar.lastCheckin?.toISOString() ?? null,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error processing overdue quests");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/quest-log", async (req, res) => {
  try {
    const log = await db.select().from(questLogTable).orderBy(questLogTable.occurredAt);
    const mapped = log.map((e) => ({
      ...e,
      occurredAt: e.occurredAt.toISOString(),
    })).reverse();
    res.json(mapped);
  } catch (err) {
    req.log.error({ err }, "Error getting quest log");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quests/recalculate-rewards", async (req, res) => {
  try {
    const activeQuests = await db
      .select()
      .from(questsTable)
      .where(eq(questsTable.status, "active"));

    let updatedCount = 0;
    for (const quest of activeQuests) {
      const rewards = calculateRewards(quest.difficulty, quest.durationMinutes);
      await db
        .update(questsTable)
        .set(rewards)
        .where(eq(questsTable.id, quest.id));
      updatedCount++;
    }

    res.json({ success: true, updatedCount });
  } catch (err) {
    req.log.error({ err }, "Error recalculating quest rewards");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
