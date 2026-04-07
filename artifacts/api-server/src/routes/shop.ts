import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { rewardsTable, characterTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { CreateRewardBody } from "@workspace/api-zod";
import { getOrCreateCharacter, invalidateCharacterCache } from "./character.js";

const router: IRouter = Router();

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
    req.log.error({ err }, "Error creating reward");
    res.status(500).json({ error: "Internal server error" });
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

      const [freshChar] = await tx.select().from(characterTable).where(eq(characterTable.id, char.id));
      if (!freshChar || freshChar.gold < reward.goldCost) {
        insufficientGold = true;
        return;
      }

      const newGold = freshChar.gold - reward.goldCost;
      await tx.update(characterTable)
        .set({ gold: newGold })
        .where(eq(characterTable.id, freshChar.id));

      await tx.update(rewardsTable)
        .set({ timesRedeemed: reward.timesRedeemed + 1 })
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
