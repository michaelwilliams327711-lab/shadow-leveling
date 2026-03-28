import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { questLogTable } from "@workspace/db";
import { sql, gte } from "drizzle-orm";
import { getOrCreateCharacter, XP_PER_LEVEL } from "./character.js";

const router: IRouter = Router();

router.get("/dashboard-stats", async (req, res) => {
  try {
    const char = await getOrCreateCharacter();
    const today = new Date();

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const oneYearAgo = new Date(today);
    oneYearAgo.setDate(oneYearAgo.getDate() - 364);
    oneYearAgo.setHours(0, 0, 0, 0);

    const xpByDateRaw = await db
      .select({
        date: sql<string>`to_char(${questLogTable.occurredAt}, 'YYYY-MM-DD')`,
        xp: sql<number>`coalesce(sum(case when ${questLogTable.xpChange} > 0 then ${questLogTable.xpChange} else 0 end), 0)`,
      })
      .from(questLogTable)
      .where(gte(questLogTable.occurredAt, thirtyDaysAgo))
      .groupBy(sql`to_char(${questLogTable.occurredAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${questLogTable.occurredAt}, 'YYYY-MM-DD')`);

    const xpByDateMap = new Map(xpByDateRaw.map((r) => [r.date, Number(r.xp)]));
    const xpByDate: { date: string; xp: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      xpByDate.push({ date: dateStr, xp: xpByDateMap.get(dateStr) ?? 0 });
    }

    const xpByStatCategoryRaw = await db
      .select({
        category: questLogTable.statCategory,
        xp: sql<number>`coalesce(sum(case when ${questLogTable.xpChange} > 0 then ${questLogTable.xpChange} else 0 end), 0)`,
      })
      .from(questLogTable)
      .where(sql`${questLogTable.statCategory} is not null`)
      .groupBy(questLogTable.statCategory);

    const xpByStatCategory = xpByStatCategoryRaw.map((r) => ({
      category: r.category ?? "Other",
      xp: Number(r.xp),
    }));

    const activityCountRaw = await db
      .select({
        date: sql<string>`to_char(${questLogTable.occurredAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)`,
      })
      .from(questLogTable)
      .where(gte(questLogTable.occurredAt, oneYearAgo))
      .groupBy(sql`to_char(${questLogTable.occurredAt}, 'YYYY-MM-DD')`);

    const activityMap = new Map(activityCountRaw.map((r) => [r.date, Number(r.count)]));
    const activityCalendar: { date: string; count: number; level: number }[] = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const count = activityMap.get(dateStr) ?? 0;
      const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4;
      activityCalendar.push({ date: dateStr, count, level });
    }

    const outcomeRaw = await db
      .select({
        actionType: questLogTable.actionType,
        count: sql<number>`count(*)`,
      })
      .from(questLogTable)
      .groupBy(questLogTable.actionType);

    const outcomeBreakdown: Record<string, number> = {
      COMPLETED: 0,
      FAILED: 0,
      MISSED_DAY: 0,
      BOSS_DEFEATED: 0,
    };
    for (const row of outcomeRaw) {
      if (row.actionType && row.actionType in outcomeBreakdown) {
        outcomeBreakdown[row.actionType] = Number(row.count);
      }
    }

    res.json({
      xpByDate,
      xpByStatCategory,
      activityCalendar,
      outcomeBreakdown,
      character: {
        streak: char.streak,
        gold: char.gold,
        xp: char.xp,
        xpToNextLevel: XP_PER_LEVEL(char.level),
        level: char.level,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error getting dashboard stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
