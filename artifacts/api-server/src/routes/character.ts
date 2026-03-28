import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { characterTable, activityTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  GetCharacterResponse,
  UpdateCharacterBody,
  UpdateCharacterResponse,
  DailyCheckinResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const XP_PER_LEVEL = (level: number) => Math.floor(100 * Math.pow(level, 1.5));
const STREAK_MULTIPLIER = (streak: number) => {
  if (streak >= 30) return 3.0;
  if (streak >= 14) return 2.5;
  if (streak >= 7) return 2.0;
  if (streak >= 3) return 1.5;
  return 1.0;
};

const MILESTONE_STREAKS: Record<number, { xp: number; gold: number }> = {
  7: { xp: 200, gold: 500 },
  14: { xp: 350, gold: 750 },
  30: { xp: 500, gold: 1000 },
  60: { xp: 1000, gold: 2000 },
  100: { xp: 2500, gold: 5000 },
};

async function getOrCreateCharacter() {
  const chars = await db.select().from(characterTable).limit(1);
  if (chars.length > 0) return chars[0];
  const [newChar] = await db.insert(characterTable).values({ name: "Hunter" }).returning();
  return newChar;
}

async function upsertActivity(date: string) {
  const existing = await db.select().from(activityTable).where(eq(activityTable.date, date));
  if (existing.length > 0) {
    await db.update(activityTable)
      .set({ count: existing[0].count + 1, level: Math.min(4, Math.floor((existing[0].count + 1) / 2)) })
      .where(eq(activityTable.date, date));
  } else {
    await db.insert(activityTable).values({ date, count: 1, level: 1 });
  }
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

router.post("/character/checkin", async (req, res) => {
  try {
    const char = await getOrCreateCharacter();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    let alreadyCheckedIn = false;
    if (char.lastCheckin) {
      const lastDate = new Date(char.lastCheckin);
      lastDate.setHours(0, 0, 0, 0);
      if (lastDate.getTime() === today.getTime()) {
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
      const lastDate = new Date(char.lastCheckin);
      lastDate.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastDate.getTime() === yesterday.getTime()) {
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
    let newLevel = char.level;
    let newXp = char.xp + xpGain;
    while (newXp >= XP_PER_LEVEL(newLevel)) {
      newXp -= XP_PER_LEVEL(newLevel);
      newLevel++;
    }

    await db.update(characterTable)
      .set({
        streak: newStreak,
        longestStreak,
        multiplier: newMultiplier,
        lastCheckin: new Date(),
        gold: char.gold + goldGain,
        xp: newXp,
        level: newLevel,
      })
      .where(eq(characterTable.id, char.id));

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
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Error checking in");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/activity", async (req, res) => {
  try {
    const records = await db.select().from(activityTable);
    const dateMap = new Map(records.map((r) => [r.date, { count: r.count, level: r.level }]));

    const result = [];
    const today = new Date();
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
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
