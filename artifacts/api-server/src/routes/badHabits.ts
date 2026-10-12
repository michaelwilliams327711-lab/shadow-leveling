import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { badHabitsTable, badHabitLogTable, characterTable } from "@workspace/db";
import { eq, desc, and, inArray, gte, lt, isNull, sql } from "drizzle-orm";
import { CreateBadHabitBody, UpdateBadHabitBody } from "@workspace/api-zod";
import { corruptionConfig, type HabitSeverity } from "../corruptionConfig.js";
import { getOrCreateCharacter, XP_PER_LEVEL, invalidateCharacterCache } from "./character.js";
import { getSystemDate, getSystemDateFromReq } from "@workspace/shared";

const router: IRouter = Router();

type LogRow = { date: string; type: string; occurredAt: Date };

function getDayStatusFromMap(byDate: Map<string, LogRow[]>, date: string): "clean" | "relapsed" | "missed" {
  const dayLogs = byDate.get(date);
  if (!dayLogs || !dayLogs.length) return "missed";
  const hasRelapse = dayLogs.some((l) => l.type === "relapse");
  if (hasRelapse) return "relapsed";
  return "clean";
}

function buildDateMap(logs: LogRow[]): Map<string, LogRow[]> {
  const byDate = new Map<string, LogRow[]>();
  for (const log of logs) {
    const existing = byDate.get(log.date) ?? [];
    existing.push(log);
    byDate.set(log.date, existing);
  }
  return byDate;
}

function dateAddDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

const MAX_STREAK_SCAN_DAYS = 365;

function computeCleanStreak(logs: LogRow[], localDate?: string): number {
  if (!logs.length) return 0;

  const byDate = buildDateMap(logs);
  const today = getSystemDate(localDate);
  let streak = 0;
  let checkDate = today;

  while (streak < MAX_STREAK_SCAN_DAYS) {
    const status = getDayStatusFromMap(byDate, checkDate);
    if (status === "clean") {
      streak++;
      checkDate = dateAddDays(checkDate, -1);
    } else {
      break;
    }
  }
  return streak;
}

function computeCleanStreakFromMap(byDate: Map<string, LogRow[]>, localDate?: string): number {
  const today = getSystemDate(localDate);
  let streak = 0;
  let checkDate = today;

  while (streak < MAX_STREAK_SCAN_DAYS) {
    const status = getDayStatusFromMap(byDate, checkDate);
    if (status === "clean") {
      streak++;
      checkDate = dateAddDays(checkDate, -1);
    } else {
      break;
    }
  }
  return streak;
}

function computeLongestStreak(logs: LogRow[], localDate?: string): number {
  if (!logs.length) return 0;

  const byDate = buildDateMap(logs);
  const dates = [...byDate.keys()].sort();
  if (!dates.length) return 0;

  const startDate = dates[0];
  const endDate = getSystemDate(localDate);

  let longest = 0;
  let current = 0;
  let cursor = startDate;

  while (cursor <= endDate) {
    const status = getDayStatusFromMap(byDate, cursor);
    if (status === "clean") {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
    cursor = dateAddDays(cursor, 1);
  }

  return longest;
}

router.get("/corruption-config", (_req, res) => {
  res.json(corruptionConfig);
});

router.get("/bad-habits", async (req, res) => {
  try {
    const localDate = getSystemDateFromReq(req);
    const habits = await db.select().from(badHabitsTable).where(isNull(badHabitsTable.deletedAt)).orderBy(desc(badHabitsTable.createdAt));

    if (!habits.length) {
      return res.json([]);
    }

    const habitIds = habits.map((h) => h.id);
    const cutoffDate = new Date();
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 365);
    cutoffDate.setUTCHours(0, 0, 0, 0);
    const allLogs = await db
      .select({ habitId: badHabitLogTable.habitId, date: badHabitLogTable.date, type: badHabitLogTable.type, occurredAt: badHabitLogTable.occurredAt })
      .from(badHabitLogTable)
      .where(and(inArray(badHabitLogTable.habitId, habitIds), gte(badHabitLogTable.occurredAt, cutoffDate)))
      .orderBy(desc(badHabitLogTable.date), desc(badHabitLogTable.occurredAt));

    const logsByHabitId = new Map<string, LogRow[]>();
    for (const log of allLogs) {
      const existing = logsByHabitId.get(log.habitId) ?? [];
      existing.push({ date: log.date, type: log.type, occurredAt: log.occurredAt });
      logsByHabitId.set(log.habitId, existing);
    }

    const result = habits.map((habit) => {
      const logs = logsByHabitId.get(habit.id) ?? [];
      let longestStreak = habit.longestStreak;

      // Backfill: first read after migration — longestStreak is 0 but logs exist.
      // Compute from history once and cache it asynchronously (fire-and-forget).
      if (longestStreak === 0 && logs.length > 0) {
        longestStreak = computeLongestStreak(logs, localDate);
        if (longestStreak > 0) {
          db.update(badHabitsTable)
            .set({ longestStreak })
            .where(eq(badHabitsTable.id, habit.id))
            .catch(() => {});
        }
      }

      // cleanStreak is served from the cached DB column — no O(365) loop.
      return { ...habit, cleanStreak: habit.currentStreak, longestStreak };
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error listing bad habits");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bad-habits", async (req, res) => {
  try {
    const body = CreateBadHabitBody.parse(req.body);
    const [habit] = await db.insert(badHabitsTable).values(body).returning();
    res.status(201).json({ ...habit, cleanStreak: 0, longestStreak: 0 });
  } catch (err) {
    req.log.error({ err }, "Error creating bad habit");
    throw err;
  }
});

router.patch("/bad-habits/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const localDate = getSystemDateFromReq(req);
    const body = UpdateBadHabitBody.parse(req.body);
    const [updated] = await db.update(badHabitsTable).set(body).where(eq(badHabitsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Not found" });

    const logs = await db
      .select({ date: badHabitLogTable.date, type: badHabitLogTable.type, occurredAt: badHabitLogTable.occurredAt })
      .from(badHabitLogTable)
      .where(eq(badHabitLogTable.habitId, id))
      .orderBy(desc(badHabitLogTable.date), desc(badHabitLogTable.occurredAt));

    // Use cached longestStreak; backfill once if needed (habit has logs but column is still 0).
    let longestStreak = updated.longestStreak;
    if (longestStreak === 0 && logs.length > 0) {
      longestStreak = computeLongestStreak(logs, localDate);
      if (longestStreak > 0) {
        await db.update(badHabitsTable).set({ longestStreak }).where(eq(badHabitsTable.id, id));
      }
    }
    res.json({ ...updated, cleanStreak: updated.currentStreak, longestStreak });
  } catch (err) {
    req.log.error({ err }, "Error updating bad habit");
    throw err;
  }
});

router.delete("/bad-habits/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.update(badHabitsTable).set({ deletedAt: new Date() }).where(eq(badHabitsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting bad habit");
    res.status(500).json({ error: "Internal server error" });
  }
});

type FractureResolution = "RESILIENT" | "STAGGERED" | "COLLAPSED";
const VALID_RESOLUTIONS: FractureResolution[] = ["RESILIENT", "STAGGERED", "COLLAPSED"];

router.post("/bad-habits/:id/relapse", async (req, res) => {
  try {
    const { id } = req.params;
    const rawResolution = (req.body?.resolution ?? "STAGGERED") as string;
    const resolution = rawResolution.toUpperCase() as FractureResolution;
    if (!VALID_RESOLUTIONS.includes(resolution)) {
      return res.status(400).json({ error: "Invalid resolution. Expected RESILIENT | STAGGERED | COLLAPSED." });
    }

    const habit = await db.select().from(badHabitsTable).where(eq(badHabitsTable.id, id)).limit(1);
    if (!habit.length || habit[0].deletedAt) return res.status(404).json({ error: "Not found" });
    if (habit[0].isActive === 0) return res.status(400).json({ error: "Cannot log on an archived habit" });

    const h = habit[0];
    const severity = h.severity as HabitSeverity;
    const todayStr = getSystemDateFromReq(req);

    // Fracture engine outputs.
    let xpDelta = 0;
    let goldLoss = 0;
    let discLoss = 0;
    let corruptionDelta = 0;
    let nextMultiplier = h.lapseMultiplier;
    let nextIsFractured = h.isFractured;
    let resetStreak = false;
    let bumpResilient = 0;

    if (resolution === "RESILIENT") {
      xpDelta = 25;
    } else if (resolution === "STAGGERED") {
      xpDelta = 5;
      goldLoss = 50 * h.lapseMultiplier;
      discLoss = 1 * h.lapseMultiplier;
      corruptionDelta = corruptionConfig.corruptionDelta[severity];
      nextIsFractured = true;
      nextMultiplier = h.lapseMultiplier * 3;
    } else {
      // COLLAPSED — apply current-multiplier penalty, then escalate, and shatter streak.
      goldLoss = 50 * h.lapseMultiplier;
      discLoss = 1 * h.lapseMultiplier;
      corruptionDelta = corruptionConfig.corruptionDelta[severity];
      nextIsFractured = true;
      nextMultiplier = h.lapseMultiplier * 3;
      resetStreak = true;
    }
    if (resolution === "RESILIENT") bumpResilient = 1;

    let resultCorruption = 0;
    let resultGold = 0;
    let resultDiscipline = 0;
    let resultLevel = 0;
    let resultXp = 0;

    await db.transaction(async (tx) => {
      const chars = await tx.select().from(characterTable).limit(1).for("update");
      if (!chars.length) return;
      const char = chars[0];

      const newCorruption = Math.min(100, char.corruption + corruptionDelta);
      const newGold = Math.max(0, char.gold - goldLoss);
      const newDiscipline = Math.max(1, char.discipline - discLoss);

      // Forward-XP loop with safety cap (avoid runaway level-ups on absurd XP gifts).
      let newLevel = char.level;
      let newXp = char.xp + xpDelta;
      let safety = 0;
      while (newXp >= XP_PER_LEVEL(newLevel) && safety < 100) {
        newXp -= XP_PER_LEVEL(newLevel);
        newLevel++;
        safety++;
      }

      resultCorruption = newCorruption;
      resultGold = newGold;
      resultDiscipline = newDiscipline;
      resultLevel = newLevel;
      resultXp = newXp;

      await tx.update(characterTable)
        .set({
          corruption: newCorruption,
          gold: newGold,
          discipline: newDiscipline,
          xp: newXp,
          level: newLevel,
        })
        .where(eq(characterTable.id, char.id));

      await tx.insert(badHabitLogTable).values({
        habitId: id,
        date: todayStr,
        type: resolution.toLowerCase(),
        corruptionDelta,
      });

      const habitUpdate: Record<string, unknown> = {
        isFractured: nextIsFractured,
        lapseMultiplier: nextMultiplier,
        totalExposures: sql`${badHabitsTable.totalExposures} + 1`,
      };
      if (bumpResilient) {
        habitUpdate.resilientCount = sql`${badHabitsTable.resilientCount} + 1`;
      }
      if (resetStreak) {
        habitUpdate.currentStreak = 0;
        habitUpdate.lastCleanDate = null;
      }
      await tx.update(badHabitsTable)
        .set(habitUpdate)
        .where(eq(badHabitsTable.id, id));
    });
    invalidateCharacterCache();

    res.json({
      success: true,
      resolution,
      xpDelta,
      goldLoss,
      discLoss,
      corruptionDelta,
      newCorruption: resultCorruption,
      newGold: resultGold,
      newDiscipline: resultDiscipline,
      newLevel: resultLevel,
      newXp: resultXp,
      lapseMultiplier: nextMultiplier,
      isFractured: nextIsFractured,
      // Legacy fields for backwards compatibility with existing client code.
      xpPenalty: xpDelta < 0 ? -xpDelta : 0,
    });
  } catch (err) {
    req.log.error({ err }, "Error logging fracture resolution");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bad-habits/:id/repair", async (req, res) => {
  try {
    const { id } = req.params;
    const REPAIR_COST = 250;

    const habit = await db.select().from(badHabitsTable).where(eq(badHabitsTable.id, id)).limit(1);
    if (!habit.length || habit[0].deletedAt) return res.status(404).json({ error: "Not found" });

    let newGold = 0;
    let newCorruption = 0;
    let newDiscipline = 0;
    let newLevel = 0;
    let newXp = 0;
    let didRepair = false;
    let errorOut: string | null = null;

    await db.transaction(async (tx) => {
      const chars = await tx.select().from(characterTable).limit(1).for("update");
      if (!chars.length) {
        errorOut = "Character not found";
        return;
      }
      const char = chars[0];
      if (char.gold < REPAIR_COST) {
        errorOut = `Insufficient gold. Need ${REPAIR_COST}, have ${char.gold}.`;
        return;
      }

      newGold = char.gold - REPAIR_COST;
      // Repair only mutates gold, but the response carries a full character
      // snapshot so the client can echo authoritative stats immediately
      // (parity with /relapse — fixes the "Status Desync" bug).
      newCorruption = char.corruption;
      newDiscipline = char.discipline;
      newLevel = char.level;
      newXp = char.xp;

      await tx.update(characterTable)
        .set({ gold: newGold })
        .where(eq(characterTable.id, char.id));

      await tx.update(badHabitsTable)
        .set({ isFractured: false, lapseMultiplier: 1 })
        .where(eq(badHabitsTable.id, id));

      didRepair = true;
    });

    if (errorOut) {
      return res.status(400).json({ error: errorOut });
    }
    invalidateCharacterCache();

    res.json({
      success: true,
      didRepair,
      cost: REPAIR_COST,
      newGold,
      newCorruption,
      newDiscipline,
      newLevel,
      newXp,
      isFractured: false,
      lapseMultiplier: 1,
    });
  } catch (err) {
    req.log.error({ err }, "Error repairing armor");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bad-habits/record-clean-day", async (req, res) => {
  try {
    const todayStr = getSystemDateFromReq(req);
    const activeHabits = await db
      .select()
      .from(badHabitsTable)
      .where(and(eq(badHabitsTable.isActive, 1), isNull(badHabitsTable.deletedAt)));

    if (!activeHabits.length) {
      return res.json({ success: true, purified: false });
    }

    const habitIds = activeHabits.map((h) => h.id);

    const logsCutoffDate = new Date();
    logsCutoffDate.setUTCDate(logsCutoffDate.getUTCDate() - 365);
    logsCutoffDate.setUTCHours(0, 0, 0, 0);

    const allLogs = await db
      .select({ habitId: badHabitLogTable.habitId, date: badHabitLogTable.date, type: badHabitLogTable.type, occurredAt: badHabitLogTable.occurredAt })
      .from(badHabitLogTable)
      .where(and(inArray(badHabitLogTable.habitId, habitIds), gte(badHabitLogTable.occurredAt, logsCutoffDate)))
      .orderBy(desc(badHabitLogTable.date), desc(badHabitLogTable.occurredAt));

    const logsByHabitId = new Map<string, LogRow[]>();
    for (const log of allLogs) {
      const existing = logsByHabitId.get(log.habitId) ?? [];
      existing.push({ date: log.date, type: log.type, occurredAt: log.occurredAt });
      logsByHabitId.set(log.habitId, existing);
    }

    const toInsert: { habitId: string; date: string; type: string; corruptionDelta: number }[] = [];
    for (const habit of activeHabits) {
      const logs = logsByHabitId.get(habit.id) ?? [];
      const todayLogs = logs.filter((l) => l.date === todayStr);
      const hasRelapse = todayLogs.some((l) => l.type === "relapse");
      const hasClean = todayLogs.some((l) => l.type === "clean");
      if (!hasRelapse && !hasClean) {
        toInsert.push({ habitId: habit.id, date: todayStr, type: "clean", corruptionDelta: 0 });
      }
    }

    const toInsertIds = new Set(toInsert.map(r => r.habitId));

    if (toInsert.length > 0) {
      await db.insert(badHabitLogTable).values(toInsert);
      // Cache increment: advance currentStreak by 1, record lastCleanDate,
      // and bump longestStreak whenever the new streak exceeds the stored peak.
      await db.update(badHabitsTable)
        .set({
          currentStreak: sql`${badHabitsTable.currentStreak} + 1`,
          lastCleanDate: todayStr,
          longestStreak: sql`GREATEST(${badHabitsTable.longestStreak}, ${badHabitsTable.currentStreak} + 1)`,
        })
        .where(inArray(badHabitsTable.id, [...toInsertIds]));
    }

    const purificationThreshold = corruptionConfig.purificationStreakDays;
    let allPurified = true;

    for (const habit of activeHabits) {
      // Habits that just received a clean log have a projected streak of
      // currentStreak + 1. Habits already logged today are unchanged.
      const projectedStreak = toInsertIds.has(habit.id)
        ? habit.currentStreak + 1
        : habit.currentStreak;
      if (projectedStreak < purificationThreshold) {
        allPurified = false;
        break;
      }
    }

    let purified = false;
    if (allPurified) {
      const char = await getOrCreateCharacter();
      if (char.corruption > 0) {
        const resetDelta = -char.corruption;
        await db.update(characterTable)
          .set({ corruption: 0 })
          .where(eq(characterTable.id, char.id));
        invalidateCharacterCache();
        purified = true;

        await db.insert(badHabitLogTable).values(
          activeHabits.map((habit) => ({
            habitId: habit.id,
            date: todayStr,
            type: "purification",
            corruptionDelta: resetDelta,
          }))
        );
      }
    }

    res.json({ success: true, purified });
  } catch (err) {
    req.log.error({ err }, "Error recording clean day");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bad-habits/corruption-history", async (req, res) => {
  try {
    const limitParam = req.query.limit;
    const offsetParam = req.query.offset;
    const limit = limitParam ? Math.max(1, parseInt(String(limitParam), 10)) : 90;
    const offset = offsetParam ? Math.max(0, parseInt(String(offsetParam), 10)) : 0;

    const windowStart = new Date();
    windowStart.setUTCDate(windowStart.getUTCDate() - 90);
    windowStart.setUTCHours(0, 0, 0, 0);

    const [beforeWindowLogs, withinWindowLogs, allHabits] = await Promise.all([
      db
        .select({
          type: badHabitLogTable.type,
          corruptionDelta: badHabitLogTable.corruptionDelta,
        })
        .from(badHabitLogTable)
        .where(lt(badHabitLogTable.occurredAt, windowStart))
        .orderBy(badHabitLogTable.occurredAt)
        .limit(1000),
      db
        .select({
          date: badHabitLogTable.date,
          type: badHabitLogTable.type,
          corruptionDelta: badHabitLogTable.corruptionDelta,
          occurredAt: badHabitLogTable.occurredAt,
          habitId: badHabitLogTable.habitId,
        })
        .from(badHabitLogTable)
        .where(gte(badHabitLogTable.occurredAt, windowStart))
        .orderBy(badHabitLogTable.occurredAt)
        .limit(limit + offset),
      db.select({ id: badHabitsTable.id, name: badHabitsTable.name }).from(badHabitsTable),
    ]);

    const habitsMap: Record<string, string> = {};
    for (const h of allHabits) {
      habitsMap[h.id] = h.name;
    }

    let runningCorruption = 0;
    for (const priorLog of beforeWindowLogs) {
      if (priorLog.type === "purification") {
        runningCorruption = 0;
      } else {
        runningCorruption = Math.max(0, Math.min(100, runningCorruption + priorLog.corruptionDelta));
      }
    }
    for (let i = 0; i < Math.min(offset, withinWindowLogs.length); i++) {
      const priorLog = withinWindowLogs[i];
      if (priorLog.type === "purification") {
        runningCorruption = 0;
      } else {
        runningCorruption = Math.max(0, Math.min(100, runningCorruption + priorLog.corruptionDelta));
      }
    }
    const logs = withinWindowLogs.slice(offset);

    const chartPoints: { date: string; corruption: number; occurredAt: string }[] = [];

    for (const log of logs) {
      if (log.type === "purification") {
        runningCorruption = 0;
      } else {
        runningCorruption = Math.max(0, Math.min(100, runningCorruption + log.corruptionDelta));
      }
      chartPoints.push({ date: log.date, corruption: runningCorruption, occurredAt: log.occurredAt.toISOString() });
    }

    const dateMap = new Map<string, number>();
    for (const point of chartPoints) {
      dateMap.set(point.date, point.corruption);
    }
    const chartData = [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, corruption]) => ({ date, corruption }));

    const relapseEvents = logs
      .filter((l) => l.type === "relapse")
      .map((l) => ({
        date: l.date,
        habitName: habitsMap[l.habitId] ?? "Unknown",
        delta: l.corruptionDelta,
        occurredAt: l.occurredAt.toISOString(),
      }))
      .reverse();

    res.json({ chartData, relapseEvents });
  } catch (err) {
    req.log.error({ err }, "Error fetching corruption history");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
