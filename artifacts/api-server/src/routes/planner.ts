import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  questsTable,
  questLogTable,
  badHabitsTable,
  badHabitLogTable,
  dailyOrdersTable,
} from "@workspace/db";
import { eq, and, gte, lte, sql, isNull, isNotNull, or } from "drizzle-orm";
import { getLocalDateStr } from "./character.js";
import { RANK_BASE_REWARDS } from "@workspace/shared";
import { type RecurrenceConfig } from "@workspace/api-zod";
import { serializeQuest } from "./quests.js";

const router: IRouter = Router();

function dateToStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function isRecurringDueOnDate(recurrence: RecurrenceConfig, date: Date, createdAt: Date, completedAt: Date | null): boolean {
  if (recurrence.type === "none") return false;
  const targetStr = dateToStr(date);
  const target = new Date(targetStr + "T00:00:00.000Z");

  switch (recurrence.type) {
    case "daily": {
      const interval = recurrence.intervalDays ?? 1;
      const baseStr = dateToStr(completedAt ?? createdAt);
      const base = new Date(baseStr + "T00:00:00.000Z");
      const diffDays = Math.round((target.getTime() - base.getTime()) / 86400000);
      return diffDays >= 0 && diffDays % interval === 0;
    }
    case "weekly": {
      const days = recurrence.daysOfWeek ?? [];
      if (days.length === 0) return false;
      return days.includes(target.getUTCDay());
    }
    case "monthly": {
      const dom = recurrence.dayOfMonth ?? 1;
      return target.getUTCDate() === dom;
    }
    case "yearly": {
      const m = recurrence.month ?? 1;
      const d2 = recurrence.day ?? 1;
      return target.getUTCMonth() + 1 === m && target.getUTCDate() === d2;
    }
    default:
      return false;
  }
}

function isQuestDueOnDate(quest: typeof questsTable.$inferSelect, date: Date): boolean {
  const recurrence = quest.recurrence as RecurrenceConfig | null;

  if (recurrence && recurrence.type !== "none") {
    return isRecurringDueOnDate(recurrence, date, quest.createdAt, quest.completedAt);
  }

  if (quest.deadline) {
    const dStr = dateToStr(date);
    const deadlineStr = dateToStr(new Date(quest.deadline));
    return deadlineStr === dStr;
  }

  return false;
}


router.get("/planner/daily", async (req, res) => {
  try {
    const today = getLocalDateStr(req);
    const todayDate = new Date(today + "T00:00:00.000Z");

    const dayWindowStart = new Date(todayDate);
    dayWindowStart.setDate(dayWindowStart.getDate() - 1);
    const dayWindowEnd = new Date(todayDate);
    dayWindowEnd.setDate(dayWindowEnd.getDate() + 1);

    const allQuests = await db.select().from(questsTable).where(
      and(
        isNull(questsTable.deletedAt),
        or(
          and(eq(questsTable.status, "active"), isNotNull(questsTable.recurrence)),
          and(isNotNull(questsTable.deadline), gte(questsTable.deadline, dayWindowStart), lte(questsTable.deadline, dayWindowEnd)),
          and(isNotNull(questsTable.completedAt), gte(questsTable.completedAt, dayWindowStart), lte(questsTable.completedAt, dayWindowEnd)),
        ),
      ),
    );

    const [charRow] = await db
      .select({ id: sql<number>`id` })
      .from(sql`character`)
      .limit(1);

    let todayOrders: typeof dailyOrdersTable.$inferSelect[] = [];
    try {
      if (charRow) {
        todayOrders = await db
          .select()
          .from(dailyOrdersTable)
          .where(and(eq(dailyOrdersTable.date, today), eq(dailyOrdersTable.characterId, charRow.id)));
      }
    } catch {
      todayOrders = [];
    }

    let todayBadHabits: { id: string; name: string; category: string; severity: string; createdAt: string; isActive: number; todayStatus: string | null }[] = [];
    try {
      const allBadHabits = await db.select().from(badHabitsTable).where(and(eq(badHabitsTable.isActive, 1), isNull(badHabitsTable.deletedAt)));
      const badHabitLogs = await db
        .select()
        .from(badHabitLogTable)
        .where(eq(badHabitLogTable.date, today));
      todayBadHabits = allBadHabits.map((h) => {
        const log = badHabitLogs.find((l) => l.habitId === h.id);
        return {
          ...h,
          createdAt: h.createdAt.toISOString(),
          todayStatus: log?.type ?? null,
        };
      });
    } catch {
      todayBadHabits = [];
    }

    const activeQuests = allQuests.filter((q) => q.status === "active" && !q.isPaused);
    const todayQuests = activeQuests.filter((q) => isQuestDueOnDate(q, todayDate));

    const totalXpAvailable = todayQuests.reduce((sum, q) => {
      const base = RANK_BASE_REWARDS[q.difficulty]?.xp ?? 50;
      return sum + Math.floor(base + q.durationMinutes * 0.3);
    }, 0) + todayOrders.filter((o) => !o.completed).length * 25;

    const completedTodayCount = allQuests.filter((q) => {
      if (!q.completedAt) return false;
      return dateToStr(new Date(q.completedAt)) === today;
    }).length;

    res.json({
      date: today,
      quests: todayQuests.map(serializeQuest),
      dailyOrders: todayOrders.map((o) => ({
        ...o,
        completedAt: o.completedAt?.toISOString() ?? null,
        createdAt: o.createdAt.toISOString(),
      })),
      badHabits: todayBadHabits,
      totalXpAvailable,
      completedTodayCount,
      totalDueCount: todayQuests.length,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting daily planner");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/planner/weekly", async (req, res) => {
  try {
    const today = getLocalDateStr(req);
    const todayDate = new Date(today + "T00:00:00.000Z");

    const dayOfWeek = todayDate.getUTCDay();
    const weekStart = addDays(todayDate, -dayOfWeek);
    const weekEnd = addDays(weekStart, 6);

    const weekWindowStart = addDays(weekStart, -1);
    const weekWindowEnd = addDays(weekEnd, 1);

    const allQuests = await db.select().from(questsTable).where(
      and(
        isNull(questsTable.deletedAt),
        or(
          and(eq(questsTable.status, "active"), isNotNull(questsTable.recurrence)),
          and(isNotNull(questsTable.deadline), gte(questsTable.deadline, weekWindowStart), lte(questsTable.deadline, weekWindowEnd)),
          and(isNotNull(questsTable.completedAt), gte(questsTable.completedAt, weekWindowStart), lte(questsTable.completedAt, weekWindowEnd)),
        ),
      ),
    );
    const activeQuests = allQuests.filter((q) => !q.isPaused);

    const days: {
      date: string;
      dayName: string;
      quests: ReturnType<typeof serializeQuest>[];
      completedCount: number;
    }[] = [];

    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = 0; i <= 6; i++) {
      const day = addDays(weekStart, i);
      const dayStr = dateToStr(day);
      const dayQuests = activeQuests.filter((q) => {
        if (q.status === "active") return isQuestDueOnDate(q, day);
        if (q.status === "completed" && q.completedAt) {
          return dateToStr(new Date(q.completedAt)) === dayStr;
        }
        return false;
      });

      const completedCount = allQuests.filter((q) => {
        if (!q.completedAt) return false;
        return dateToStr(new Date(q.completedAt)) === dayStr;
      }).length;

      days.push({
        date: dayStr,
        dayName: DAY_NAMES[day.getDay()],
        quests: dayQuests.map(serializeQuest),
        completedCount,
      });
    }

    res.json({
      weekStart: dateToStr(weekStart),
      weekEnd: dateToStr(weekEnd),
      days,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting weekly planner");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/planner/monthly", async (req, res) => {
  try {
    const today = getLocalDateStr(req);
    const todayDate = new Date(today + "T00:00:00.000Z");

    const year = todayDate.getUTCFullYear();
    const month = todayDate.getUTCMonth();

    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));

    const monthWindowStart = addDays(monthStart, -1);
    const monthWindowEnd = addDays(monthEnd, 1);

    const allQuests = await db.select().from(questsTable).where(
      and(
        isNull(questsTable.deletedAt),
        or(
          and(eq(questsTable.status, "active"), isNotNull(questsTable.recurrence)),
          and(isNotNull(questsTable.deadline), gte(questsTable.deadline, monthWindowStart), lte(questsTable.deadline, monthWindowEnd)),
          and(isNotNull(questsTable.completedAt), gte(questsTable.completedAt, monthWindowStart), lte(questsTable.completedAt, monthWindowEnd)),
        ),
      ),
    );
    const activeQuests = allQuests.filter((q) => !q.isPaused);

    const questLogEntries = await db
      .select({
        date: sql<string>`to_char(${questLogTable.occurredAt}, 'YYYY-MM-DD')`,
        actionType: questLogTable.actionType,
        count: sql<number>`count(*)`,
      })
      .from(questLogTable)
      .where(
        and(
          gte(questLogTable.occurredAt, monthStart),
          lte(questLogTable.occurredAt, monthEnd),
        )
      )
      .groupBy(
        sql`to_char(${questLogTable.occurredAt}, 'YYYY-MM-DD')`,
        questLogTable.actionType
      );

    type DayData = {
      date: string;
      completedCount: number;
      failedCount: number;
      upcomingQuests: ReturnType<typeof serializeQuest>[];
      milestones: { name: string; type: string }[];
    };

    const questLogByDate = new Map<string, Map<string, number>>();
    for (const entry of questLogEntries) {
      let byAction = questLogByDate.get(entry.date);
      if (!byAction) {
        byAction = new Map<string, number>();
        questLogByDate.set(entry.date, byAction);
      }
      byAction.set(entry.actionType, Number(entry.count));
    }

    const daysInMonth = monthEnd.getUTCDate();
    const days: DayData[] = [];

    const upcomingByDate = new Map<string, (typeof questsTable.$inferSelect)[]>();
    const milestonesByDate = new Map<string, { name: string; type: string }[]>();

    function addToUpcoming(dayStr: string, quest: typeof questsTable.$inferSelect) {
      const existing = upcomingByDate.get(dayStr);
      if (existing) { existing.push(quest); } else { upcomingByDate.set(dayStr, [quest]); }
    }

    for (const q of activeQuests) {
      if (q.status !== "active") continue;
      const recurrence = q.recurrence as RecurrenceConfig | null;

      if (recurrence && recurrence.type !== "none") {
        switch (recurrence.type) {
          case "daily": {
            const interval = recurrence.intervalDays ?? 1;
            const base = new Date(q.completedAt ?? q.createdAt);
            base.setUTCHours(0, 0, 0, 0);
            for (let d = 1; d <= daysInMonth; d++) {
              const target = new Date(Date.UTC(year, month, d));
              const diffDays = Math.round((target.getTime() - base.getTime()) / 86400000);
              if (diffDays >= 0 && diffDays % interval === 0) {
                addToUpcoming(dateToStr(target), q);
              }
            }
            break;
          }
          case "weekly": {
            const dows = recurrence.daysOfWeek ?? [];
            if (dows.length > 0) {
              for (let d = 1; d <= daysInMonth; d++) {
                const target = new Date(Date.UTC(year, month, d));
                if (dows.includes(target.getUTCDay())) {
                  addToUpcoming(dateToStr(target), q);
                }
              }
            }
            break;
          }
          case "monthly": {
            const dom = recurrence.dayOfMonth ?? 1;
            if (dom <= daysInMonth) {
              addToUpcoming(dateToStr(new Date(Date.UTC(year, month, dom))), q);
            }
            break;
          }
          case "yearly": {
            const m = recurrence.month ?? 1;
            const dy = recurrence.day ?? 1;
            if (m === month + 1 && dy <= daysInMonth) {
              addToUpcoming(dateToStr(new Date(Date.UTC(year, month, dy))), q);
            }
            break;
          }
        }
      } else if (q.deadline) {
        const deadlineStr = dateToStr(new Date(q.deadline));
        const deadlineDate = new Date(q.deadline);
        if (deadlineDate.getUTCFullYear() === year && deadlineDate.getUTCMonth() === month) {
          addToUpcoming(deadlineStr, q);
        }
      }
    }

    for (const q of allQuests) {
      if (q.deadline && q.status === "active") {
        const dStr = dateToStr(new Date(q.deadline));
        const existing = milestonesByDate.get(dStr) ?? [];
        existing.push({ name: q.name, type: "deadline" });
        milestonesByDate.set(dStr, existing);
      }
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(Date.UTC(year, month, d));
      const dayStr = dateToStr(dayDate);

      const byAction = questLogByDate.get(dayStr);
      const completedCount = byAction?.get("COMPLETED") ?? 0;
      const failedCount = byAction?.get("FAILED") ?? 0;

      const upcomingQuests = (upcomingByDate.get(dayStr) ?? []).map(serializeQuest);
      const milestones = milestonesByDate.get(dayStr) ?? [];

      days.push({
        date: dayStr,
        completedCount: Number(completedCount),
        failedCount: Number(failedCount),
        upcomingQuests,
        milestones,
      });
    }

    res.json({
      year,
      month: month + 1,
      monthName: todayDate.toLocaleString("en-US", { month: "long" }),
      today,
      days,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting monthly planner");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/planner/yearly", async (req, res) => {
  try {
    const today = getLocalDateStr(req);
    const todayDate = new Date(today + "T00:00:00.000Z");
    const year = todayDate.getUTCFullYear();

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    const questLogEntries = await db
      .select({
        date: sql<string>`to_char(${questLogTable.occurredAt}, 'YYYY-MM-DD')`,
        actionType: questLogTable.actionType,
        xpChange: sql<number>`sum(${questLogTable.xpChange})`,
        count: sql<number>`count(*)`,
      })
      .from(questLogTable)
      .where(and(gte(questLogTable.occurredAt, yearStart), lte(questLogTable.occurredAt, yearEnd)))
      .groupBy(
        sql`to_char(${questLogTable.occurredAt}, 'YYYY-MM-DD')`,
        questLogTable.actionType
      );

    const dateMap = new Map<string, { completedCount: number; failedCount: number; xpGained: number }>();
    for (const row of questLogEntries) {
      const existing = dateMap.get(row.date) ?? { completedCount: 0, failedCount: 0, xpGained: 0 };
      if (row.actionType === "COMPLETED" || row.actionType === "BOSS_DEFEATED") {
        existing.completedCount += Number(row.count);
        existing.xpGained += Number(row.xpChange) > 0 ? Number(row.xpChange) : 0;
      } else if (row.actionType === "FAILED" || row.actionType === "MISSED_DAY") {
        existing.failedCount += Number(row.count);
      }
      dateMap.set(row.date, existing);
    }

    const heatmapDays: {
      date: string;
      completedCount: number;
      failedCount: number;
      xpGained: number;
      level: number;
    }[] = [];

    for (let d = new Date(yearStart); d <= yearEnd; d = addDays(d, 1)) {
      const dateStr = dateToStr(d);
      const data = dateMap.get(dateStr) ?? { completedCount: 0, failedCount: 0, xpGained: 0 };
      const level =
        data.completedCount === 0 ? 0 :
        data.completedCount <= 1 ? 1 :
        data.completedCount <= 3 ? 2 :
        data.completedCount <= 5 ? 3 : 4;
      heatmapDays.push({ date: dateStr, ...data, level });
    }

    const keyEvents: {
      date: string;
      type: "boss_defeated" | "high_xp_day" | "streak_milestone";
      label: string;
      xp?: number;
    }[] = [];

    const bossDefeats = await db
      .select({
        date: sql<string>`to_char(${questLogTable.occurredAt}, 'YYYY-MM-DD')`,
        questName: questLogTable.questName,
      })
      .from(questLogTable)
      .where(
        and(
          gte(questLogTable.occurredAt, yearStart),
          lte(questLogTable.occurredAt, yearEnd),
          eq(questLogTable.actionType, "BOSS_DEFEATED")
        )
      )
      .orderBy(questLogTable.occurredAt);

    for (const boss of bossDefeats) {
      keyEvents.push({
        date: boss.date,
        type: "boss_defeated",
        label: `Boss Defeated: ${boss.questName}`,
      });
    }

    for (const [date, data] of dateMap) {
      if (data.xpGained >= 500) {
        keyEvents.push({
          date,
          type: "high_xp_day",
          label: `${data.xpGained} XP earned`,
          xp: data.xpGained,
        });
      }
    }

    keyEvents.sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      year,
      today,
      heatmapDays,
      keyEvents,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting yearly planner");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/planner/quest/:id/reschedule", async (req, res) => {
  try {
    const questId = parseInt(req.params.id, 10);
    if (isNaN(questId)) {
      res.status(400).json({ error: "Invalid quest id" });
      return;
    }

    const body = req.body as { newDeadline: string };
    if (!body.newDeadline) {
      res.status(400).json({ error: "newDeadline is required" });
      return;
    }

    const newDeadline = new Date(body.newDeadline + "T00:00:00.000Z");
    if (isNaN(newDeadline.getTime())) {
      res.status(400).json({ error: "Invalid date" });
      return;
    }

    const [quest] = await db
      .select()
      .from(questsTable)
      .where(eq(questsTable.id, questId))
      .limit(1);

    if (!quest) {
      res.status(404).json({ error: "Quest not found" });
      return;
    }

    if (quest.status !== "active") {
      res.status(400).json({ error: "Can only reschedule active quests" });
      return;
    }

    const [updated] = await db
      .update(questsTable)
      .set({ deadline: newDeadline })
      .where(eq(questsTable.id, questId))
      .returning();

    res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      completedAt: updated.completedAt?.toISOString() ?? null,
      deadline: updated.deadline?.toISOString() ?? null,
    });
  } catch (err) {
    throw err;
  }
});

export default router;
