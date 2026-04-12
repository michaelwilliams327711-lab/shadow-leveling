import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { bossesTable, shadowArmyTable, shadowJournalTable, characterTable, questsTable } from "@workspace/db";
import { eq, count, and, isNull, desc } from "drizzle-orm";
import { getOrCreateCharacter } from "./character.js";
import { z } from "zod";

const router: IRouter = Router();

const SHADOW_NAMES_BY_RANK: Record<string, string[]> = {
  D: ["Iron Shade", "Pale Stalker", "Crypt Walker", "Bone Warden", "Ashen Grunt"],
  C: ["Void Sentinel", "Dusk Reaver", "Shadow Fang", "Blighted Specter", "Night Courier"],
  B: ["Obsidian Guard", "Soul Ripper", "Eclipse Knight", "Ember Shade", "Abyssal Brute"],
  A: ["Sovereign Blade", "Ruin Harbinger", "Chaos Templar", "Death's Herald", "Veil Breaker"],
  S: ["Absolute Shadow", "The Eternal", "Monarch's Right Hand", "Domain Sovereign", "Apex Revenant"],
};

const ABILITIES_BY_RANK: Record<string, string[]> = {
  D: ["Stone Skin", "Shadow Step", "Bone Crush", "Fear Pulse", "Grave Shackle"],
  C: ["Void Slash", "Phantom Dash", "Chill Aura", "Shadow Bind", "Dark Vision"],
  B: ["Soul Drain", "Eclipse Charge", "Obsidian Armor", "Ruin Strike", "Night Shroud"],
  A: ["Sovereign Blade", "Judgment Pulse", "Domain Fracture", "Chaos Nova", "Death's Embrace"],
  S: ["Absolute Authority", "Void Singularity", "Monarch's Wrath", "Eternal Dominion", "Domain Collapse"],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function mapBossRankToShadowRank(bossRank: string): string {
  const map: Record<string, string> = {
    F: "D", E: "D", D: "D", C: "C", B: "B", A: "A",
    S: "S", SS: "S", SSS: "S",
  };
  return map[bossRank] ?? "D";
}

const extractBodySchema = z.object({
  bossId: z.number().int().positive(),
  command: z.string(),
});

router.post("/shadows/extract", async (req: Request, res: Response): Promise<void> => {
  const parsed = extractBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const { bossId, command } = parsed.data;

  if (command !== "ARISE") {
    res.status(400).json({ error: "Invalid command. Only 'ARISE' is accepted." });
    return;
  }

  const [boss] = await db
    .select()
    .from(bossesTable)
    .where(eq(bossesTable.id, bossId))
    .limit(1);

  if (!boss) {
    res.status(404).json({ error: "Boss not found." });
    return;
  }

  if (!boss.isDefeated || boss.currentHp > 0) {
    res.status(409).json({ error: "Boss must be fully defeated before extraction is possible." });
    return;
  }

  if (boss.isExtracted) {
    res.status(409).json({ error: "This shadow has already been extracted." });
    return;
  }

  const char = await getOrCreateCharacter();

  const shadowLimit = 5 + Math.floor(char.intellect / 10);
  const existingShadows = await db
    .select()
    .from(shadowArmyTable)
    .where(eq(shadowArmyTable.characterId, char.id));

  if (existingShadows.length >= shadowLimit) {
    res.status(400).json({
      error: `Shadow Army capacity reached (${existingShadows.length}/${shadowLimit}). Release a soldier to extract more.`,
    });
    return;
  }

  const intellectBonus = Math.min(char.intellect * 0.5, 40);
  const successChance = 40 + intellectBonus;
  const roll = Math.random() * 100;
  const success = roll < successChance;

  if (!success) {
    res.status(200).json({
      success: false,
      roll: Math.round(roll),
      threshold: Math.round(successChance),
      message: "The shadow resists your command...",
    });
    return;
  }

  const shadowRank = mapBossRankToShadowRank(boss.rank);
  const namePool = SHADOW_NAMES_BY_RANK[shadowRank] ?? SHADOW_NAMES_BY_RANK["D"]!;
  const abilityPool = ABILITIES_BY_RANK[shadowRank] ?? ABILITIES_BY_RANK["D"]!;

  const shadowName = pickRandom(namePool);
  const shadowAbility = pickRandom(abilityPool);

  const [inserted] = await db
    .insert(shadowArmyTable)
    .values({
      characterId: char.id,
      name: shadowName,
      rank: shadowRank,
      specialAbility: shadowAbility,
      assignedTaskId: null,
    })
    .returning();

  await db
    .update(bossesTable)
    .set({ isExtracted: true })
    .where(eq(bossesTable.id, bossId));

  res.status(200).json({
    success: true,
    roll: Math.round(roll),
    threshold: Math.round(successChance),
    shadow: inserted,
    message: `${shadowName} has joined the Army.`,
  });
});

router.get("/shadows", async (_req: Request, res: Response): Promise<void> => {
  const char = await getOrCreateCharacter();

  const soldiers = await db
    .select()
    .from(shadowArmyTable)
    .where(eq(shadowArmyTable.characterId, char.id));

  const shadowLimit = 5 + Math.floor(char.intellect / 10);

  res.json({ soldiers, capacity: shadowLimit, current: soldiers.length });
});

const assignBodySchema = z.object({
  questId: z.number().int().positive(),
});

router.get("/shadows/journal", async (_req: Request, res: Response): Promise<void> => {
  const char = await getOrCreateCharacter();
  const entries = await db
    .select()
    .from(shadowJournalTable)
    .where(eq(shadowJournalTable.characterId, char.id))
    .orderBy(desc(shadowJournalTable.occurredAt))
    .limit(50);
  res.json(entries);
});

router.patch("/shadows/:id/assign", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid shadow ID" }); return; }

  const parsed = assignBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "questId (number) is required" }); return; }

  const char = await getOrCreateCharacter();

  const [soldier] = await db.select().from(shadowArmyTable).where(eq(shadowArmyTable.id, id)).limit(1);
  if (!soldier) { res.status(404).json({ error: "Soldier not found." }); return; }
  if (soldier.characterId !== char.id) { res.status(403).json({ error: "This soldier does not belong to you." }); return; }

  const [quest] = await db
    .select({ id: questsTable.id, name: questsTable.name, status: questsTable.status })
    .from(questsTable)
    .where(and(eq(questsTable.id, parsed.data.questId), isNull(questsTable.deletedAt)))
    .limit(1);

  if (!quest) { res.status(404).json({ error: "Quest not found." }); return; }
  if (quest.status !== "active") { res.status(400).json({ error: "Only active quests can receive a shadow assignment." }); return; }

  // Unassign any other soldiers already on this quest
  await db
    .update(shadowArmyTable)
    .set({ assignedTaskId: null })
    .where(and(eq(shadowArmyTable.characterId, char.id), eq(shadowArmyTable.assignedTaskId, parsed.data.questId)));

  const [updated] = await db
    .update(shadowArmyTable)
    .set({ assignedTaskId: parsed.data.questId })
    .where(eq(shadowArmyTable.id, id))
    .returning();

  res.json({ ok: true, soldier: updated, questName: quest.name });
});

router.patch("/shadows/:id/unassign", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid shadow ID" }); return; }

  const char = await getOrCreateCharacter();

  const [soldier] = await db.select().from(shadowArmyTable).where(eq(shadowArmyTable.id, id)).limit(1);
  if (!soldier) { res.status(404).json({ error: "Soldier not found." }); return; }
  if (soldier.characterId !== char.id) { res.status(403).json({ error: "This soldier does not belong to you." }); return; }

  const [updated] = await db
    .update(shadowArmyTable)
    .set({ assignedTaskId: null })
    .where(eq(shadowArmyTable.id, id))
    .returning();

  res.json({ ok: true, soldier: updated });
});

router.delete("/shadows/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid shadow ID" });
    return;
  }

  const char = await getOrCreateCharacter();

  const [soldier] = await db
    .select()
    .from(shadowArmyTable)
    .where(eq(shadowArmyTable.id, id))
    .limit(1);

  if (!soldier) {
    res.status(404).json({ error: "Soldier not found." });
    return;
  }

  if (soldier.characterId !== char.id) {
    res.status(403).json({ error: "This soldier does not belong to you." });
    return;
  }

  await db.delete(shadowArmyTable).where(eq(shadowArmyTable.id, id));

  const [{ value: remaining }] = await db
    .select({ value: count() })
    .from(shadowArmyTable)
    .where(eq(shadowArmyTable.characterId, char.id));

  const shadowLimit = 5 + Math.floor(char.intellect / 10);

  res.json({
    ok: true,
    releasedName: soldier.name,
    current: remaining,
    capacity: shadowLimit,
    message: `${soldier.name} has been released from the army.`,
  });
});

export default router;
