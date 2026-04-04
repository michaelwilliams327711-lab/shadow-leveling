import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { vocationsTable, vocationLogTable, questsTable } from "@workspace/db";
import { eq, sql, desc, isNull, and } from "drizzle-orm";

const router: IRouter = Router();

const VOC_XP_PER_LEVEL = (level: number) => Math.floor(100 * Math.pow(level, 1.4));

const RANK_VOC_XP: Record<string, number> = {
  F:   5,
  E:   12,
  D:   25,
  C:   50,
  B:   85,
  A:   135,
  S:   175,
  SS:  210,
  SSS: 250,
};

function getVocXpForDifficulty(difficulty: string): number {
  return RANK_VOC_XP[difficulty] ?? 25;
}

function serializeVocation(v: typeof vocationsTable.$inferSelect) {
  return {
    ...v,
    titleLadder: v.titleLadder as string[],
    createdAt: v.createdAt.toISOString(),
  };
}

function parseCreateVocationBody(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : null;
  if (!name || name.length === 0 || name.length > 100) throw new Error("name must be a non-empty string (max 100 chars)");
  const description = typeof body.description === "string" ? body.description : undefined;
  const gateThreshold = typeof body.gateThreshold === "number" && body.gateThreshold > 0 ? Math.floor(body.gateThreshold) : 20;
  const milestoneQuestDescription = typeof body.milestoneQuestDescription === "string" ? body.milestoneQuestDescription : undefined;
  const titleLadder = Array.isArray(body.titleLadder) && body.titleLadder.length > 0
    ? (body.titleLadder as unknown[]).map((t) => String(t).trim()).filter((t) => t.length > 0)
    : ["Novice"];
  if (titleLadder.length === 0) throw new Error("titleLadder must have at least one title");
  return { name, description, gateThreshold, milestoneQuestDescription, titleLadder };
}

function parseUpdateVocationBody(body: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : null;
    if (!name || name.length === 0 || name.length > 100) throw new Error("name must be a non-empty string (max 100 chars)");
    result.name = name;
  }
  if ("description" in body) result.description = body.description ?? null;
  if (body.gateThreshold !== undefined) {
    const gt = typeof body.gateThreshold === "number" ? Math.floor(body.gateThreshold) : null;
    if (!gt || gt <= 0) throw new Error("gateThreshold must be a positive integer");
    result.gateThreshold = gt;
  }
  if ("milestoneQuestDescription" in body) result.milestoneQuestDescription = body.milestoneQuestDescription ?? null;
  if (body.titleLadder !== undefined) {
    const tl = Array.isArray(body.titleLadder)
      ? (body.titleLadder as unknown[]).map((t) => String(t).trim()).filter((t) => t.length > 0)
      : null;
    if (!tl || tl.length === 0) throw new Error("titleLadder must have at least one title");
    result.titleLadder = tl;
  }
  return result;
}

router.get("/vocations", async (req, res) => {
  try {
    const vocations = await db.select().from(vocationsTable).where(isNull(vocationsTable.deletedAt)).orderBy(vocationsTable.createdAt);

    const linkedCounts = await db
      .select({
        vocationId: questsTable.vocationId,
        count: sql<number>`count(*)::int`,
      })
      .from(questsTable)
      .where(and(sql`${questsTable.vocationId} IS NOT NULL`, isNull(questsTable.deletedAt)))
      .groupBy(questsTable.vocationId);

    const xpTotals = await db
      .select({
        vocationId: vocationLogTable.vocationId,
        totalXp: sql<number>`coalesce(sum(${vocationLogTable.delta}), 0)::int`,
        completions: sql<number>`count(*)::int`,
      })
      .from(vocationLogTable)
      .where(sql`${vocationLogTable.eventType} = 'XP_GAINED' OR ${vocationLogTable.eventType} = 'GATE_TRIGGERED'`)
      .groupBy(vocationLogTable.vocationId);

    const countMap = new Map(linkedCounts.map((r) => [r.vocationId, r.count]));
    const xpMap = new Map(xpTotals.map((r) => [r.vocationId, { totalXp: r.totalXp, completions: r.completions }]));

    const result = vocations.map((v) => ({
      ...serializeVocation(v),
      linkedQuestCount: countMap.get(v.id) ?? 0,
      totalXpEarned: xpMap.get(v.id)?.totalXp ?? 0,
      totalCompletions: xpMap.get(v.id)?.completions ?? 0,
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error listing vocations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/vocations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [vocation] = await db.select().from(vocationsTable).where(eq(vocationsTable.id, id));
    if (!vocation) return res.status(404).json({ error: "Vocation not found" });

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questsTable)
      .where(eq(questsTable.vocationId, id));

    res.json({
      ...serializeVocation(vocation),
      linkedQuestCount: countRow?.count ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting vocation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vocations", async (req, res) => {
  let body: ReturnType<typeof parseCreateVocationBody>;
  try {
    body = parseCreateVocationBody(req.body as Record<string, unknown>);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
  try {
    const [vocation] = await db
      .insert(vocationsTable)
      .values({
        name: body.name,
        description: body.description ?? null,
        gateThreshold: body.gateThreshold,
        milestoneQuestDescription: body.milestoneQuestDescription ?? null,
        titleLadder: body.titleLadder,
      })
      .returning();

    await db.insert(vocationLogTable).values({
      vocationId: vocation.id,
      eventType: "CREATED",
      delta: 0,
    });

    res.status(201).json({ ...serializeVocation(vocation), linkedQuestCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Error creating vocation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/vocations/:id", async (req, res) => {
  let updates: ReturnType<typeof parseUpdateVocationBody>;
  try {
    updates = parseUpdateVocationBody(req.body as Record<string, unknown>);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
  try {
    const { id } = req.params;
    const [updated] = await db
      .update(vocationsTable)
      .set(updates)
      .where(eq(vocationsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Vocation not found" });

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questsTable)
      .where(eq(questsTable.vocationId, id));

    res.json({ ...serializeVocation(updated), linkedQuestCount: countRow?.count ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Error updating vocation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/vocations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.update(questsTable).set({ vocationId: null }).where(eq(questsTable.vocationId, id));
    await db.update(vocationsTable).set({ deletedAt: new Date() }).where(eq(vocationsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting vocation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/vocations/:id/log", async (req, res) => {
  try {
    const { id } = req.params;
    const logs = await db
      .select()
      .from(vocationLogTable)
      .where(eq(vocationLogTable.vocationId, id))
      .orderBy(desc(vocationLogTable.timestamp))
      .limit(50);
    res.json(logs.map((l) => ({ ...l, timestamp: l.timestamp.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Error getting vocation log");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vocations/:id/complete-milestone", async (req, res) => {
  try {
    const { id } = req.params;
    const [vocation] = await db.select().from(vocationsTable).where(eq(vocationsTable.id, id));
    if (!vocation) return res.status(404).json({ error: "Vocation not found" });

    if (!vocation.gateActive) {
      return res.status(400).json({ error: "Gate is not active for this vocation" });
    }

    const titleLadder = vocation.titleLadder as string[];
    const oldTitleIndex = vocation.currentTitleIndex;
    const newTitleIndex = Math.min(oldTitleIndex + 1, titleLadder.length - 1);
    const oldTitle = titleLadder[oldTitleIndex] ?? titleLadder[0];
    const newTitle = titleLadder[newTitleIndex];

    const [updated] = await db
      .update(vocationsTable)
      .set({
        currentTitleIndex: newTitleIndex,
        gateActive: false,
      })
      .where(eq(vocationsTable.id, id))
      .returning();

    await db.insert(vocationLogTable).values({
      vocationId: id,
      eventType: "EVOLUTION",
      delta: 0,
      metadata: { oldTitle, newTitle, oldTitleIndex, newTitleIndex, level: vocation.currentLevel },
    });

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questsTable)
      .where(eq(questsTable.vocationId, id));

    res.json({
      ...serializeVocation(updated),
      linkedQuestCount: countRow?.count ?? 0,
      oldTitle,
      newTitle,
      evolved: true,
    });
  } catch (err) {
    req.log.error({ err }, "Error completing vocation milestone");
    res.status(500).json({ error: "Internal server error" });
  }
});

export async function awardVocXp(vocationId: string, difficulty: string): Promise<{
  gateTriggered: boolean;
  gateBlocked: boolean;
  xpAwarded: number;
  newLevel: number;
  newXp: number;
} | null> {
  const [vocation] = await db.select().from(vocationsTable).where(eq(vocationsTable.id, vocationId));
  if (!vocation || vocation.deletedAt) return null;

  if (vocation.gateActive) {
    return { gateTriggered: false, gateBlocked: true, xpAwarded: 0, newLevel: vocation.currentLevel, newXp: vocation.currentXp };
  }

  const xpToAward = getVocXpForDifficulty(difficulty);
  let newXp = vocation.currentXp + xpToAward;
  let newLevel = vocation.currentLevel;
  let gateTriggered = false;

  const MAX_ITER = 50;
  let iter = 0;
  while (newXp >= VOC_XP_PER_LEVEL(newLevel) && iter < MAX_ITER) {
    newXp -= VOC_XP_PER_LEVEL(newLevel);
    newLevel += 1;
    iter++;
  }

  if (newLevel >= vocation.gateThreshold && Math.floor(newLevel / vocation.gateThreshold) > Math.floor(vocation.currentLevel / vocation.gateThreshold)) {
    gateTriggered = true;
  }

  const [updated] = await db
    .update(vocationsTable)
    .set({
      currentXp: newXp,
      currentLevel: newLevel,
      gateActive: gateTriggered ? true : vocation.gateActive,
    })
    .where(eq(vocationsTable.id, vocationId))
    .returning();

  await db.insert(vocationLogTable).values({
    vocationId,
    eventType: gateTriggered ? "GATE_TRIGGERED" : "XP_GAINED",
    delta: xpToAward,
    metadata: { difficulty, newLevel, newXp },
  });

  return { gateTriggered, gateBlocked: false, xpAwarded: xpToAward, newLevel, newXp };
}

export default router;
