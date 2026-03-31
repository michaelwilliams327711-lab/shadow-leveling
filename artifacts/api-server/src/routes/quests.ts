import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { questsTable, questLogTable, characterTable, penaltyLogTable, questDailyLogTable } from "@workspace/db";
import { eq, and, isNotNull, lt, lte, or, gte } from "drizzle-orm";
import { CATEGORY_STAT_MAP, processLevelUp, getStreakStatMultiplier, RANK_BASE_REWARDS, DURATION_BONUS_PER_MINUTE, XP_PENALTY_RATIO, GOLD_PENALTY_RATIO, XP_PER_LEVEL, getSystemDate, getSystemDateFromReq } from "@workspace/shared";
import {
  CreateQuestBody,
  UpdateQuestBody,
  CompleteQuestResponse,
  FailQuestResponse,
  UpsertQuestDailyLogBody,
} from "@workspace/api-zod";
import { getOrCreateCharacter, upsertActivity, invalidateCharacterCache } from "./character.js";
import { awardVocXp } from "./vocations.js";

const router: IRouter = Router();

function calculateRewards(difficulty: string, durationMinutes: number) {
  const base = RANK_BASE_REWARDS[difficulty] ?? { xp: 50, gold: 25 };
  const xpReward = Math.floor(base.xp + durationMinutes * DURATION_BONUS_PER_MINUTE.xp);
  const goldReward = Math.floor(base.gold + durationMinutes * DURATION_BONUS_PER_MINUTE.gold);
  return {
    xpReward,
    goldReward,
    xpPenalty: Math.floor(xpReward * XP_PENALTY_RATIO),
    goldPenalty: Math.floor(goldReward * GOLD_PENALTY_RATIO),
  };
}


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

function serializeQuest(q: typeof questsTable.$inferSelect) {
  return {
    ...q,
    createdAt: q.createdAt.toISOString(),
    completedAt: q.completedAt?.toISOString() ?? null,
    deadline: q.deadline?.toISOString() ?? null,
  };
}

type RecurrenceConfig = {
  type: "none" | "daily" | "weekly" | "monthly" | "yearly";
  intervalDays?: number | null;
  daysOfWeek?: number[] | null;
  dayOfMonth?: number | null;
  month?: number | null;
  day?: number | null;
};

function getNextOccurrenceDate(recurrence: RecurrenceConfig, fromDate: Date): Date | null {
  const next = new Date(fromDate);
  next.setHours(0, 0, 0, 0);

  switch (recurrence.type) {
    case "daily": {
      const interval = recurrence.intervalDays ?? 1;
      next.setDate(next.getDate() + interval);
      return next;
    }
    case "weekly": {
      const days = recurrence.daysOfWeek ?? [];
      if (days.length === 0) {
        next.setDate(next.getDate() + 7);
        return next;
      }
      const currentDay = next.getDay();
      const futureDays = days.filter(d => d > currentDay);
      if (futureDays.length > 0) {
        next.setDate(next.getDate() + (futureDays[0] - currentDay));
      } else {
        const minDay = Math.min(...days);
        next.setDate(next.getDate() + (7 - currentDay + minDay));
      }
      return next;
    }
    case "monthly": {
      const dom = recurrence.dayOfMonth ?? 1;
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(dom, lastDay));
      return next;
    }
    case "yearly": {
      const month = recurrence.month ?? 1;
      const day = recurrence.day ?? 1;
      next.setDate(1);
      next.setFullYear(next.getFullYear() + 1);
      next.setMonth(month - 1);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, lastDay));
      return next;
    }
    default:
      return null;
  }
}

function isRecurringQuestDueToday(recurrence: RecurrenceConfig, completedAt: Date | null, createdAt: Date, localDate?: string): boolean {
  const todayStr = getSystemDate(localDate);
  const today = new Date(todayStr + "T00:00:00.000Z");

  if (recurrence.type === "none") return false;

  const baseDate = completedAt ?? createdAt;
  const next = getNextOccurrenceDate(recurrence, baseDate);
  if (!next) return false;

  return next <= today;
}

export interface PenaltyDetail {
  type: string;
  description: string;
  xpDeducted: number;
  goldDeducted: number;
  occurredAt: string;
}

export interface ProcessOverdueResult {
  recurringReset: number;
  penaltiesApplied: number;
  penalties: PenaltyDetail[];
  autoFailedQuests: object[];
  updatedChar: typeof characterTable.$inferSelect;
}

export async function processOverdueQuestsLogic(localDate?: string): Promise<ProcessOverdueResult> {
  const todayStr = getSystemDate(localDate);
  const now = new Date(todayStr + "T00:00:00.000Z");

  const cutoffDate = new Date(now);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 90);

  const allActiveQuests = await db
    .select()
    .from(questsTable)
    .where(and(eq(questsTable.status, "active"), gte(questsTable.updatedAt, cutoffDate)));

  const allCompletedQuests = await db
    .select()
    .from(questsTable)
    .where(and(eq(questsTable.status, "completed"), gte(questsTable.updatedAt, cutoffDate)));

  const recurringToReset = allCompletedQuests.filter(q => {
    if (q.isPaused) return false;
    const recurrence = q.recurrence as RecurrenceConfig | null;
    if (!recurrence || recurrence.type === "none") return false;
    return isRecurringQuestDueToday(recurrence, q.completedAt, q.createdAt, localDate);
  });

  for (const quest of recurringToReset) {
    await db.update(questsTable)
      .set({ status: "active", completedAt: null })
      .where(eq(questsTable.id, quest.id));
  }

  const overdueQuests = allActiveQuests.filter(q => {
    if (q.isPaused) return false;
    const recurrence = q.recurrence as RecurrenceConfig | null;
    if (recurrence && recurrence.type !== "none") return false;
    if (q.deadline && new Date(q.deadline) < now) {
      return true;
    }
    return false;
  });

  const char = await getOrCreateCharacter();

  if (overdueQuests.length === 0) {
    return {
      recurringReset: recurringToReset.length,
      penaltiesApplied: 0,
      penalties: [],
      autoFailedQuests: [],
      updatedChar: char,
    };
  }

  const penalties: PenaltyDetail[] = [];
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

      const { xpPenalty, goldPenalty } = calculateRewards(quest.difficulty, quest.durationMinutes);

      const xpDeducted = Math.min(
        Math.max(0, char.xp - totalXpDeducted),
        Math.floor(xpPenalty * xpGoldMult)
      );
      const goldDeducted = Math.min(
        Math.max(0, char.gold - totalGoldDeducted),
        Math.floor(goldPenalty * xpGoldMult)
      );
      totalXpDeducted += xpDeducted;
      totalGoldDeducted += goldDeducted;

      const statField = quest.statBoost ?? CATEGORY_STAT_MAP[quest.category] ?? "strength";
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
        statCategory: quest.statBoost ?? CATEGORY_STAT_MAP[quest.category] ?? "strength",
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

      failedQuestsSerialized.push(serializeQuest({ ...quest, status: "failed" }));
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

  invalidateCharacterCache();

  return {
    recurringReset: recurringToReset.length,
    penaltiesApplied: overdueQuests.length,
    penalties,
    autoFailedQuests: failedQuestsSerialized,
    updatedChar,
  };
}

router.post("/quests/process-overdue", async (req, res) => {
  try {
    const localDate = getSystemDateFromReq(req);
    const result = await processOverdueQuestsLogic(localDate);

    res.json({
      penalties: result.penalties,
      autoFailedQuests: result.autoFailedQuests,
      character: {
        ...result.updatedChar,
        xpToNextLevel: XP_PER_LEVEL(result.updatedChar.level),
        lastCheckin: result.updatedChar.lastCheckin?.toISOString() ?? null,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error processing overdue quests");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quests/recalculate-rewards", async (req, res) => {
  res.json({ success: true, updatedCount: 0, message: "Reward columns removed; rewards are now derived dynamically at runtime." });
});

/**
 * Advance a recurring quest's next-due date until it is >= today.
 * This ensures we find the actual upcoming occurrence, not just one step
 * ahead of (possibly stale) completedAt/createdAt.
 */
function getNextDueFromNow(recurrence: RecurrenceConfig, baseDate: Date, localDate?: string): Date | null {
  const todayStr = getSystemDate(localDate);
  const today = new Date(todayStr + "T00:00:00.000Z");

  let candidate: Date | null;

  if (recurrence.type === "daily") {
    const intervalDays = recurrence.intervalDays ?? 1;
    if (intervalDays >= 1) {
      const baseMs = Date.UTC(
        baseDate.getUTCFullYear(),
        baseDate.getUTCMonth(),
        baseDate.getUTCDate()
      );
      const firstNextMs = baseMs + intervalDays * 86_400_000;
      const todayMs = today.getTime();

      if (firstNextMs >= todayMs) {
        return new Date(firstNextMs);
      }

      const diffDays = Math.floor((todayMs - firstNextMs) / 86_400_000);
      const stepsNeeded = Math.ceil(diffDays / intervalDays);
      candidate = new Date(firstNextMs + stepsNeeded * intervalDays * 86_400_000);
    } else {
      candidate = getNextOccurrenceDate(recurrence, baseDate);
    }
  } else {
    candidate = getNextOccurrenceDate(recurrence, baseDate);
  }

  if (!candidate) return null;

  const MAX_ITERATIONS = 10_000;
  let iterations = 0;
  while (candidate < today) {
    if (iterations >= MAX_ITERATIONS) {
      console.warn(`[getNextDueFromNow] Hit MAX_ITERATIONS cap (${MAX_ITERATIONS}). Computing next occurrence from today.`);
      const recovered = getNextOccurrenceDate(recurrence, today);
      return recovered;
    }
    candidate = getNextOccurrenceDate(recurrence, candidate);
    if (!candidate) return null;
    iterations++;
  }

  return candidate;
}

router.get("/quests", async (req, res) => {
  try {
    const localDate = getSystemDateFromReq(req);
    const windowDaysParam = req.query.windowDays;
    const windowDays = windowDaysParam ? parseInt(String(windowDaysParam), 10) : null;

    if (windowDays != null && !isNaN(windowDays) && windowDays > 0) {
      const now = new Date(localDate + "T00:00:00.000Z");
      const windowEnd = new Date(now);
      windowEnd.setUTCDate(windowEnd.getUTCDate() + windowDays);

      const [nonActive, activeWithDeadline, activeNullDeadline] = await Promise.all([
        db
          .select()
          .from(questsTable)
          .where(
            or(
              eq(questsTable.status, "completed"),
              eq(questsTable.status, "failed"),
            ),
          )
          .orderBy(questsTable.createdAt),
        db
          .select()
          .from(questsTable)
          .where(
            and(
              eq(questsTable.status, "active"),
              isNotNull(questsTable.deadline),
              lte(questsTable.deadline, windowEnd),
            ),
          )
          .orderBy(questsTable.createdAt),
        db
          .select()
          .from(questsTable)
          .where(
            and(
              eq(questsTable.status, "active"),
              isNotNull(questsTable.recurrence),
            ),
          )
          .orderBy(questsTable.createdAt),
      ]);

      const seen = new Set<number>();
      const merged: (typeof questsTable.$inferSelect)[] = [];
      for (const q of [...nonActive, ...activeWithDeadline, ...activeNullDeadline]) {
        if (!seen.has(q.id)) {
          seen.add(q.id);
          merged.push(q);
        }
      }

      const filtered = merged.filter((q) => {
        if (q.status !== "active") return true;

        const recurrence = q.recurrence as RecurrenceConfig | null;

        if (recurrence && recurrence.type !== "none") {
          const nextDue = getNextDueFromNow(recurrence, q.completedAt ?? q.createdAt, localDate);
          if (!nextDue) return false;
          return nextDue <= windowEnd;
        }

        if (q.deadline) return true;

        return false;
      });

      return res.json(filtered.map(serializeQuest));
    }

    const limitParam = req.query.limit;
    const offsetParam = req.query.offset;
    const limit = limitParam ? Math.max(1, parseInt(String(limitParam), 10)) : 365;
    const offset = offsetParam ? Math.max(0, parseInt(String(offsetParam), 10)) : 0;

    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 365);
    windowStart.setHours(0, 0, 0, 0);

    const allQuests = await db
      .select()
      .from(questsTable)
      .where(gte(questsTable.createdAt, windowStart))
      .orderBy(questsTable.createdAt)
      .limit(limit)
      .offset(offset);
    res.json(allQuests.map(serializeQuest));
  } catch (err) {
    req.log.error({ err }, "Error listing quests");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quests", async (req, res) => {
  try {
    const body = CreateQuestBody.parse(req.body);
    const vocationId = typeof req.body.vocationId === "string" ? req.body.vocationId : null;
    const [quest] = await db
      .insert(questsTable)
      .values({
        name: body.name,
        category: body.category,
        difficulty: body.difficulty,
        durationMinutes: body.durationMinutes,
        description: body.description ?? null,
        deadline: body.deadline ? new Date(body.deadline as string) : null,
        statBoost: body.statBoost ?? null,
        targetAmount: body.targetAmount ?? null,
        amountUnit: body.amountUnit ?? null,
        recurrence: (body.recurrence as RecurrenceConfig) ?? null,
        isPaused: false,
        vocationId: vocationId ?? null,
        status: "active",
      })
      .returning();
    res.status(201).json(serializeQuest(quest));
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
    res.json(serializeQuest(quest));
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
    if (body.difficulty !== undefined) updates.difficulty = body.difficulty;
    if (body.durationMinutes !== undefined) updates.durationMinutes = body.durationMinutes;
    if (body.isPaused !== undefined) updates.isPaused = body.isPaused;
    if (body.description !== undefined) updates.description = body.description;
    if (body.statBoost !== undefined) updates.statBoost = body.statBoost ?? null;
    if (body.targetAmount !== undefined) updates.targetAmount = body.targetAmount ?? null;
    if (body.amountUnit !== undefined) updates.amountUnit = body.amountUnit ?? null;
    if (body.recurrence !== undefined) {
      updates.recurrence = body.recurrence ?? null;
    }
    if ("vocationId" in req.body) {
      updates.vocationId = typeof req.body.vocationId === "string" ? req.body.vocationId : null;
    }

    const [updated] = await db.update(questsTable).set(updates).where(eq(questsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Quest not found" });
    res.json(serializeQuest(updated));
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

router.get("/quests/:id/log", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const logs = await db
      .select()
      .from(questDailyLogTable)
      .where(eq(questDailyLogTable.questId, id))
      .orderBy(questDailyLogTable.date);
    res.json(logs);
  } catch (err) {
    req.log.error({ err }, "Error getting quest daily logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

router.put("/quests/:id/log/:date", async (req, res) => {
  try {
    const questId = parseInt(req.params.id);
    const date = req.params.date;

    if (!DATE_REGEX.test(date)) {
      return res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
    }

    const body = UpsertQuestDailyLogBody.parse(req.body);
    const { currentAmount } = body;

    const [quest] = await db.select().from(questsTable).where(eq(questsTable.id, questId));
    if (!quest) return res.status(404).json({ error: "Quest not found" });

    const isCompleted = quest.targetAmount != null
      ? currentAmount >= quest.targetAmount
      : false;

    const [log] = await db
      .insert(questDailyLogTable)
      .values({ questId, date, currentAmount, isCompleted })
      .onConflictDoUpdate({
        target: [questDailyLogTable.questId, questDailyLogTable.date],
        set: { currentAmount, isCompleted },
      })
      .returning();

    res.json(log);
  } catch (err) {
    req.log.error({ err }, "Error upserting quest daily log");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quests/:id/complete", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [quest] = await db.select().from(questsTable).where(eq(questsTable.id, id));
    if (!quest) return res.status(404).json({ error: "Quest not found" });

    const char = await getOrCreateCharacter();
    const today = getSystemDateFromReq(req);

    const { xpReward, goldReward } = calculateRewards(quest.difficulty, quest.durationMinutes);

    const rngRoll = Math.random();
    const rngBonus = rngRoll < 0.1;
    const rngMultiplier = rngBonus ? 1.5 : 1.0;
    const totalMultiplier = char.multiplier * rngMultiplier;

    const xpAwarded = Math.floor(xpReward * totalMultiplier);
    const goldAwarded = Math.floor(goldReward * totalMultiplier);

    const statField = quest.statBoost ?? CATEGORY_STAT_MAP[quest.category] ?? "strength";
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

    const { xp: newXp, level: newLevel } = processLevelUp(char.xp + xpAwarded, char.level);

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
    invalidateCharacterCache();

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
      statCategory: quest.statBoost ?? CATEGORY_STAT_MAP[quest.category] ?? "strength",
    });

    await upsertActivity(today);

    let vocResult: { gateTriggered: boolean; gateBlocked: boolean; xpAwarded: number; newLevel: number; newXp: number } | null = null;
    if (quest.vocationId) {
      try {
        vocResult = await awardVocXp(quest.vocationId, quest.difficulty);
      } catch (vocErr) {
        req.log.error({ err: vocErr, vocationId: quest.vocationId }, "Failed to award VOC XP; quest completion still succeeds");
      }
    }

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
    const responseData: Record<string, unknown> = { ...data };
    if (vocResult) {
      responseData.vocGateTriggered = vocResult.gateTriggered;
      responseData.vocGateBlocked = vocResult.gateBlocked;
      responseData.vocXpAwarded = vocResult.xpAwarded;
    }
    res.json(responseData);
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
    const today = getSystemDateFromReq(req);

    const { xpPenalty, goldPenalty } = calculateRewards(quest.difficulty, quest.durationMinutes);

    const newFailStreak = char.failStreak + 1;
    const xpGoldMult = getXpGoldPenaltyMultiplier(newFailStreak);
    const attrMult = getAttributePenaltyMultiplier(newFailStreak);

    const xpDeducted = Math.min(char.xp, Math.floor(xpPenalty * xpGoldMult));
    const goldDeducted = Math.min(char.gold, Math.floor(goldPenalty * xpGoldMult));

    const statField = quest.statBoost ?? CATEGORY_STAT_MAP[quest.category] ?? "strength";
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
    invalidateCharacterCache();

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
      statCategory: quest.statBoost ?? CATEGORY_STAT_MAP[quest.category] ?? "strength",
    });

    await upsertActivity(today);

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

router.get("/quest-log", async (req, res) => {
  try {
    const limitParam = req.query.limit;
    const offsetParam = req.query.offset;
    const limit = limitParam ? Math.max(1, parseInt(String(limitParam), 10)) : 365;
    const offset = offsetParam ? Math.max(0, parseInt(String(offsetParam), 10)) : 0;

    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 365);
    windowStart.setHours(0, 0, 0, 0);

    const log = await db
      .select()
      .from(questLogTable)
      .where(gte(questLogTable.occurredAt, windowStart))
      .orderBy(questLogTable.occurredAt)
      .limit(limit)
      .offset(offset);

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
