import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { rewardsTable, characterTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateRewardBody } from "@workspace/api-zod";
import { getOrCreateCharacter } from "./character.js";

const router: IRouter = Router();

router.get("/shop/rewards", async (req, res) => {
  try {
    const rewards = await db.select().from(rewardsTable).orderBy(rewardsTable.goldCost);
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
    await db.delete(rewardsTable).where(eq(rewardsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting reward");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/shop/rewards/:id/purchase", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [reward] = await db.select().from(rewardsTable).where(eq(rewardsTable.id, id));
    if (!reward) return res.status(404).json({ error: "Reward not found" });

    const char = await getOrCreateCharacter();
    if (char.gold < reward.goldCost) {
      return res.json({
        success: false,
        message: "Insufficient Gold. Complete more quests, Hunter.",
        goldSpent: 0,
        goldRemaining: char.gold,
      });
    }

    const newGold = char.gold - reward.goldCost;
    await db.update(characterTable)
      .set({ gold: newGold })
      .where(eq(characterTable.id, char.id));

    await db.update(rewardsTable)
      .set({ timesRedeemed: reward.timesRedeemed + 1 })
      .where(eq(rewardsTable.id, id));

    res.json({
      success: true,
      message: `Reward unlocked: ${reward.name}. You earned this.`,
      goldSpent: reward.goldCost,
      goldRemaining: newGold,
    });
  } catch (err) {
    req.log.error({ err }, "Error purchasing reward");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
