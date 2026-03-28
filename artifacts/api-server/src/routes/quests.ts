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

const DIFFICULTY_MULTIPLIERS: Record<string, { xp: number; gold: number }> = {
  F: { xp: 0.5, gold: 0.5 },
  E: { xp: 0.75, gold: 0.75 },
  D: { xp: 1.0, gold: 1.0 },
  C: { xp: 1.5, gold: 1.5 },
  B: { xp: 2.0, gold: 2.0 },
  A: { xp: 3.0, gold: 3.0 },
  S: { xp: 5.0, gold: 5.0 },
  SS: { xp: 8.0, gold: 8.0 },
  SSS: { xp: 15.0, gold: 15.0 },
};

function calculateRewards(difficulty: string, durationMinutes: number) {
  const mult = DIFFICULTY_MULTIPLIERS[difficulty] ?? { xp: 1, gold: 1 };
  const baseXp = Math.floor(20 + durationMinutes * 1.5);
  const baseGold = Math.floor(10 + durationMinutes * 0.75);
  return {
    xpReward: Math.floor(baseXp * mult.xp),
    goldReward: Math.floor(baseGold * mult.gold),
    xpPenalty: Math.floor(baseXp * mult.xp * 0.5),
    goldPenalty: Math.floor(baseGold * mult.gold * 0.3),
  };
}

const CATEGORY_STAT_GAINS: Record<string, string> = {
  Financial: "discipline",
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

    const statField = CATEGORY_STAT_GAINS[quest.category] ?? "strength";
    const statGain = quest.difficulty === "S" || quest.difficulty === "SS" || quest.difficulty === "SSS" ? 3 : quest.difficulty === "A" || quest.difficulty === "B" ? 2 : 1;

    const statUpdates: Record<string, number> = {
      strength: char.strength,
      intellect: char.intellect,
      endurance: char.endurance,
      agility: char.agility,
      discipline: char.discipline,
    };
    statUpdates[statField] = statUpdates[statField] + statGain;

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
    });

    await upsertActivity(today);

    const statGains = {
      strength: statField === "strength" ? statGain : 0,
      intellect: statField === "intellect" ? statGain : 0,
      endurance: statField === "endurance" ? statGain : 0,
      agility: statField === "agility" ? statGain : 0,
      discipline: statField === "discipline" ? statGain : 0,
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

    const statField = CATEGORY_STAT_GAINS[quest.category] ?? "strength";
    const baseStatPenalty = getDifficultyStatPenalty(quest.difficulty);
    const statPenalty = Math.floor(baseStatPenalty * attrMult);

    const statUpdates: Record<string, number> = {
      strength: char.strength,
      intellect: char.intellect,
      endurance: char.endurance,
      agility: char.agility,
      discipline: char.discipline,
    };
    statUpdates[statField] = Math.max(1, statUpdates[statField] - statPenalty);

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
    });

    const statPenalties = {
      strength: statField === "strength" ? statPenalty : 0,
      intellect: statField === "intellect" ? statPenalty : 0,
      endurance: statField === "endurance" ? statPenalty : 0,
      agility: statField === "agility" ? statPenalty : 0,
      discipline: statField === "discipline" ? statPenalty : 0,
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

        const statField = CATEGORY_STAT_GAINS[quest.category] ?? "strength";
        const baseStatPenalty = getDifficultyStatPenalty(quest.difficulty);
        const statPenalty = Math.floor(baseStatPenalty * attrMult);
        statAccum[statField] = Math.max(1, statAccum[statField] - statPenalty);

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

export default router;
