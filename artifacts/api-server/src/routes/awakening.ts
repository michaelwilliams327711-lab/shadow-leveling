import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { awakeningTable, characterTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SaveAwakeningBody } from "@workspace/api-zod";

const router: IRouter = Router();

async function getCharacterId(): Promise<number | null> {
  const rows = await db.select({ id: characterTable.id }).from(characterTable).limit(1);
  return rows.length > 0 ? rows[0].id : null;
}

async function getOrCreateAwakening() {
  const characterId = await getCharacterId();
  const rows = characterId
    ? await db.select().from(awakeningTable).where(eq(awakeningTable.characterId, characterId)).limit(1)
    : await db.select().from(awakeningTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [newEntry] = await db.insert(awakeningTable).values({ characterId, vision: null, antiVision: null, coreValues: null }).returning();
  return newEntry;
}

router.get("/awakening", async (req, res) => {
  try {
    const entry = await getOrCreateAwakening();
    res.json({ ...entry, updatedAt: entry.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error getting awakening");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/awakening", async (req, res) => {
  try {
    const body = SaveAwakeningBody.parse(req.body);
    const entry = await getOrCreateAwakening();
    const [updated] = await db.update(awakeningTable)
      .set({
        vision: body.vision ?? entry.vision,
        antiVision: body.antiVision ?? entry.antiVision,
        coreValues: body.coreValues ?? entry.coreValues,
        updatedAt: new Date(),
      })
      .where(eq(awakeningTable.id, entry.id))
      .returning();
    res.json({ ...updated, updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error saving awakening");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
