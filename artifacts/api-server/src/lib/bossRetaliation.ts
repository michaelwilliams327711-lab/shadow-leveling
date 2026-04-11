import { db } from "@workspace/db";
import { bossesTable, characterTable, celestialPowerTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const RETALIATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const RETALIATION_GOLD_PENALTY = 100;
const SLOTH_VICE_INCREMENT = 5;
const SLOTH_DOMAIN = "sloth_diligence";

export type RetaliationResult = {
  bossId: number;
  bossName: string;
  retaliated: boolean;
};

/**
 * Enrage Timer — called on every GET /bosses.
 *
 * For each active (non-defeated) boss that has received at least one damage hit:
 *   - If >= 24h have elapsed since lastDamageAt AND >= 24h since lastRetaliationAt
 *     the boss "attacks" the character:
 *       · Deducts 100 Gold (floors at 0)
 *       · Increments the Sloth Vice Score by 5 on the celestial_power table
 *       · Stamps lastRetaliationAt so the penalty fires at most once per 24h window
 */
export async function runBossRetaliationChecks(
  characterId: number
): Promise<RetaliationResult[]> {
  const activeBosses = await db
    .select()
    .from(bossesTable)
    .where(eq(bossesTable.isDefeated, false));

  const results: RetaliationResult[] = [];
  const now = Date.now();

  for (const boss of activeBosses) {
    const lastDamage = boss.lastDamageAt;
    if (!lastDamage) {
      results.push({ bossId: boss.id, bossName: boss.name, retaliated: false });
      continue;
    }

    const msSinceLastDamage     = now - lastDamage.getTime();
    const lastRetaliation       = boss.lastRetaliationAt;
    const msSinceLastRetaliation = lastRetaliation
      ? now - lastRetaliation.getTime()
      : Infinity;

    const shouldRetaliate =
      msSinceLastDamage     >= RETALIATION_WINDOW_MS &&
      msSinceLastRetaliation >= RETALIATION_WINDOW_MS;

    if (!shouldRetaliate) {
      results.push({ bossId: boss.id, bossName: boss.name, retaliated: false });
      continue;
    }

    await db
      .update(characterTable)
      .set({ gold: sql`GREATEST(0, ${characterTable.gold} - ${RETALIATION_GOLD_PENALTY})` })
      .where(eq(characterTable.id, characterId));

    await db
      .insert(celestialPowerTable)
      .values({
        characterId,
        domainPair: SLOTH_DOMAIN,
        viceScore: SLOTH_VICE_INCREMENT,
        virtueScore: 0,
      })
      .onConflictDoUpdate({
        target: [celestialPowerTable.characterId, celestialPowerTable.domainPair],
        set: { viceScore: sql`${celestialPowerTable.viceScore} + ${SLOTH_VICE_INCREMENT}` },
      });

    await db
      .update(bossesTable)
      .set({ lastRetaliationAt: new Date() })
      .where(eq(bossesTable.id, boss.id));

    results.push({ bossId: boss.id, bossName: boss.name, retaliated: true });
  }

  return results;
}
