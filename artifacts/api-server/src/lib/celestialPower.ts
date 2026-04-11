import { db } from "@workspace/db";
import { celestialPowerTable, characterTable, penaltyLogTable, bossesTable } from "@workspace/db";
import { eq, and, sql, asc, inArray } from "drizzle-orm";

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
export const AMBUSH_VICE_THRESHOLD     = 80;

const AMBUSH_ELIGIBLE_RANKS = ["C", "B"] as const;

export type ViceRetaliationResult = {
  overflowTriggered: boolean;
  greatFall: boolean;
  ambushBossName?: string;
};

export async function applyViceRetaliation(
  characterId: number,
  virtueCategory: string
): Promise<ViceRetaliationResult> {
  const domainPair = VIRTUE_DOMAIN_MAP[virtueCategory.toLowerCase()];
  if (!domainPair) return { overflowTriggered: false, greatFall: false };

  const [existing] = await db
    .select()
    .from(celestialPowerTable)
    .where(and(
      eq(celestialPowerTable.characterId, characterId),
      eq(celestialPowerTable.domainPair, domainPair)
    ));

  const prevScore = existing?.viceScore ?? 0;
  const increment = existing?.isAscended ? 5 : 10;
  const newScore  = prevScore + increment;

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

  // ── AMBUSH TRIGGER ────────────────────────────────────────────────────────
  // When any domain vice score crosses 80, a Rank C or B boss gate-crashes the
  // Arena, completely bypassing the Gate Key requirement.
  let ambushBossName: string | undefined;
  if (prevScore < AMBUSH_VICE_THRESHOLD && newScore >= AMBUSH_VICE_THRESHOLD) {
    try {
      const [ambushCandidate] = await db
        .select()
        .from(bossesTable)
        .where(and(
          eq(bossesTable.isDefeated,   false),
          eq(bossesTable.gateUnlocked, false),
          inArray(bossesTable.rank, [...AMBUSH_ELIGIBLE_RANKS])
        ))
        .orderBy(asc(bossesTable.xpThreshold))
        .limit(1);

      if (ambushCandidate) {
        await db
          .update(bossesTable)
          .set({ gateUnlocked: true })
          .where(eq(bossesTable.id, ambushCandidate.id));
        ambushBossName = ambushCandidate.name;
      }
    } catch {
      // Ambush failure is non-fatal — vice retaliation still resolves
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  if (!row || row.viceScore <= VICE_OVERFLOW_THRESHOLD) {
    return { overflowTriggered: false, greatFall: false, ambushBossName };
  }

  if (row.isAscended) {
    await db.update(celestialPowerTable)
      .set({ viceScore: 0, virtueScore: 0, isAscended: false })
      .where(eq(celestialPowerTable.id, row.id));

    await db.update(characterTable)
      .set({
        corruption: sql`${characterTable.corruption} + ${GREAT_FALL_CORRUPTION}`,
        gold:       sql`GREATEST(0, FLOOR(${characterTable.gold} * 0.25))`,
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
      type: "GREAT_FALL",
      description: `Domain ${domainPair} has fallen. Ascension lost, stats decayed, wealth seized.`,
      xpDeducted: 0,
      goldDeducted: 0,
    });
    return { overflowTriggered: true, greatFall: true, ambushBossName };
  }

  await db.update(celestialPowerTable).set({ viceScore: 0 }).where(eq(celestialPowerTable.id, row.id));
  await db.update(characterTable)
    .set({
      corruption: sql`${characterTable.corruption} + ${VICE_OVERFLOW_CORRUPTION}`,
      gold:       sql`GREATEST(0, FLOOR(${characterTable.gold} * 0.5))`,
      streak:     0,
      multiplier: 1.0,
    })
    .where(eq(characterTable.id, characterId));

  return { overflowTriggered: true, greatFall: false, ambushBossName };
}
