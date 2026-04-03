import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { dailyOrdersTable, questLogTable, characterTable, dailyHiddenBoxRewardsTable, penaltyLogTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { getOrCreateCharacter, XP_PER_LEVEL, upsertActivity, getLocalDateStr, invalidateCharacterCache } from "./character.js";
import { processLevelUp } from "@workspace/shared";

type CharacterRow = Awaited<ReturnType<typeof getOrCreateCharacter>>;

declare global {
  namespace Express {
    interface Request {
      character?: CharacterRow;
    }
  }
}

const router: IRouter = Router();

const E_RANK_XP = 25;
const DAILY_ORDER_STAT_GAIN = 1;

const HIDDEN_BOX_GOLD_MIN = 50;
const HIDDEN_BOX_GOLD_MAX = 150;
const HIDDEN_BOX_STAT_BOOST = 3;

const CHARACTER_STAT_FIELDS = ["strength", "agility", "endurance", "intellect", "discipline"] as const;
type StatField = typeof CHARACTER_STAT_FIELDS[number];

function isValidStatField(s: string): s is StatField {
  return CHARACTER_STAT_FIELDS.includes(s as StatField);
}

function parseCreateDailyOrderBody(body: unknown): { name: string; statCategory: StatField } {
  if (!body || typeof body !== "object") throw new Error("Invalid body");
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name || name.length > 200) throw new Error("Invalid name");
  const statCategory = typeof b.statCategory === "string" && isValidStatField(b.statCategory)
    ? b.statCategory
    : "discipline";
  return { name, statCategory };
}

function rollHiddenBox(): { type: "gold" | "stat_boost"; goldBonus?: number; statBoost?: number; stat?: string } {
  const isGold = Math.random() < 0.5;
  if (isGold) {
    const goldBonus = Math.floor(Math.random() * (HIDDEN_BOX_GOLD_MAX - HIDDEN_BOX_GOLD_MIN + 1)) + HIDDEN_BOX_GOLD_MIN;
    return { type: "gold", goldBonus };
  }
  // Design intent: Hidden Box stat_boost targets a random stat from all five CHARACTER_STAT_FIELDS.
  // This prevents the player from influencing which stat grows by controlling the last order's category.
  const randomStat = CHARACTER_STAT_FIELDS[Math.floor(Math.random() * CHARACTER_STAT_FIELDS.length)];
  return { type: "stat_boost", statBoost: HIDDEN_BOX_STAT_BOOST, stat: randomStat };
}

async function resolveCharacter(req: Request, res: Response, next: NextFunction) {
  try {
    req.character = await getOrCreateCharacter();
    next();
  } catch (err) {
    req.log.error({ err }, "Error resolving character");
    res.status(500).json({ error: "Internal server error" });
  }
}

router.use(resolveCharacter);

router.post("/daily-orders", async (req, res) => {
  try {
    const body = parseCreateDailyOrderBody(req.body);
    const char = req.character!;
    const today = getLocalDateStr(req);

    const [order] = await db.insert(dailyOrdersTable).values({
      characterId: char.id,
      name: body.name,
      statCategory: body.statCategory,
      date: today,
    }).returning();

    res.status(201).json(order);
  } catch (err) {
    req.log.error({ err }, "Error creating daily order");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/daily-orders/today", async (req, res) => {
  try {
    const char = req.character!;
    const today = getLocalDateStr(req);

    const orders = await db
      .select()
      .from(dailyOrdersTable)
      .where(
        and(
          eq(dailyOrdersTable.characterId, char.id),
          eq(dailyOrdersTable.date, today)
        )
      )
      .orderBy(dailyOrdersTable.createdAt);

    const pendingBox = await db
      .select()
      .from(dailyHiddenBoxRewardsTable)
      .where(
        and(
          eq(dailyHiddenBoxRewardsTable.characterId, char.id),
          eq(dailyHiddenBoxRewardsTable.date, today),
          eq(dailyHiddenBoxRewardsTable.claimed, false)
        )
      )
      .limit(1);

    res.json({
      orders,
      pendingHiddenBox: pendingBox[0] ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching today's daily orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/daily-orders/:id", async (req, res) => {
  try {
    const char = req.character!;
    const { id } = req.params;

    const [order] = await db
      .select()
      .from(dailyOrdersTable)
      .where(and(eq(dailyOrdersTable.id, id), eq(dailyOrdersTable.characterId, char.id)));

    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.completed) return res.status(400).json({ error: "Cannot delete a completed order" });

    await db.delete(dailyOrdersTable).where(eq(dailyOrdersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting daily order");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/daily-orders/:id/complete", async (req, res) => {
  try {
    const char = req.character!;
    const { id } = req.params;
    const today = getLocalDateStr(req);

    const [order] = await db
      .select()
      .from(dailyOrdersTable)
      .where(and(eq(dailyOrdersTable.id, id), eq(dailyOrdersTable.characterId, char.id)));

    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.completed) return res.status(400).json({ error: "Order already completed" });

    const [updatedOrder] = await db
      .update(dailyOrdersTable)
      .set({ completed: true, completedAt: new Date() })
      .where(eq(dailyOrdersTable.id, id))
      .returning();

    const statCategory = isValidStatField(order.statCategory) ? order.statCategory : "discipline";

    const statUpdates: Record<string, number> = {
      strength: char.strength,
      intellect: char.intellect,
      endurance: char.endurance,
      agility: char.agility,
      discipline: char.discipline,
    };
    statUpdates[statCategory] = (statUpdates[statCategory] ?? 10) + DAILY_ORDER_STAT_GAIN;

    const multiplier = char.multiplier ?? 1.0;
    const xpAwarded = Math.floor(E_RANK_XP * multiplier);
    const { xp: newXp, level: newLevel } = processLevelUp(char.xp + xpAwarded, char.level);
    const leveledUp = newLevel > char.level;

    const streakResetFields = char.failStreak > 0
      ? { failStreak: 0, penaltyMultiplier: 1.0 }
      : {};

    const [updatedChar] = await db
      .update(characterTable)
      .set({
        xp: newXp,
        level: newLevel,
        strength: statUpdates.strength,
        intellect: statUpdates.intellect,
        endurance: statUpdates.endurance,
        agility: statUpdates.agility,
        discipline: statUpdates.discipline,
        totalQuestsCompleted: char.totalQuestsCompleted + 1,
        ...streakResetFields,
      })
      .where(eq(characterTable.id, char.id))
      .returning();

    invalidateCharacterCache();

    await db.insert(questLogTable).values({
      questName: `Daily Order: ${order.name}`,
      category: "Daily",
      difficulty: "E",
      outcome: "completed",
      xpChange: xpAwarded,
      goldChange: 0,
      multiplierApplied: multiplier,
      actionType: "COMPLETED",
      statCategory,
    });

    await upsertActivity(today);

    const completedTodayCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(dailyOrdersTable)
      .where(
        and(
          eq(dailyOrdersTable.characterId, char.id),
          eq(dailyOrdersTable.date, today),
          eq(dailyOrdersTable.completed, true)
        )
      );
    const completedCount = Number(completedTodayCount[0]?.count ?? 0);

    let pendingHiddenBox: { id: number; type: string; goldBonus: number | null; statBoost: number | null; stat: string | null } | null = null;

    if (completedCount === 5) {
      const existingBox = await db
        .select()
        .from(dailyHiddenBoxRewardsTable)
        .where(
          and(
            eq(dailyHiddenBoxRewardsTable.characterId, char.id),
            eq(dailyHiddenBoxRewardsTable.date, today)
          )
        )
        .limit(1);

      if (!existingBox[0]) {
        const rolled = rollHiddenBox();
        const [savedBox] = await db
          .insert(dailyHiddenBoxRewardsTable)
          .values({
            characterId: char.id,
            date: today,
            type: rolled.type,
            goldBonus: rolled.goldBonus ?? null,
            statBoost: rolled.statBoost ?? null,
            stat: rolled.stat ?? null,
            claimed: false,
          })
          .returning();
        pendingHiddenBox = savedBox;
      } else if (!existingBox[0].claimed) {
        pendingHiddenBox = existingBox[0];
      }
    }

    res.json({
      success: true,
      order: updatedOrder,
      xpAwarded,
      statGain: DAILY_ORDER_STAT_GAIN,
      leveledUp,
      completedCount,
      pendingHiddenBox,
      character: {
        ...updatedChar,
        xpToNextLevel: XP_PER_LEVEL(updatedChar.level),
        lastCheckin: updatedChar.lastCheckin?.toISOString() ?? null,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error completing daily order");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/daily-orders/claim-hidden-box", async (req, res) => {
  try {
    const char = req.character!;
    const today = getLocalDateStr(req);

    const pendingBoxes = await db
      .select()
      .from(dailyHiddenBoxRewardsTable)
      .where(
        and(
          eq(dailyHiddenBoxRewardsTable.characterId, char.id),
          eq(dailyHiddenBoxRewardsTable.date, today),
          eq(dailyHiddenBoxRewardsTable.claimed, false)
        )
      )
      .limit(1);

    const pendingBox = pendingBoxes[0];
    if (!pendingBox) {
      return res.status(404).json({ error: "No pending hidden box reward found" });
    }

    const [claimed] = await db
      .update(dailyHiddenBoxRewardsTable)
      .set({ claimed: true, claimedAt: new Date() })
      .where(and(eq(dailyHiddenBoxRewardsTable.id, pendingBox.id), eq(dailyHiddenBoxRewardsTable.claimed, false)))
      .returning();

    if (!claimed) {
      return res.status(409).json({ error: "Hidden box already claimed" });
    }

    let finalChar = char;

    if (pendingBox.type === "gold" && pendingBox.goldBonus && pendingBox.goldBonus > 0) {
      const [withGold] = await db
        .update(characterTable)
        .set({ gold: char.gold + pendingBox.goldBonus })
        .where(eq(characterTable.id, char.id))
        .returning();
      finalChar = withGold;

      await db.insert(questLogTable).values({
        questName: "Daily Orders: Hidden Box (Gold Bonus)",
        category: "Daily",
        difficulty: "E",
        outcome: "completed",
        xpChange: 0,
        goldChange: pendingBox.goldBonus,
        multiplierApplied: 1.0,
        actionType: "COMPLETED",
        statCategory: "discipline",
      });
    } else if (pendingBox.type === "stat_boost" && pendingBox.stat && pendingBox.statBoost && pendingBox.statBoost > 0) {
      const stat = isValidStatField(pendingBox.stat) ? pendingBox.stat : "discipline";
      const boostUpdates: Record<string, number> = {
        strength: char.strength,
        intellect: char.intellect,
        endurance: char.endurance,
        agility: char.agility,
        discipline: char.discipline,
      };
      boostUpdates[stat] = (boostUpdates[stat] ?? 10) + pendingBox.statBoost;

      const [withBoost] = await db
        .update(characterTable)
        .set({
          strength: boostUpdates.strength,
          intellect: boostUpdates.intellect,
          endurance: boostUpdates.endurance,
          agility: boostUpdates.agility,
          discipline: boostUpdates.discipline,
        })
        .where(eq(characterTable.id, char.id))
        .returning();
      finalChar = withBoost;

      await db.insert(questLogTable).values({
        questName: `Daily Orders: Hidden Box (${stat} +${pendingBox.statBoost})`,
        category: "Daily",
        difficulty: "E",
        outcome: "completed",
        xpChange: 0,
        goldChange: 0,
        multiplierApplied: 1.0,
        actionType: "COMPLETED",
        statCategory: stat,
      });
    }

    invalidateCharacterCache();

    res.json({
      success: true,
      character: {
        ...finalChar,
        xpToNextLevel: XP_PER_LEVEL(finalChar.level),
        lastCheckin: finalChar.lastCheckin?.toISOString() ?? null,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error claiming hidden box");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/daily-orders/expire-stale", async (req, res) => {
  try {
    const char = req.character!;
    const today = getLocalDateStr(req);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    const lowerBound = thirtyDaysAgo.toISOString().split("T")[0];

    const staleOrders = await db
      .select()
      .from(dailyOrdersTable)
      .where(
        and(
          eq(dailyOrdersTable.characterId, char.id),
          sql`${dailyOrdersTable.date} >= ${lowerBound}`,
          sql`${dailyOrdersTable.date} < ${today}`,
          eq(dailyOrdersTable.completed, false)
        )
      );

    if (staleOrders.length === 0) {
      return res.json({ success: true, expiredCount: 0, xpDeducted: 0 });
    }

    const statDeductions: Record<string, number> = {
      strength: 0,
      agility: 0,
      endurance: 0,
      intellect: 0,
      discipline: 0,
    };

    for (const order of staleOrders) {
      const stat = isValidStatField(order.statCategory) ? order.statCategory : "discipline";
      statDeductions[stat] = (statDeductions[stat] ?? 0) + DAILY_ORDER_STAT_GAIN;
    }

    const totalXpDeducted = staleOrders.length * E_RANK_XP;
    const newXp = Math.max(0, char.xp - totalXpDeducted);

    const newStats = {
      strength: Math.max(0, char.strength - statDeductions.strength),
      agility: Math.max(0, char.agility - statDeductions.agility),
      endurance: Math.max(0, char.endurance - statDeductions.endurance),
      intellect: Math.max(0, char.intellect - statDeductions.intellect),
      discipline: Math.max(0, char.discipline - statDeductions.discipline),
    };

    await db
      .update(characterTable)
      .set({ xp: newXp, ...newStats })
      .where(eq(characterTable.id, char.id));

    invalidateCharacterCache();

    const questLogEntries = staleOrders.map((order) => ({
      questName: `Daily Order: ${order.name}`,
      category: "Daily",
      difficulty: "E",
      outcome: "failed",
      xpChange: -E_RANK_XP,
      goldChange: 0,
      multiplierApplied: 1.0,
      actionType: "FAILED",
      statCategory: isValidStatField(order.statCategory) ? order.statCategory : "discipline",
    }));

    await db.insert(questLogTable).values(questLogEntries);

    await db.insert(penaltyLogTable).values({
      type: "daily_order_expired",
      description: `${staleOrders.length} uncompleted daily order(s) expired`,
      xpDeducted: totalXpDeducted,
      goldDeducted: 0,
    });

    await db
      .delete(dailyOrdersTable)
      .where(
        and(
          eq(dailyOrdersTable.characterId, char.id),
          sql`${dailyOrdersTable.date} >= ${lowerBound}`,
          sql`${dailyOrdersTable.date} < ${today}`,
          eq(dailyOrdersTable.completed, false)
        )
      );

    res.json({ success: true, expiredCount: staleOrders.length, xpDeducted: totalXpDeducted });
  } catch (err) {
    req.log.error({ err }, "Error expiring stale daily orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
