import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { badHabitsTable, badHabitLogTable, characterTable } from "@workspace/db";
import { eq, desc, and, inArray, gte, lt } from "drizzle-orm";
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

function computeCleanStreak(logs: LogRow[], localDate?: string): number {
  if (!logs.length) return 0;

  const byDate = buildDateMap(logs);
  const today = getSystemDate(localDate);
  let streak = 0;
  let checkDate = today;

  while (true) {
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

function computeCleanStreakFromMap(byDate: Map<string, LogRow[]>): number {
  const today = new Date().toISOString().split("T")[0];
  let streak = 0;
  let checkDate = today;

  while (true) {
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

function computeLongestStreak(logs: LogRow[]): number {
  if (!logs.length) return 0;

  const byDate = buildDateMap(logs);
  const dates = [...byDate.keys()].sort();
  if (!dates.length) return 0;

  let longest = 0;
  let current = 0;
  let prevDate: string | null = null;

  for (const date of dates) {
    const status = getDayStatusFromMap(byDate, date);
    if (status !== "clean") {
      current = 0;
      prevDate = date;
      continue;
    }
    if (prevDate && dateAddDays(prevDate, 1) !== date) {
      current = 0;
    }
    current++;
    if (current > longest) longest = current;
    prevDate = date;
  }
  return longest;
}

router.get("/corruption-config", (_req, res) => {
  res.json(corruptionConfig);
});

router.get("/bad-habits", async (req, res) => {
  try {
    const localDate = getSystemDateFromReq(req);
    const habits = await db.select().from(badHabitsTable).orderBy(desc(badHabitsTable.createdAt));

    if (!habits.length) {
      return res.json([]);
    }

    const habitIds = habits.map((h) => h.id);
    const allLogs = await db
      .select({ habitId: badHabitLogTable.habitId, date: badHabitLogTable.date, type: badHabitLogTable.type, occurredAt: badHabitLogTable.occurredAt })
      .from(badHabitLogTable)
      .where(inArray(badHabitLogTable.habitId, habitIds))
      .orderBy(desc(badHabitLogTable.date), desc(badHabitLogTable.occurredAt));

    const logsByHabitId = new Map<string, LogRow[]>();
    for (const log of allLogs) {
      const existing = logsByHabitId.get(log.habitId) ?? [];
      existing.push({ date: log.date, type: log.type, occurredAt: log.occurredAt });
      logsByHabitId.set(log.habitId, existing);
    }

    const result = habits.map((habit) => {
      const logs = logsByHabitId.get(habit.id) ?? [];
      const cleanStreak = computeCleanStreak(logs, localDate);
      const longestStreak = computeLongestStreak(logs);
      return { ...habit, cleanStreak, longestStreak };
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
    res.status(500).json({ error: "Internal server error" });
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

    res.json({ ...updated, cleanStreak: computeCleanStreak(logs, localDate), longestStreak: computeLongestStreak(logs) });
  } catch (err) {
    req.log.error({ err }, "Error updating bad habit");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/bad-habits/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(badHabitsTable).where(eq(badHabitsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting bad habit");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bad-habits/:id/relapse", async (req, res) => {
  try {
    const { id } = req.params;
    const habit = await db.select().from(badHabitsTable).where(eq(badHabitsTable.id, id)).limit(1);
    if (!habit.length) return res.status(404).json({ error: "Not found" });

    const h = habit[0];
    const severity = h.severity as HabitSeverity;
    const corruptionDelta = corruptionConfig.corruptionDelta[severity];
    const xpPenalty = corruptionConfig.xpPenalty[severity];

    const todayStr = getSystemDateFromReq(req);

    const char = await getOrCreateCharacter();
    const newCorruption = Math.min(100, char.corruption + corruptionDelta);
    const newXp = Math.max(0, char.xp - xpPenalty);

    let newLevel = char.level;
    let leftoverXp = newXp;
    while (newLevel > 1 && leftoverXp < 0) {
      newLevel--;
      leftoverXp += XP_PER_LEVEL(newLevel);
    }

    await db.update(characterTable)
      .set({ corruption: newCorruption, xp: leftoverXp, level: newLevel })
      .where(eq(characterTable.id, char.id));
    invalidateCharacterCache();

    await db.insert(badHabitLogTable).values({
      habitId: id,
      date: todayStr,
      type: "relapse",
      corruptionDelta,
    });

    res.json({
      success: true,
      corruptionDelta,
      xpPenalty,
      newCorruption,
    });
  } catch (err) {
    req.log.error({ err }, "Error logging relapse");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bad-habits/record-clean-day", async (req, res) => {
  try {
    const todayStr = getSystemDateFromReq(req);
    const activeHabits = await db
      .select()
      .from(badHabitsTable)
      .where(eq(badHabitsTable.isActive, 1));

    if (!activeHabits.length) {
      return res.json({ success: true, purified: false });
    }

    const habitIds = activeHabits.map((h) => h.id);

    const allLogs = await db
      .select({ habitId: badHabitLogTable.habitId, date: badHabitLogTable.date, type: badHabitLogTable.type, occurredAt: badHabitLogTable.occurredAt })
      .from(badHabitLogTable)
      .where(inArray(badHabitLogTable.habitId, habitIds))
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

    if (toInsert.length > 0) {
      await db.insert(badHabitLogTable).values(toInsert);
      for (const row of toInsert) {
        const existing = logsByHabitId.get(row.habitId) ?? [];
        existing.unshift({ date: row.date, type: row.type, occurredAt: new Date() });
        logsByHabitId.set(row.habitId, existing);
      }
    }

    const purificationThreshold = corruptionConfig.purificationStreakDays;
    let allPurified = true;

    for (const habit of activeHabits) {
      const logs = logsByHabitId.get(habit.id) ?? [];
      const byDate = buildDateMap(logs);
      const streak = computeCleanStreakFromMap(byDate);
      if (streak < purificationThreshold) {
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
    const limit = limitParam ? Math.max(1, parseInt(String(limitParam), 10)) : 365;
    const offset = offsetParam ? Math.max(0, parseInt(String(offsetParam), 10)) : 0;

    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 365);
    windowStart.setHours(0, 0, 0, 0);

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
