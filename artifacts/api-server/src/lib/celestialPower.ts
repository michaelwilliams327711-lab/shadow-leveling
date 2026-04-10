import { db } from "@workspace/db";
import { celestialPowerTable, characterTable, penaltyLogTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

export const VIRTUE_DOMAIN_MAP: Record<string, string> = {
  diligence:  "sloth_diligence",
  temperance: "gluttony_temperance",
  charity:    "greed_charity",
  chastity:   "lust_chastity",
  patience:   "wrath_patience",
  kindness:   "envy_kindness",
  humility:   "pride_humility",
};

export const VICE_OVERFLOW_THRESHOLD   = 100;
export const VICE_OVERFLOW_CORRUPTION  = 20;
export const GREAT_FALL_CORRUPTION     = 40;

export type ViceRetaliationResult = {
  overflowTriggered: boolean;
  greatFall: boolean;
};

export async function applyViceRetaliation(
  characterId: number,
  virtueCategory: string
): Promise<ViceRetaliationResult> {
  const domainPair = VIRTUE_DOMAIN_MAP[virtueCategory.toLowerCase()];
  if (!domainPair) return { overflowTriggered: false, greatFall: false };

  // Read existing row first to apply Resilience Rule
  const [existing] = await db
    .select()
    .from(celestialPowerTable)
    .where(and(
      eq(celestialPowerTable.characterId, characterId),
      eq(celestialPowerTable.domainPair, domainPair)
    ));

  // Resilience Rule: Ascended domains only take +5 vice per failure instead of +10
  const increment = existing?.isAscended ? 5 : 10;

  await db
    .insert(celestialPowerTable)
    .values({ characterId, domainPair, viceScore: increment, virtueScore: 0 })
    .onConflictDoUpdate({
      target: [celestialPowerTable.characterId, celestialPowerTable.domainPair],
      set: { viceScore: sql`${celestialPowerTable.viceScore} + ${increment}` },
    });

  const [row] = await db
    .select()
    .from(celestialPowerTable)
    .where(and(
      eq(celestialPowerTable.characterId, characterId),
      eq(celestialPowerTable.domainPair, domainPair)
    ));

  if (!row || row.viceScore <= VICE_OVERFLOW_THRESHOLD) {
    return { overflowTriggered: false, greatFall: false };
  }

  if (row.isAscended) {
    // ── THE GREAT FALL ────────────────────────────────────────────────────────
    await db
      .update(celestialPowerTable)
      .set({ viceScore: 0, virtueScore: 0, isAscended: false })
      .where(eq(celestialPowerTable.id, row.id));

    await db
      .update(characterTable)
      .set({
        corruption: sql`${characterTable.corruption} + ${GREAT_FALL_CORRUPTION}`,
        gold:       sql`FLOOR(${characterTable.gold} * 0.25)`,
        streak:     0,
        multiplier: 1.0,
        strength:   sql`GREATEST(1, ${characterTable.strength}   - 50)`,
        intellect:  sql`GREATEST(1, ${characterTable.intellect}  - 50)`,
        endurance:  sql`GREATEST(1, ${characterTable.endurance}  - 50)`,
        agility:    sql`GREATEST(1, ${characterTable.agility}    - 50)`,
        discipline: sql`GREATEST(1, ${characterTable.discipline} - 50)`,
      })
      .where(eq(characterTable.id, characterId));

    await db.insert(penaltyLogTable).values({
      characterId,
      type: "GREAT_FALL",
      description: `Domain ${domainPair} has fallen from grace. Ascension lost, stats decayed, 75% of gold seized.`,
      xpDeducted: 0,
      goldDeducted: 0,
    });

    return { overflowTriggered: true, greatFall: true };
  }

  // ── STANDARD MOMENTUM PENALTY ──────────────────────────────────────────────
  await db
    .update(celestialPowerTable)
    .set({ viceScore: 0 })
    .where(eq(celestialPowerTable.id, row.id));

  await db
    .update(characterTable)
    .set({
      corruption: sql`${characterTable.corruption} + ${VICE_OVERFLOW_CORRUPTION}`,
      gold:       sql`FLOOR(${characterTable.gold} * 0.5)`,
      streak:     0,
      multiplier: 1.0,
    })
    .where(eq(characterTable.id, characterId));

  return { overflowTriggered: true, greatFall: false };
}
