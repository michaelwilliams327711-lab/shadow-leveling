import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { characterTable, activityTable, penaltyLogTable, questLogTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  GetCharacterResponse,
  UpdateCharacterBody,
  UpdateCharacterResponse,
  DailyCheckinResponse,
} from "@workspace/api-zod";
import { XP_PER_LEVEL, processLevelUp, STREAK_MULTIPLIER, MILESTONE_STREAKS, getSystemDateFromReq, getSystemDate } from "@workspace/shared";

const router: IRouter = Router();

type CharacterRow = typeof characterTable.$inferSelect;
export function invalidateCharacterCache() {
  // No-op: cache was removed to prevent race conditions on concurrent XP writes.
  // Kept for call-site compatibility; callers do not need updating.
}

async function getOrCreateCharacter(): Promise<CharacterRow> {
  const chars = await db.select().from(characterTable).limit(1);
  const char = chars.length > 0
    ? chars[0]
    : (await db.insert(characterTable).values({ name: "Hunter" }).returning())[0];
  return char;
}

async function upsertActivity(date: string) {
  await db.insert(activityTable)
    .values({ date, count: 1, level: 1 })
    .onConflictDoUpdate({
      target: activityTable.date,
      set: {
        count: sql`${activityTable.count} + 1`,
        level: sql`LEAST(4, (${activityTable.count} + 1) / 2)`,
      },
    });
}

router.get("/character", async (req, res) => {
  try {
    const char = await getOrCreateCharacter();
    const xpToNextLevel = XP_PER_LEVEL(char.level);
    const data = GetCharacterResponse.parse({
      ...char,
      xpToNextLevel,
      lastCheckin: char.lastCheckin?.toISOString() ?? null,
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Error getting character");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/character", async (req, res) => {
  try {
    const body = UpdateCharacterBody.parse(req.body);
    const char = await getOrCreateCharacter();
    const [updated] = await db.update(characterTable)
      .set({ name: body.name })
      .where(eq(characterTable.id, char.id))
      .returning();
    invalidateCharacterCache();
    const data = UpdateCharacterResponse.parse({
      ...updated,
      xpToNextLevel: XP_PER_LEVEL(updated.level),
      lastCheckin: updated.lastCheckin?.toISOString() ?? null,
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Error updating character");
    res.status(500).json({ error: "Internal server error" });
  }
});

function getLastCheckinDateStr(lastCheckin: Date): string {
  const offsetHours = parseFloat(process.env["LOCAL_TZ_OFFSET"] ?? "0");
  const offsetMs = (isNaN(offsetHours) ? 0 : offsetHours) * 3600 * 1000;
  return new Date(lastCheckin.getTime() + offsetMs).toISOString().split("T")[0];
}

router.post("/character/checkin", async (req, res) => {
  try {
    const char = await getOrCreateCharacter();
    const todayStr = getSystemDateFromReq(req);

    let alreadyCheckedIn = false;
    if (char.lastCheckin) {
      const lastCheckinDateStr = getLastCheckinDateStr(char.lastCheckin);
      if (lastCheckinDateStr === todayStr) {
        alreadyCheckedIn = true;
      }
    }

    if (alreadyCheckedIn) {
      const data = DailyCheckinResponse.parse({
        success: true,
        message: "Already checked in today. Keep pushing, Hunter.",
        streak: char.streak,
        multiplier: char.multiplier,
        alreadyCheckedIn: true,
        milestoneBonus: false,
        milestoneBonusXp: 0,
        milestoneBonusGold: 0,
      });
      return res.json(data);
    }

    let newStreak = char.streak;
    let streakBroken = false;

    if (char.lastCheckin) {
      const lastCheckinDateStr = getLastCheckinDateStr(char.lastCheckin);
      const todayDate = new Date(todayStr + "T00:00:00.000Z");
      const yesterdayDate = new Date(todayDate);
      yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
      const yesterdayStr = yesterdayDate.toISOString().split("T")[0];
      if (lastCheckinDateStr === yesterdayStr) {
        newStreak = char.streak + 1;
      } else {
        newStreak = 1;
        streakBroken = true;
      }
    } else {
      newStreak = 1;
    }

    const newMultiplier = STREAK_MULTIPLIER(newStreak);
    const longestStreak = Math.max(char.longestStreak, newStreak);

    let milestoneBonus = false;
    let milestoneBonusXp = 0;
    let milestoneBonusGold = 0;

    if (MILESTONE_STREAKS[newStreak]) {
      milestoneBonus = true;
      milestoneBonusXp = MILESTONE_STREAKS[newStreak].xp;
      milestoneBonusGold = MILESTONE_STREAKS[newStreak].gold;
    }

    const goldGain = milestoneBonusGold;
    const xpGain = milestoneBonusXp;
    const { xp: newXp, level: newLevel } = processLevelUp(char.xp + xpGain, char.level);

    await db.update(characterTable)
      .set({
        streak: newStreak,
        longestStreak,
        multiplier: newMultiplier,
        lastCheckin: new Date(todayStr + "T00:00:00.000Z"),
        gold: char.gold + goldGain,
        xp: newXp,
        level: newLevel,
      })
      .where(eq(characterTable.id, char.id));
    invalidateCharacterCache();

    await upsertActivity(todayStr);

    const message = streakBroken
      ? `Streak broken. Starting fresh at 1. The weak perish — rise again.`
      : milestoneBonus
      ? `🔥 ${newStreak}-day streak! MILESTONE BONUS: +${milestoneBonusXp} XP, +${milestoneBonusGold} Gold!`
      : `Day ${newStreak} streak. Multiplier: ${newMultiplier}x. Weakness is not an option.`;

    const data = DailyCheckinResponse.parse({
      success: true,
      message,
      streak: newStreak,
      multiplier: newMultiplier,
      alreadyCheckedIn: false,
      milestoneBonus,
      milestoneBonusXp,
      milestoneBonusGold,
      leveledUp: newLevel > char.level,
      newLevel,
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Error checking in");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/character/login", async (req, res) => {
  try {
    const char = await getOrCreateCharacter();
    const todayStr = getSystemDateFromReq(req);
    const todayStart = new Date(todayStr + "T00:00:00.000Z");

    const penalties: Array<{
      type: string;
      description: string;
      xpDeducted: number;
      goldDeducted: number;
      occurredAt: string;
    }> = [];

    let updatedChar = char;

    if (char.lastLoginDate) {
      const lastLogin = new Date(char.lastLoginDate);
      const lastLoginDateStr = lastLogin.toISOString().split("T")[0];
      const lastLoginStart = new Date(lastLoginDateStr + "T00:00:00.000Z");

      const daysDiff = Math.floor(
        (todayStart.getTime() - lastLoginStart.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff >= 2) {
        const daysMissed = daysDiff - 1;
        const xpPenalty = Math.min(char.xp, daysMissed * 50);
        const goldPenalty = Math.min(char.gold, daysMissed * 25);

        const penaltyDesc = `Missed ${daysMissed} day${daysMissed > 1 ? "s" : ""} of login — streak reset`;

        const [penaltyLog] = await db.insert(penaltyLogTable).values({
          type: "missed_day",
          description: penaltyDesc,
          xpDeducted: xpPenalty,
          goldDeducted: goldPenalty,
        }).returning();

        await db.insert(questLogTable).values({
          questName: penaltyDesc,
          category: "Penalty",
          difficulty: "D",
          outcome: "failed",
          xpChange: -xpPenalty,
          goldChange: -goldPenalty,
          multiplierApplied: 1.0,
          actionType: "MISSED_DAY",
          statCategory: null,
        });

        const [updated] = await db.update(characterTable)
          .set({
            xp: Math.max(0, char.xp - xpPenalty),
            gold: Math.max(0, char.gold - goldPenalty),
            streak: 0,
            multiplier: 1.0,
            lastLoginDate: todayStart,
          })
          .where(eq(characterTable.id, char.id))
          .returning();

        updatedChar = updated;
        invalidateCharacterCache();

        penalties.push({
          type: "missed_day",
          description: penaltyDesc,
          xpDeducted: xpPenalty,
          goldDeducted: goldPenalty,
          occurredAt: penaltyLog.occurredAt.toISOString(),
        });
      } else {
        await db.update(characterTable)
          .set({ lastLoginDate: todayStart })
          .where(eq(characterTable.id, char.id));
        invalidateCharacterCache();
      }
    } else {
      await db.update(characterTable)
        .set({ lastLoginDate: todayStart })
        .where(eq(characterTable.id, char.id));
      invalidateCharacterCache();
    }

    res.json({
      penalties,
      character: {
        ...updatedChar,
        xpToNextLevel: XP_PER_LEVEL(updatedChar.level),
        lastCheckin: updatedChar.lastCheckin?.toISOString() ?? null,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error in character login");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/activity", async (req, res) => {
  try {
    const records = await db.select().from(activityTable);
    const dateMap = new Map(records.map((r) => [r.date, { count: r.count, level: r.level }]));

    const todayStr = getSystemDateFromReq(req);
    const result = [];
    const todayDate = new Date(todayStr + "T00:00:00.000Z");
    for (let i = 363; i >= 0; i--) {
      const d = new Date(todayDate);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const entry = dateMap.get(dateStr);
      result.push({ date: dateStr, count: entry?.count ?? 0, level: entry?.level ?? 0 });
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting activity");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
export { getOrCreateCharacter, XP_PER_LEVEL, upsertActivity };
export { getSystemDateFromReq as getLocalDateStr };
