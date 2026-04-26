import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { rewardsTable, characterTable, shopItemsTable, shopPurchasesTable, questLogTable } from "@workspace/db";
import { eq, isNull, sql, asc, desc } from "drizzle-orm";
import { CreateRewardBody } from "@workspace/api-zod";
import { getOrCreateCharacter, invalidateCharacterCache } from "./character.js";

const router: IRouter = Router();

// ----- Shadow Shop (seeded items) -----

router.get("/shop", async (req, res) => {
  try {
    const items = await db.select().from(shopItemsTable).orderBy(asc(shopItemsTable.cost));
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Error listing shop items");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/shop/purchase/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Invalid item ID" });
    }

    const char = await getOrCreateCharacter();

    let result: { newGold: number; itemName: string; cost: number } | null = null;
    let itemNotFound = false;
    let insufficientGold = false;
    let currentGold = char.gold;

    await db.transaction(async (tx) => {
      const [item] = await tx.select().from(shopItemsTable).where(eq(shopItemsTable.id, id));
      if (!item) {
        itemNotFound = true;
        return;
      }

      const [freshChar] = await tx.select().from(characterTable).where(eq(characterTable.id, char.id)).for("update");
      if (!freshChar) {
        itemNotFound = true;
        return;
      }
      currentGold = freshChar.gold;

      if (freshChar.gold < item.cost) {
        insufficientGold = true;
        return;
      }

      const newGold = freshChar.gold - item.cost;
      await tx.update(characterTable).set({ gold: newGold }).where(eq(characterTable.id, freshChar.id));

      await tx.insert(questLogTable).values({
        characterId: freshChar.id,
        questName: item.name,
        category: item.category,
        difficulty: "—",
        outcome: "purchased",
        xpChange: 0,
        goldChange: -item.cost,
        actionType: "PURCHASE",
      });

      await tx.insert(shopPurchasesTable).values({
        itemId: item.id,
        characterId: freshChar.id,
        itemName: item.name,
        goldSpent: item.cost,
      });

      result = { newGold, itemName: item.name, cost: item.cost };
    });

    if (itemNotFound) {
      return res.status(404).json({ error: "Shop item not found" });
    }

    if (insufficientGold) {
      return res.status(402).json({
        success: false,
        message: "Insufficient Gold. Earn more, Hunter.",
        itemName: "",
        goldSpent: 0,
        goldRemaining: currentGold,
      });
    }

    invalidateCharacterCache();

    return res.json({
      success: true,
      message: `Redeemed: ${result!.itemName}.`,
      itemName: result!.itemName,
      goldSpent: result!.cost,
      goldRemaining: result!.newGold,
    });
  } catch (err) {
    req.log.error({ err }, "Error purchasing shop item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/shop/history", async (req, res) => {
  try {
    const char = await getOrCreateCharacter();
    const rows = await db
      .select({
        id: shopPurchasesTable.id,
        itemId: shopPurchasesTable.itemId,
        itemName: shopPurchasesTable.itemName,
        goldSpent: shopPurchasesTable.goldSpent,
        redeemedAt: shopPurchasesTable.redeemedAt,
      })
      .from(shopPurchasesTable)
      .where(eq(shopPurchasesTable.characterId, char.id))
      .orderBy(desc(shopPurchasesTable.redeemedAt))
      .limit(10);

    res.json(
      rows.map((r) => ({
        id: r.id,
        itemId: r.itemId,
        itemName: r.itemName,
        goldSpent: r.goldSpent,
        redeemedAt: r.redeemedAt.toISOString(),
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Error fetching shop history");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ----- Custom Rewards Shop (legacy, user-defined) -----

router.get("/shop/rewards", async (req, res) => {
  try {
    const rewards = await db.select().from(rewardsTable).where(isNull(rewardsTable.deletedAt)).orderBy(rewardsTable.goldCost);
    const mapped = rewards.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
    res.json(mapped);
  } catch (err) {
    req.log.error({ err }, "Error listing rewards");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/shop/rewards", async (req, res) => {
  try {
    const body = CreateRewardBody.parse(req.body);
    const [reward] = await db.insert(rewardsTable).values({
      name: body.name,
      description: body.description ?? null,
      goldCost: body.goldCost,
      category: body.category,
    }).returning();
    res.status(201).json({ ...reward, createdAt: reward.createdAt.toISOString() });
  } catch (err) {
    throw err;
  }
});

router.delete("/shop/rewards/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid reward ID" });
    await db.update(rewardsTable).set({ deletedAt: new Date() }).where(eq(rewardsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting reward");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/shop/rewards/:id/purchase", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid reward ID" });
    const char = await getOrCreateCharacter();

    let purchaseResult: { newGold: number; rewardName: string; goldCost: number } | null = null;
    let insufficientGold = false;
    let rewardNotFound = false;

    await db.transaction(async (tx) => {
      const [reward] = await tx.select().from(rewardsTable).where(eq(rewardsTable.id, id));
      if (!reward || reward.deletedAt) {
        rewardNotFound = true;
        return;
      }

      const [freshChar] = await tx.select().from(characterTable).where(eq(characterTable.id, char.id)).for("update");
      if (!freshChar || freshChar.gold < reward.goldCost) {
        insufficientGold = true;
        return;
      }

      const newGold = freshChar.gold - reward.goldCost;
      await tx.update(characterTable)
        .set({ gold: newGold })
        .where(eq(characterTable.id, freshChar.id));

      await tx.update(rewardsTable)
        .set({ timesRedeemed: sql`${rewardsTable.timesRedeemed} + 1` })
        .where(eq(rewardsTable.id, id));

      purchaseResult = { newGold, rewardName: reward.name, goldCost: reward.goldCost };
    });

    if (rewardNotFound) {
      return res.status(404).json({ error: "Reward not found" });
    }

    if (insufficientGold) {
      return res.status(402).json({
        success: false,
        message: "Insufficient Gold. Complete more quests, Hunter.",
        goldSpent: 0,
        goldRemaining: char.gold,
      });
    }

    invalidateCharacterCache();

    return res.json({
      success: true,
      message: `Reward unlocked: ${purchaseResult!.rewardName}. You earned this.`,
      goldSpent: purchaseResult!.goldCost,
      goldRemaining: purchaseResult!.newGold,
    });
  } catch (err) {
    req.log.error({ err }, "Error purchasing reward");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
