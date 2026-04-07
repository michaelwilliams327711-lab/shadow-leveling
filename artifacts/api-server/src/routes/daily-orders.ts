import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { dailyOrdersTable, questLogTable, characterTable, dailyHiddenBoxRewardsTable, penaltyLogTable } from "@workspace/db";
import { eq, and, sql, isNull, inArray } from "drizzle-orm";
import { getOrCreateCharacter, XP_PER_LEVEL, upsertActivity, getLocalDateStr, invalidateCharacterCache } from "./character.js";
import { processLevelUp } from "@workspace/shared";
import { getActiveRngEvent } from "./rng.js";

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
          eq(dailyOrdersTable.date, today),
          isNull(dailyOrdersTable.deletedAt)
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

    await db.update(dailyOrdersTable).set({ deletedAt: new Date() }).where(eq(dailyOrdersTable.id, id));
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
    if (order.completed) return res.status(409).json({ error: "Order already completed" });

    const statCategory = isValidStatField(order.statCategory) ? order.statCategory : "discipline";

    const multiplier = char.multiplier ?? 1.0;
    const activeEvent = getActiveRngEvent(today);
    const eventBonus = activeEvent ? activeEvent.multiplierBonus : 0;
    const totalMultiplier = multiplier * (1 + eventBonus);
    const xpAwarded = Math.floor(E_RANK_XP * totalMultiplier);
    const { xp: newXp, level: newLevel } = processLevelUp(char.xp + xpAwarded, char.level);
    const leveledUp = newLevel > char.level;

    const streakResetFields = char.failStreak > 0
      ? { failStreak: 0, penaltyMultiplier: 1.0 }
      : {};

    // F-001: Each stat uses a SQL increment expression targeting only the relevant
    // stat column. This prevents concurrent writes from clobbering a value that was
    // computed from a stale in-memory snapshot.
    // F-006: totalQuestsCompleted also increments atomically via SQL.
    // P-003: completedCount is queried INSIDE the transaction so the count reflects
    // the committed row before any concurrent writer can interfere.
    const [updatedOrder, updatedChar, completedCount] = await db.transaction(async (tx) => {
      const orderResult = await tx
        .update(dailyOrdersTable)
        .set({ completed: true, completedAt: new Date() })
        .where(and(eq(dailyOrdersTable.id, id), eq(dailyOrdersTable.completed, false)))
        .returning();

      if (orderResult.length === 0) {
        throw Object.assign(new Error("Order already completed"), { code: "ALREADY_COMPLETED_ORDER" });
      }

      const [updated] = await tx
        .update(characterTable)
        .set({
          xp: newXp,
          level: newLevel,
          strength:   sql`${characterTable.strength}   + ${statCategory === "strength"   ? DAILY_ORDER_STAT_GAIN : 0}`,
          intellect:  sql`${characterTable.intellect}  + ${statCategory === "intellect"  ? DAILY_ORDER_STAT_GAIN : 0}`,
          endurance:  sql`${characterTable.endurance}  + ${statCategory === "endurance"  ? DAILY_ORDER_STAT_GAIN : 0}`,
          agility:    sql`${characterTable.agility}    + ${statCategory === "agility"    ? DAILY_ORDER_STAT_GAIN : 0}`,
          discipline: sql`${characterTable.discipline} + ${statCategory === "discipline" ? DAILY_ORDER_STAT_GAIN : 0}`,
          totalQuestsCompleted: sql`${characterTable.totalQuestsCompleted} + 1`,
          ...streakResetFields,
        })
        .where(eq(characterTable.id, char.id))
        .returning();

      const completedTodayCount = await tx
        .select({ count: sql<number>`count(*)` })
        .from(dailyOrdersTable)
        .where(
          and(
            eq(dailyOrdersTable.characterId, char.id),
            eq(dailyOrdersTable.date, today),
            eq(dailyOrdersTable.completed, true)
          )
        );
      const count = Number(completedTodayCount[0]?.count ?? 0);

      return [orderResult[0], updated, count] as const;
    });

    invalidateCharacterCache();

    await db.insert(questLogTable).values({
      questName: `Daily Order: ${order.name}`,
      category: "Daily",
      difficulty: "E",
      outcome: "completed",
      xpChange: xpAwarded,
      goldChange: 0,
      multiplierApplied: totalMultiplier,
      actionType: "COMPLETED",
      statCategory,
    });

    await upsertActivity(today);

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
    if ((err as NodeJS.ErrnoException).code === "ALREADY_COMPLETED_ORDER") {
      return res.status(409).json({ error: "Order already completed" });
    }
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
      const goldBonus = pendingBox.goldBonus;
      const [withGold] = await db
        .update(characterTable)
        .set({ gold: sql`${characterTable.gold} + ${goldBonus}` })
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
      const boost = pendingBox.statBoost;

      // F-002: Single-stat SQL increment — no absolute-value object needed.
      // Only the target stat column is updated; others are left untouched.
      const [withBoost] = await db
        .update(characterTable)
        .set({
          strength:   sql`${characterTable.strength}   + ${stat === "strength"   ? boost : 0}`,
          intellect:  sql`${characterTable.intellect}  + ${stat === "intellect"  ? boost : 0}`,
          endurance:  sql`${characterTable.endurance}  + ${stat === "endurance"  ? boost : 0}`,
          agility:    sql`${characterTable.agility}    + ${stat === "agility"    ? boost : 0}`,
          discipline: sql`${characterTable.discipline} + ${stat === "discipline" ? boost : 0}`,
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
          eq(dailyOrdersTable.completed, false),
          isNull(dailyOrdersTable.deletedAt)
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
    const staleIds = staleOrders.map((o) => o.id);

    await db.transaction(async (tx) => {
      const deleted = await tx
        .update(dailyOrdersTable)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(dailyOrdersTable.characterId, char.id),
            inArray(dailyOrdersTable.id, staleIds),
            isNull(dailyOrdersTable.deletedAt)
          )
        )
        .returning({ id: dailyOrdersTable.id });

      if (deleted.length === 0) return;

      // F-007: Use GREATEST(1, ...) — stats must never fall to 0.
      // All other penalty handlers (quests fail/overdue) use the same floor of 1.
      await tx
        .update(characterTable)
        .set({
          xp:         sql`GREATEST(0, ${characterTable.xp}         - ${totalXpDeducted})`,
          strength:   sql`GREATEST(1, ${characterTable.strength}   - ${statDeductions.strength})`,
          agility:    sql`GREATEST(1, ${characterTable.agility}    - ${statDeductions.agility})`,
          endurance:  sql`GREATEST(1, ${characterTable.endurance}  - ${statDeductions.endurance})`,
          intellect:  sql`GREATEST(1, ${characterTable.intellect}  - ${statDeductions.intellect})`,
          discipline: sql`GREATEST(1, ${characterTable.discipline} - ${statDeductions.discipline})`,
        })
        .where(eq(characterTable.id, char.id));
    });

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

    res.json({ success: true, expiredCount: staleOrders.length, xpDeducted: totalXpDeducted });
  } catch (err) {
    req.log.error({ err }, "Error expiring stale daily orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
