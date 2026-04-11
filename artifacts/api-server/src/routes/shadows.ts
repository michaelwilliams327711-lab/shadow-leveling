import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { bossesTable, shadowArmyTable, characterTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getOrCreateCharacter } from "./character.js";
import { z } from "zod/v4";

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

  res.json({ soldiers });
});

export default router;
