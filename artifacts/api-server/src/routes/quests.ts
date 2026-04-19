import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { questsTable, questLogTable, characterTable, penaltyLogTable, questDailyLogTable, bossesTable, bossDamageLogTable, shadowArmyTable, shadowJournalTable } from "@workspace/db";
import { eq, and, isNotNull, isNull, lt, lte, or, gte, inArray, sql, asc, desc } from "drizzle-orm";
import { CATEGORY_STAT_MAP, processLevelUp, getStreakStatMultiplier, RANK_BASE_REWARDS, DURATION_BONUS_PER_MINUTE, XP_PENALTY_RATIO, GOLD_PENALTY_RATIO, XP_PER_LEVEL, getSystemDate, getSystemDateFromReq } from "@workspace/shared";
import { strictLimiter } from "../lib/rate-limiters.js";
import {
  CreateQuestBody,
  UpdateQuestBody,
  CompleteQuestResponse,
  FailQuestResponse,
  UpsertQuestDailyLogBody,
  type RecurrenceConfig,
} from "@workspace/api-zod";
import { getOrCreateCharacter, upsertActivity, invalidateCharacterCache } from "./character.js";
import { getActiveRngEvent } from "./rng.js";
import { applyViceRetaliation } from "../lib/celestialPower.js";

const STAT_TO_VIRTUE: Record<string, string> = {
  discipline: "diligence",
  intellect:  "focus",
  endurance:  "resilience",
  strength:   "resilience",
};

function fireCelestialVice(characterId: number, statField: string): void {
  const virtueCategory = STAT_TO_VIRTUE[statField];
  if (!virtueCategory) return;
  applyViceRetaliation(characterId, virtueCategory).catch(() => {});
}

const router: IRouter = Router();

// Per-rank XP ceiling: the total XP a quest can award is capped at the next rank's base XP.
// This prevents low-rank quests from exploiting the duration bonus to out-earn higher-rank quests.
const RANK_XP_CEILING: Record<string, number> = {
  F:   RANK_BASE_REWARDS["E"]?.xp   ?? 25,   // F-rank caps at E-rank base (25 XP)
  E:   RANK_BASE_REWARDS["D"]?.xp   ?? 50,   // E-rank caps at D-rank base (50 XP)
  D:   RANK_BASE_REWARDS["C"]?.xp   ?? 100,  // D-rank caps at C-rank base (100 XP)
  C:   RANK_BASE_REWARDS["B"]?.xp   ?? 175,  // C-rank caps at B-rank base (175 XP)
  B:   RANK_BASE_REWARDS["A"]?.xp   ?? 275,  // B-rank caps at A-rank base (275 XP)
  A:   RANK_BASE_REWARDS["S"]?.xp   ?? 350,  // A-rank caps at S-rank base (350 XP)
  S:   RANK_BASE_REWARDS["SS"]?.xp  ?? 425,  // S-rank caps at SS-rank base (425 XP)
  SS:  RANK_BASE_REWARDS["SSS"]?.xp ?? 500,  // SS-rank caps at SSS-rank base (500 XP)
  SSS: RANK_BASE_REWARDS["SSS"]?.xp ?? 500,  // SSS-rank: no next tier, cap at own base
};

function calculateRewards(difficulty: string, durationMinutes: number) {
  const base = RANK_BASE_REWARDS[difficulty] ?? { xp: 50, gold: 25 };
  const rawXpReward = Math.floor(base.xp + durationMinutes * DURATION_BONUS_PER_MINUTE.xp);
  const xpCeiling = RANK_XP_CEILING[difficulty] ?? rawXpReward;
  const xpReward = Math.min(rawXpReward, xpCeiling);
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

export function serializeQuest(q: typeof questsTable.$inferSelect) {
  return {
    ...q,
    createdAt: q.createdAt.toISOString(),
    completedAt: q.completedAt?.toISOString() ?? null,
    deadline: q.deadline?.toISOString() ?? null,
  };
}


function getNextOccurrenceDate(recurrence: RecurrenceConfig, fromDate: Date): Date | null {
  const next = new Date(fromDate);
  next.setUTCHours(0, 0, 0, 0);

  switch (recurrence.type) {
    case "daily": {
      const interval = recurrence.intervalDays ?? 1;
      next.setUTCDate(next.getUTCDate() + interval);
      return next;
    }
    case "weekly": {
      const days = recurrence.daysOfWeek ?? [];
      if (days.length === 0) {
        next.setUTCDate(next.getUTCDate() + 7);
        return next;
      }
      const currentDay = next.getUTCDay();
      const futureDays = days.filter(d => d > currentDay);
      if (futureDays.length > 0) {
        next.setUTCDate(next.getUTCDate() + (futureDays[0] - currentDay));
      } else {
        const minDay = Math.min(...days);
        next.setUTCDate(next.getUTCDate() + (7 - currentDay + minDay));
      }
      return next;
    }
    case "monthly": {
      const dom = recurrence.dayOfMonth ?? 1;
      next.setUTCDate(1);
      next.setUTCMonth(next.getUTCMonth() + 1);
      const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
      next.setUTCDate(Math.min(dom, lastDay));
      return next;
    }
    case "yearly": {
      const month = recurrence.month ?? 1;
      const day = recurrence.day ?? 1;
      next.setUTCDate(1);
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      next.setUTCMonth(month - 1);
      const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
      next.setUTCDate(Math.min(day, lastDay));
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

  const penalties: PenaltyDetail[] = [];
  const failedQuestsSerialized: object[] = [];

  const { updatedChar, recurringReset, penaltiesApplied, processedOverdue } = await db.transaction(async (tx) => {
    const allActiveQuests = await tx
      .select()
      .from(questsTable)
      .where(and(eq(questsTable.status, "active"), isNull(questsTable.deletedAt), gte(questsTable.createdAt, cutoffDate)));

    const allCompletedQuests = await tx
      .select()
      .from(questsTable)
      .where(and(eq(questsTable.status, "completed"), isNull(questsTable.deletedAt), gte(questsTable.createdAt, cutoffDate)));

    const recurringToReset = allCompletedQuests.filter(q => {
      if (q.isPaused) return false;
      const recurrence = q.recurrence as RecurrenceConfig | null;
      if (!recurrence || recurrence.type === "none") return false;
      return isRecurringQuestDueToday(recurrence, q.completedAt, q.createdAt, localDate);
    });

    for (const quest of recurringToReset) {
      await tx.update(questsTable)
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

    const chars = await tx.select().from(characterTable).limit(1).for("update");
    const char = chars.length > 0
      ? chars[0]
      : (await tx.insert(characterTable).values({ name: "Hunter" }).returning())[0];

    if (overdueQuests.length === 0) {
      await tx
        .update(characterTable)
        .set({ lastCronDate: todayStr })
        .where(eq(characterTable.id, char.id));
      return { updatedChar: char, recurringReset: recurringToReset.length, penaltiesApplied: 0, processedOverdue: overdueQuests };
    }

    let totalXpDeducted = 0;
    let totalGoldDeducted = 0;
    let runningFailStreak = char.failStreak;
    const statAccum: Record<string, number> = {
      strength:   char.strength,
      spirit:     char.spirit,
      intellect:  char.intellect,
      endurance:  char.endurance,
      discipline: char.discipline,
    };

    type QuestLogEntry = typeof questLogTable.$inferInsert;
    type PenaltyLogEntry = typeof penaltyLogTable.$inferInsert;

    const questLogBatch: QuestLogEntry[] = [];
    const penaltyLogBatch: PenaltyLogEntry[] = [];
    const penaltyDescs: Array<{ desc: string; xpDeducted: number; goldDeducted: number }> = [];
    const overdueIds: number[] = [];

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

      overdueIds.push(quest.id);

      questLogBatch.push({
        characterId: char.id,
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
      penaltyLogBatch.push({
        characterId: char.id,
        type: "quest_overdue",
        description: penaltyDesc,
        xpDeducted,
        goldDeducted,
      });
      penaltyDescs.push({ desc: penaltyDesc, xpDeducted, goldDeducted });

      failedQuestsSerialized.push(serializeQuest({ ...quest, status: "failed" }));
    }

    await tx
      .update(questsTable)
      .set({ status: "failed" })
      .where(inArray(questsTable.id, overdueIds));

    await tx.insert(questLogTable).values(questLogBatch);

    const insertedPenalties = await tx
      .insert(penaltyLogTable)
      .values(penaltyLogBatch)
      .returning();

    for (let i = 0; i < overdueQuests.length; i++) {
      const penaltyLog = insertedPenalties[i];
      const { desc, xpDeducted, goldDeducted } = penaltyDescs[i];
      penalties.push({
        type: "quest_overdue",
        description: desc,
        xpDeducted,
        goldDeducted,
        occurredAt: penaltyLog.occurredAt.toISOString(),
      });
    }

    const finalXpGoldMult = getXpGoldPenaltyMultiplier(runningFailStreak);

    const [updated] = await tx
      .update(characterTable)
      .set({
        xp: sql`GREATEST(0, ${characterTable.xp} - ${totalXpDeducted})`,
        gold: sql`GREATEST(0, ${characterTable.gold} - ${totalGoldDeducted})`,
        strength:   statAccum.strength,
        spirit:     statAccum.spirit,
        intellect:  statAccum.intellect,
        endurance:  statAccum.endurance,
        discipline: statAccum.discipline,
        totalQuestsFailed: char.totalQuestsFailed + overdueQuests.length,
        failStreak: runningFailStreak,
        penaltyMultiplier: finalXpGoldMult,
        lastCronDate: todayStr,
      })
      .where(eq(characterTable.id, char.id))
      .returning();

    return { updatedChar: updated, recurringReset: recurringToReset.length, penaltiesApplied: overdueQuests.length, processedOverdue: overdueQuests };
  });

  invalidateCharacterCache();

  for (const q of processedOverdue) {
    fireCelestialVice(updatedChar.id, q.statBoost ?? CATEGORY_STAT_MAP[q.category] ?? "strength");
  }

  return {
    recurringReset,
    penaltiesApplied,
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
 * Compute the next due date for a recurring quest in O(1) constant time.
 *
 * All recurrence types are resolved by direct date-math — no while loops.
 *
 * daily   — same O(1) division formula as before.
 * weekly  — find the nearest listed day-of-week on or after today directly.
 * monthly — try this month's dayOfMonth; if past, advance one month.
 * yearly  — try this year's month/day; if past, advance one year.
 */
function getNextDueFromNow(recurrence: RecurrenceConfig, _baseDate: Date, localDate?: string): Date | null {
  const todayStr = getSystemDate(localDate);
  const today = new Date(todayStr + "T00:00:00.000Z");
  const todayMs = today.getTime();

  switch (recurrence.type) {
    case "daily": {
      const intervalDays = recurrence.intervalDays ?? 1;
      if (intervalDays < 1) return null;

      // First occurrence is one interval ahead of _baseDate.
      const baseMs = Date.UTC(
        _baseDate.getUTCFullYear(),
        _baseDate.getUTCMonth(),
        _baseDate.getUTCDate()
      );
      const firstNextMs = baseMs + intervalDays * 86_400_000;

      if (firstNextMs >= todayMs) return new Date(firstNextMs);

      // Jump directly to the next multiple of intervalDays that lands >= today.
      const diffDays = Math.floor((todayMs - firstNextMs) / 86_400_000);
      const stepsNeeded = Math.ceil(diffDays / intervalDays);
      return new Date(firstNextMs + stepsNeeded * intervalDays * 86_400_000);
    }

    case "weekly": {
      const days = recurrence.daysOfWeek ?? [];

      if (days.length === 0) {
        // No specific days — treat as a 7-day interval from today.
        return new Date(todayMs + 7 * 86_400_000);
      }

      // Find the closest listed day-of-week on or after today.
      // At most 7 array comparisons — O(1).
      const todayDow = today.getUTCDay(); // 0 = Sunday … 6 = Saturday
      const sortedDays = [...days].sort((a, b) => a - b);

      const sameOrLater = sortedDays.filter(d => d >= todayDow);
      if (sameOrLater.length > 0) {
        // Occurrence is this week (could be today itself).
        return new Date(todayMs + (sameOrLater[0] - todayDow) * 86_400_000);
      }

      // No occurrence this week — wrap to the first listed day next week.
      const daysToNext = 7 - todayDow + sortedDays[0];
      return new Date(todayMs + daysToNext * 86_400_000);
    }

    case "monthly": {
      const dom = recurrence.dayOfMonth ?? 1;

      // Helper: clamp dayOfMonth to the last real day of the given month.
      const makeDate = (year: number, month: number): Date => {
        const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        return new Date(Date.UTC(year, month, Math.min(dom, lastDay)));
      };

      const y = today.getUTCFullYear();
      const m = today.getUTCMonth();

      const thisMonthDate = makeDate(y, m);
      if (thisMonthDate >= today) return thisMonthDate;

      // This month's occurrence is in the past — jump to next month directly.
      const nextM = m === 11 ? 0 : m + 1;
      const nextY = m === 11 ? y + 1 : y;
      return makeDate(nextY, nextM);
    }

    case "yearly": {
      const month = recurrence.month ?? 1;   // 1-indexed
      const day = recurrence.day ?? 1;

      const makeDate = (year: number): Date => {
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        return new Date(Date.UTC(year, month - 1, Math.min(day, lastDay)));
      };

      const y = today.getUTCFullYear();
      const thisYearDate = makeDate(y);
      if (thisYearDate >= today) return thisYearDate;

      return makeDate(y + 1);
    }

    default:
      return null;
  }
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

      const allQuests = await db
        .select()
        .from(questsTable)
        .where(
          and(
            isNull(questsTable.deletedAt),
            or(
              or(
                eq(questsTable.status, "completed"),
                eq(questsTable.status, "failed"),
              ),
              and(
                eq(questsTable.status, "active"),
                isNotNull(questsTable.deadline),
                lte(questsTable.deadline, windowEnd),
              ),
              and(
                eq(questsTable.status, "active"),
                isNotNull(questsTable.recurrence),
              ),
              // One-off quests: active with no deadline and no recurrence
              and(
                eq(questsTable.status, "active"),
                isNull(questsTable.deadline),
                isNull(questsTable.recurrence),
              ),
            ),
          ),
        )
        .orderBy(questsTable.createdAt);

      const filtered = allQuests.filter((q) => {
        if (q.status !== "active") return true;

        const recurrence = q.recurrence as RecurrenceConfig | null;

        if (recurrence && recurrence.type !== "none") {
          const nextDue = getNextDueFromNow(recurrence, q.completedAt ?? q.createdAt, localDate);
          if (!nextDue) return false;
          return nextDue <= windowEnd;
        }

        if (q.deadline) return true;

        // One-off quests (no deadline, no recurrence) are always active
        return true;
      });

      return res.json(filtered.map(serializeQuest));
    }

    const limitParam = req.query.limit;
    const offsetParam = req.query.offset;
    const limit = limitParam ? Math.max(1, parseInt(String(limitParam), 10)) : 365;
    const offset = offsetParam ? Math.max(0, parseInt(String(offsetParam), 10)) : 0;

    const windowStart = new Date();
    windowStart.setUTCDate(windowStart.getUTCDate() - 365);
    windowStart.setUTCHours(0, 0, 0, 0);

    const allQuests = await db
      .select()
      .from(questsTable)
      .where(and(isNull(questsTable.deletedAt), gte(questsTable.createdAt, windowStart)))
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
        deadline: (() => { if (!body.deadline) return null; const d = new Date(body.deadline as string); return isNaN(d.getTime()) ? null : d; })(),
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
    throw err;
  }
});

router.get("/quests/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid quest ID" });
    const [quest] = await db.select().from(questsTable).where(eq(questsTable.id, id));
    if (!quest || quest.deletedAt) return res.status(404).json({ error: "Quest not found" });
    res.json(serializeQuest(quest));
  } catch (err) {
    req.log.error({ err }, "Error getting quest");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/quests/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid quest ID" });

    const [existing] = await db.select().from(questsTable).where(eq(questsTable.id, id));
    if (!existing || existing.deletedAt) return res.status(404).json({ error: "Quest not found" });

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
    if ("deadline" in body) {
      updates.deadline = body.deadline
        ? (() => { const d = new Date(body.deadline as string); return isNaN(d.getTime()) ? null : d; })()
        : null;
    }
    if ("vocationId" in req.body) {
      updates.vocationId = typeof req.body.vocationId === "string" ? req.body.vocationId : null;
    }

    const [updated] = await db.update(questsTable).set(updates).where(eq(questsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Quest not found" });
    res.json(serializeQuest(updated));
  } catch (err) {
    throw err;
  }
});

router.delete("/quests/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid quest ID" });
    await db.update(questsTable).set({ deletedAt: new Date() }).where(eq(questsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting quest");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/quests/:id/log", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid quest ID" });
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
    if (isNaN(questId)) return res.status(400).json({ error: "Invalid quest ID" });
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

router.post("/quests/:id/complete", strictLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid quest ID" });
    const [quest] = await db.select().from(questsTable).where(eq(questsTable.id, id));
    if (!quest || quest.deletedAt) return res.status(404).json({ error: "Quest not found" });
    if (quest.status !== "active") return res.status(400).json({ error: "Quest is not active" });

    const char = await getOrCreateCharacter();
    const today = getSystemDateFromReq(req);

    const { xpReward, goldReward } = calculateRewards(quest.difficulty, quest.durationMinutes);

    const rngRoll = Math.random();
    const rngBonus = rngRoll < 0.1;
    const rngMultiplier = rngBonus ? 1.5 : 1.0;

    const activeEvent = getActiveRngEvent(today);
    const eventBonus = activeEvent ? activeEvent.multiplierBonus : 0;

    const SHADOW_RANK_BONUS: Record<string, number> = { D: 0.05, C: 0.10, B: 0.15, A: 0.20, S: 0.30 };
    const [assignedShadow] = await db
      .select()
      .from(shadowArmyTable)
      .where(eq(shadowArmyTable.assignedTaskId, id))
      .limit(1);
    const shadowBonus = assignedShadow ? (SHADOW_RANK_BONUS[assignedShadow.rank] ?? 0) : 0;

    const survivorBuff =
      char.survivorBuffExpiresAt && char.survivorBuffExpiresAt > new Date() ? 1.05 : 1.0;
    const totalMultiplier =
      char.multiplier * rngMultiplier * (1 + eventBonus) * (1 + shadowBonus) * survivorBuff;

    const xpAwarded = Math.floor(xpReward * totalMultiplier);
    const goldAwarded = Math.floor(goldReward * totalMultiplier);

    const statField = quest.statBoost ?? CATEGORY_STAT_MAP[quest.category] ?? "strength";
    const baseDifficultyGain = quest.difficulty === "S" || quest.difficulty === "SS" || quest.difficulty === "SSS" ? 3 : quest.difficulty === "A" || quest.difficulty === "B" ? 2 : 1;
    const streakMult = getStreakStatMultiplier(char.streak);
    const statGain = Math.max(1, Math.floor(baseDifficultyGain * streakMult));
    const disciplineGain = statField === "discipline"
      ? 0
      : Math.max(1, Math.floor(statGain * 0.25));

    const strengthGain   = statField === "strength"   ? statGain : 0;
    const spiritGain     = statField === "spirit"     ? statGain : 0;
    const intellectGain  = statField === "intellect"  ? statGain : 0;
    const enduranceGain  = statField === "endurance"  ? statGain : 0;
    const disciplineTotal = (statField === "discipline" ? statGain : 0) + disciplineGain;

    const localMidnight = new Date(today + "T00:00:00.000Z");

    const [updatedChar, newLevel, leveledUp] = await db.transaction(async (tx) => {
      const questResult = await tx.update(questsTable)
        .set({ status: "completed", completedAt: localMidnight })
        .where(and(eq(questsTable.id, id), eq(questsTable.status, "active")))
        .returning({ id: questsTable.id });

      if (questResult.length === 0) {
        throw Object.assign(new Error("Quest already completed"), { code: "ALREADY_COMPLETED" });
      }

      const [lockedChar] = await tx
        .select({ xp: characterTable.xp, level: characterTable.level })
        .from(characterTable)
        .where(eq(characterTable.id, char.id))
        .for("update");

      const { xp: newXp, level: txNewLevel } = processLevelUp(lockedChar.xp + xpAwarded, lockedChar.level);
      const txLeveledUp = txNewLevel > lockedChar.level;

      const [updated] = await tx.update(characterTable)
        .set({
          xp: Math.min(999_999_999, newXp),
          level: txNewLevel,
          gold: sql`LEAST(999999, ${characterTable.gold} + ${goldAwarded})`,
          strength:   sql`LEAST(99999, ${characterTable.strength}   + ${strengthGain})`,
          spirit:     sql`LEAST(99999, ${characterTable.spirit}     + ${spiritGain})`,
          intellect:  sql`LEAST(99999, ${characterTable.intellect}  + ${intellectGain})`,
          endurance:  sql`LEAST(99999, ${characterTable.endurance}  + ${enduranceGain})`,
          discipline: sql`LEAST(99999, ${characterTable.discipline} + ${disciplineTotal})`,
          totalQuestsCompleted: sql`${characterTable.totalQuestsCompleted} + 1`,
          failStreak: 0,
          penaltyMultiplier: 1.0,
        })
        .where(eq(characterTable.id, char.id))
        .returning();

      return [updated, txNewLevel, txLeveledUp] as const;
    });
    invalidateCharacterCache();

    if (assignedShadow) {
      await db
        .update(shadowArmyTable)
        .set({ assignedTaskId: null })
        .where(eq(shadowArmyTable.id, assignedShadow.id));

      await db.insert(shadowJournalTable).values({
        characterId: char.id,
        shadowId: assignedShadow.id,
        shadowName: assignedShadow.name,
        shadowRank: assignedShadow.rank,
        questId: quest.id,
        questName: quest.name,
        questCategory: quest.category,
        questDifficulty: quest.difficulty,
        shadowBonusPct: shadowBonus,
        xpAwarded: xpAwarded,
        goldAwarded: goldAwarded,
      });
    }

    await db.insert(questLogTable).values({
      characterId: char.id,
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

    // Boss Damage Bridge — deal damage to the first active (non-defeated) boss
    try {
      const [activeBoss] = await db
        .select()
        .from(bossesTable)
        .where(eq(bossesTable.isDefeated, false))
        .orderBy(asc(bossesTable.id))
        .limit(1);

      if (activeBoss) {
        const enduranceMultiplier = statField === "endurance" ? 1.5 : 1.0;
        const damageAmount = Math.floor(xpAwarded * enduranceMultiplier);
        const newHp = Math.max(0, activeBoss.currentHp - damageAmount);
        const bossDefeated = newHp <= 0;

        await db.insert(bossDamageLogTable).values({
          bossId: activeBoss.id,
          characterId: char.id,
          damageAmount,
          sourceDesc: `Quest Complete: ${quest.name} (+${damageAmount} DMG)`,
        });

        await db.update(bossesTable)
          .set({
            currentHp: newHp,
            lastDamageAt: new Date(),
            ...(bossDefeated ? { isDefeated: true, defeatRecordedAt: new Date() } : {}),
          })
          .where(and(eq(bossesTable.id, activeBoss.id), eq(bossesTable.isDefeated, false)));
      }
    } catch (bossErr) {
      req.log.warn({ err: bossErr }, "Boss damage bridge failed; quest completion still succeeds");
    }

    // Gate Fragment Drop — 15% chance per quest completion
    let gateFragmentDropped = false;
    try {
      if (Math.random() < 0.15) {
        gateFragmentDropped = true;
        await db
          .update(characterTable)
          .set({ gateFragments: sql`${characterTable.gateFragments} + 1` })
          .where(eq(characterTable.id, char.id))
          .returning({ gateFragments: characterTable.gateFragments });
        invalidateCharacterCache();
      }
    } catch (fragErr) {
      req.log.warn({ err: fragErr }, "Gate fragment drop failed; quest completion still succeeds");
    }

    const statGains = {
      strength:   statField === "strength"   ? statGain : 0,
      spirit:     statField === "spirit"     ? statGain : 0,
      intellect:  statField === "intellect"  ? statGain : 0,
      endurance:  statField === "endurance"  ? statGain : 0,
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
    if (assignedShadow) {
      responseData.shadowBonus = shadowBonus;
      responseData.shadowName = assignedShadow.name;
      responseData.shadowRank = assignedShadow.rank;
    }
    if (gateFragmentDropped) {
      responseData.gateFragmentDropped = true;
    }
    res.json(responseData);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ALREADY_COMPLETED") {
      return res.status(400).json({ error: "Quest already completed" });
    }
    req.log.error({ err }, "Error completing quest");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quests/:id/fail", strictLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid quest ID" });
    const [quest] = await db.select().from(questsTable).where(eq(questsTable.id, id));
    if (!quest || quest.deletedAt) return res.status(404).json({ error: "Quest not found" });
    if (quest.status !== "active") return res.status(409).json({ error: "Quest already processed" });

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

    const strengthPenalty   = statField === "strength"   ? catStatPenalty : 0;
    const spiritPenalty     = statField === "spirit"     ? catStatPenalty : 0;
    const intellectPenalty  = statField === "intellect"  ? catStatPenalty : 0;
    const endurancePenalty  = statField === "endurance"  ? catStatPenalty : 0;
    const disciplinePenalty = (statField === "discipline" ? catStatPenalty : 0) + discPenalty;

    const [updatedChar] = await db.transaction(async (tx) => {
      const questResult = await tx.update(questsTable)
        .set({ status: "failed" })
        .where(and(eq(questsTable.id, id), eq(questsTable.status, "active")))
        .returning({ id: questsTable.id });

      if (questResult.length === 0) {
        throw Object.assign(new Error("Quest already processed"), { code: "ALREADY_FAILED" });
      }

      const [updated] = await tx.update(characterTable)
        .set({
          xp: sql`GREATEST(0, ${characterTable.xp} - ${xpDeducted})`,
          gold: sql`GREATEST(0, ${characterTable.gold} - ${goldDeducted})`,
          strength:   sql`GREATEST(1, ${characterTable.strength}   - ${strengthPenalty})`,
          spirit:     sql`GREATEST(1, ${characterTable.spirit}     - ${spiritPenalty})`,
          intellect:  sql`GREATEST(1, ${characterTable.intellect}  - ${intellectPenalty})`,
          endurance:  sql`GREATEST(1, ${characterTable.endurance}  - ${endurancePenalty})`,
          discipline: sql`GREATEST(1, ${characterTable.discipline} - ${disciplinePenalty})`,
          totalQuestsFailed: sql`${characterTable.totalQuestsFailed} + 1`,
          failStreak: newFailStreak,
          penaltyMultiplier: xpGoldMult,
        })
        .where(eq(characterTable.id, char.id))
        .returning();

      return [updated];
    });
    invalidateCharacterCache();

    // Vice Retaliation (P-ascension): failing a quest with a virtueCategory
    // increases the corresponding domain's viceScore by +10.
    if (quest.virtueCategory) {
      await applyViceRetaliation(char.id, quest.virtueCategory);
    }

    await db.insert(questLogTable).values({
      characterId: char.id,
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
      strength:   statField === "strength"   ? catStatPenalty : 0,
      spirit:     statField === "spirit"     ? catStatPenalty : 0,
      intellect:  statField === "intellect"  ? catStatPenalty : 0,
      endurance:  statField === "endurance"  ? catStatPenalty : 0,
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
    // Only fire stat-based vice if virtueCategory did not already handle it above.
    // Prevents double vice increment on quests that have both fields set.
    if (!quest.virtueCategory) {
      fireCelestialVice(char.id, quest.statBoost ?? CATEGORY_STAT_MAP[quest.category] ?? "strength");
    }
    res.json(data);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ALREADY_FAILED") {
      return res.status(409).json({ error: "Quest already processed" });
    }
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
    windowStart.setUTCDate(windowStart.getUTCDate() - 365);
    windowStart.setUTCHours(0, 0, 0, 0);

    const log = await db
      .select()
      .from(questLogTable)
      .where(gte(questLogTable.occurredAt, windowStart))
      .orderBy(desc(questLogTable.occurredAt))
      .limit(limit)
      .offset(offset);

    const mapped = log.map((e) => ({
      ...e,
      occurredAt: e.occurredAt.toISOString(),
    }));
    res.json(mapped);
  } catch (err) {
    req.log.error({ err }, "Error getting quest log");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
