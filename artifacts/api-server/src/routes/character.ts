import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { characterTable, activityTable, penaltyLogTable, questLogTable } from "@workspace/db";
import { eq, sql, gte } from "drizzle-orm";
import {
  GetCharacterResponse,
  UpdateCharacterBody,
  UpdateCharacterResponse,
  DailyCheckinResponse,
} from "@workspace/api-zod";
import { XP_PER_LEVEL, processLevelUp, STREAK_MULTIPLIER, MILESTONE_STREAKS, getSystemDateFromReq, getSystemDate } from "@workspace/shared";

const router: IRouter = Router();

type CharacterRow = typeof characterTable.$inferSelect;

export function invalidateCharacterCache(): void {
  // No-op: in-memory cache removed (P-002). PostgreSQL PK lookups are ~1ms
  // and stateless reads ensure cross-device consistency with no TTL lag.
}

// F-004: Serialize character init with a PostgreSQL advisory lock to prevent
// concurrent INSERT races on the very first request. Key 9001 is an arbitrary
// stable application-level mutex — any fixed bigint works.
export async function getOrCreateCharacter(): Promise<CharacterRow> {
  const char = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(9001)`);
    const rows = await tx.select().from(characterTable).limit(1);
    if (rows.length > 0) return rows[0];
    const [created] = await tx.insert(characterTable).values({ name: "Hunter" }).returning();
    return created;
  });
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

const DEFAULT_TZ_OFFSET_HOURS = -5;

function getLocalTzOffsetMs(): number {
  const offsetHours = parseFloat(process.env["LOCAL_TZ_OFFSET"] ?? String(DEFAULT_TZ_OFFSET_HOURS));
  return (isNaN(offsetHours) ? DEFAULT_TZ_OFFSET_HOURS : offsetHours) * 3600 * 1000;
}

function getLastCheckinDateStr(lastCheckin: Date): string {
  // lastCheckin is stored as midnight UTC of the local calendar date
  // (e.g. "2026-04-03T00:00:00Z" for local date "2026-04-03").
  // The UTC date IS already the correct local date — no offset adjustment needed.
  return lastCheckin.toISOString().split("T")[0];
}

function getLocalDateStrFromTimestamp(ts: Date): string {
  return new Date(ts.getTime() + getLocalTzOffsetMs()).toISOString().split("T")[0];
}

// F-005: The entire check-then-update is wrapped in a transaction with a
// SELECT FOR UPDATE lock. This prevents two concurrent checkin requests from
// both passing the already-checked-in guard and double-incrementing the streak.
router.post("/character/checkin", async (req, res) => {
  try {
    const todayStr = getSystemDateFromReq(req);

    type TxResult = {
      alreadyCheckedIn: boolean;
      streak: number;
      multiplier: number;
      milestoneBonus: boolean;
      milestoneBonusXp: number;
      milestoneBonusGold: number;
      leveledUp?: boolean;
      newLevel?: number;
      streakBroken?: boolean;
    };

    const result = await db.transaction(async (tx) => {
      const [char] = await tx.select().from(characterTable).limit(1).for("update");
      if (!char) throw new Error("No character found");

      if (char.lastCheckin) {
        const lastCheckinDateStr = getLastCheckinDateStr(char.lastCheckin);
        if (lastCheckinDateStr === todayStr) {
          return {
            alreadyCheckedIn: true,
            streak: char.streak,
            multiplier: char.multiplier,
            milestoneBonus: false,
            milestoneBonusXp: 0,
            milestoneBonusGold: 0,
          } as TxResult;
        }
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

      await tx.update(characterTable)
        .set({
          streak: newStreak,
          longestStreak,
          multiplier: newMultiplier,
          lastCheckin: new Date(todayStr + "T00:00:00.000Z"),
          gold: sql`${characterTable.gold} + ${goldGain}`,
          xp: newXp,
          level: newLevel,
        })
        .where(eq(characterTable.id, char.id));

      return {
        alreadyCheckedIn: false,
        streak: newStreak,
        multiplier: newMultiplier,
        milestoneBonus,
        milestoneBonusXp,
        milestoneBonusGold,
        leveledUp: newLevel > char.level,
        newLevel,
        streakBroken,
      } as TxResult;
    });

    invalidateCharacterCache();

    if (result.alreadyCheckedIn) {
      const data = DailyCheckinResponse.parse({
        success: true,
        message: "Already checked in today. Keep pushing, Hunter.",
        streak: result.streak,
        multiplier: result.multiplier,
        alreadyCheckedIn: true,
        milestoneBonus: false,
        milestoneBonusXp: 0,
        milestoneBonusGold: 0,
      });
      return res.json(data);
    }

    await upsertActivity(todayStr);

    const message = result.streakBroken
      ? `Streak broken. Starting fresh at 1. The weak perish — rise again.`
      : result.milestoneBonus
      ? `🔥 ${result.streak}-day streak! MILESTONE BONUS: +${result.milestoneBonusXp} XP, +${result.milestoneBonusGold} Gold!`
      : `Day ${result.streak} streak. Multiplier: ${result.multiplier}x. Weakness is not an option.`;

    const data = DailyCheckinResponse.parse({
      success: true,
      message,
      streak: result.streak,
      multiplier: result.multiplier,
      alreadyCheckedIn: false,
      milestoneBonus: result.milestoneBonus,
      milestoneBonusXp: result.milestoneBonusXp,
      milestoneBonusGold: result.milestoneBonusGold,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
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
        // F-008: Compute penalty amounts for log accuracy, but write via
        // SQL GREATEST(0, ...) so the update is safe against concurrent edits.
        const xpPenaltyRaw = daysMissed * 50;
        const goldPenaltyRaw = daysMissed * 25;
        const xpPenaltyForLog = Math.min(char.xp, xpPenaltyRaw);
        const goldPenaltyForLog = Math.min(char.gold, goldPenaltyRaw);

        const penaltyDesc = `Missed ${daysMissed} day${daysMissed > 1 ? "s" : ""} of login — streak reset`;

        const [penaltyLog] = await db.insert(penaltyLogTable).values({
          type: "missed_day",
          description: penaltyDesc,
          xpDeducted: xpPenaltyForLog,
          goldDeducted: goldPenaltyForLog,
        }).returning();

        await db.insert(questLogTable).values({
          questName: penaltyDesc,
          category: "Penalty",
          difficulty: "D",
          outcome: "failed",
          xpChange: -xpPenaltyForLog,
          goldChange: -goldPenaltyForLog,
          multiplierApplied: 1.0,
          actionType: "MISSED_DAY",
          statCategory: null,
        });

        // F-008: Atomic SQL write — no stale-cache absolute values.
        const [updated] = await db.update(characterTable)
          .set({
            xp: sql`GREATEST(0, ${characterTable.xp} - ${xpPenaltyRaw})`,
            gold: sql`GREATEST(0, ${characterTable.gold} - ${goldPenaltyRaw})`,
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
          xpDeducted: xpPenaltyForLog,
          goldDeducted: goldPenaltyForLog,
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
    const todayStr = getSystemDateFromReq(req);
    const todayDate = new Date(todayStr + "T00:00:00.000Z");
    const windowStart = new Date(todayDate);
    windowStart.setUTCDate(windowStart.getUTCDate() - 363);
    const windowStartStr = windowStart.toISOString().split("T")[0];

    const records = await db.select().from(activityTable).where(gte(activityTable.date, windowStartStr));
    const dateMap = new Map(records.map((r) => [r.date, { count: r.count, level: r.level }]));

    const result = [];
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
export { XP_PER_LEVEL, upsertActivity };
export { getSystemDateFromReq as getLocalDateStr };
