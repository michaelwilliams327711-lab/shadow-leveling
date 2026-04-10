import { db } from "@workspace/db";
import { celestialPowerTable, characterTable } from "@workspace/db";
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

const VICE_OVERFLOW_THRESHOLD = 100;
const VICE_OVERFLOW_CORRUPTION = 20;
const VICE_OVERFLOW_XP_PENALTY = 500;

export async function applyViceRetaliation(characterId: number, virtueCategory: string): Promise<void> {
  const domainPair = VIRTUE_DOMAIN_MAP[virtueCategory.toLowerCase()];
  if (!domainPair) return;

  await db
    .insert(celestialPowerTable)
    .values({ characterId, domainPair, viceScore: 10, virtueScore: 0 })
    .onConflictDoUpdate({
      target: [celestialPowerTable.characterId, celestialPowerTable.domainPair],
      set: { viceScore: sql`${celestialPowerTable.viceScore} + 10` },
    });

  const [row] = await db
    .select()
    .from(celestialPowerTable)
    .where(
      and(
        eq(celestialPowerTable.characterId, characterId),
        eq(celestialPowerTable.domainPair, domainPair)
      )
    );

  if (row && row.viceScore > VICE_OVERFLOW_THRESHOLD) {
    await db
      .update(celestialPowerTable)
      .set({ viceScore: 0 })
      .where(eq(celestialPowerTable.id, row.id));

    await db
      .update(characterTable)
      .set({
        corruption: sql`${characterTable.corruption} + ${VICE_OVERFLOW_CORRUPTION}`,
        xp: sql`GREATEST(0, ${characterTable.xp} - ${VICE_OVERFLOW_XP_PENALTY})`,
      })
      .where(eq(characterTable.id, characterId));
  }
}
