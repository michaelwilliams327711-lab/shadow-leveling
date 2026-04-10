import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { celestialPowerTable, characterTable, penaltyLogTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { QuickLogBody } from "@workspace/api-zod";
import { getOrCreateCharacter } from "./character.js";
import {
  VIRTUE_DOMAIN_MAP,
  VICE_OVERFLOW_THRESHOLD,
  VICE_OVERFLOW_CORRUPTION,
  GREAT_FALL_CORRUPTION,
} from "../lib/celestialPower.js";

const router: IRouter = Router();

const VIRTUE_SCORE_ASCENSION_THRESHOLD = 100;
const ASCENSION_STAT_BONUS = 50;

router.post("/ascension/quick-log", async (req, res) => {
  try {
    const parsed = QuickLogBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
    }

    const { type, pair } = parsed.data;
    const char = await getOrCreateCharacter();

    if (type === "vice") {
      // Upsert +5 vice score
      await db
        .insert(celestialPowerTable)
        .values({ characterId: char.id, domainPair: pair, viceScore: 5, virtueScore: 0 })
        .onConflictDoUpdate({
          target: [celestialPowerTable.characterId, celestialPowerTable.domainPair],
          set: { viceScore: sql`${celestialPowerTable.viceScore} + 5` },
        });

      await db
        .update(characterTable)
        .set({ corruption: sql`${characterTable.corruption} + 2` })
        .where(eq(characterTable.id, char.id));

      const [row] = await db
        .select()
        .from(celestialPowerTable)
        .where(and(
          eq(celestialPowerTable.characterId, char.id),
          eq(celestialPowerTable.domainPair, pair)
        ));

      let overflowTriggered = false;
      let greatFall = false;

      if (row && row.viceScore > VICE_OVERFLOW_THRESHOLD) {
        overflowTriggered = true;

        if (row.isAscended) {
          // ── THE GREAT FALL ──────────────────────────────────────────────────
          greatFall = true;

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
            .where(eq(characterTable.id, char.id));

          await db.insert(penaltyLogTable).values({
            characterId: char.id,
            type: "GREAT_FALL",
            description: `Domain ${pair} has fallen from grace. Ascension lost, stats decayed, 75% of gold seized.`,
            xpDeducted: 0,
            goldDeducted: 0,
          });
        } else {
          // ── STANDARD MOMENTUM PENALTY ──────────────────────────────────────
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
            .where(eq(characterTable.id, char.id));
        }
      }

      return res.json({
        success: true,
        type: "vice",
        pair,
        viceScoreDelta: 5,
        corruptionAdded: greatFall ? 2 + GREAT_FALL_CORRUPTION : overflowTriggered ? 2 + VICE_OVERFLOW_CORRUPTION : 2,
        overflowTriggered,
        greatFall,
        momentumPenalty: overflowTriggered && !greatFall
          ? { corruption: VICE_OVERFLOW_CORRUPTION, goldHalved: true, streakReset: true }
          : null,
        greatFallPenalty: greatFall
          ? { corruption: GREAT_FALL_CORRUPTION, gold75PercentLost: true, allStatsDecay: 50, streakReset: true }
          : null,
      });
    }

    if (type === "virtue") {
      await db
        .insert(celestialPowerTable)
        .values({ characterId: char.id, domainPair: pair, viceScore: 0, virtueScore: 5 })
        .onConflictDoUpdate({
          target: [celestialPowerTable.characterId, celestialPowerTable.domainPair],
          set: { virtueScore: sql`${celestialPowerTable.virtueScore} + 5` },
        });

      await db
        .update(characterTable)
        .set({ xp: sql`${characterTable.xp} + 10` })
        .where(eq(characterTable.id, char.id));

      const [row] = await db
        .select()
        .from(celestialPowerTable)
        .where(and(
          eq(celestialPowerTable.characterId, char.id),
          eq(celestialPowerTable.domainPair, pair)
        ));

      let ascensionTriggered = false;
      if (row && !row.isAscended && row.virtueScore >= VIRTUE_SCORE_ASCENSION_THRESHOLD) {
        ascensionTriggered = true;
        await db
          .update(celestialPowerTable)
          .set({ isAscended: true })
          .where(eq(celestialPowerTable.id, row.id));

        await db
          .update(characterTable)
          .set({
            strength:   sql`${characterTable.strength}   + ${ASCENSION_STAT_BONUS}`,
            intellect:  sql`${characterTable.intellect}  + ${ASCENSION_STAT_BONUS}`,
            endurance:  sql`${characterTable.endurance}  + ${ASCENSION_STAT_BONUS}`,
            agility:    sql`${characterTable.agility}    + ${ASCENSION_STAT_BONUS}`,
            discipline: sql`${characterTable.discipline} + ${ASCENSION_STAT_BONUS}`,
          })
          .where(eq(characterTable.id, char.id));
      }

      return res.json({
        success: true,
        type: "virtue",
        pair,
        virtueScoreDelta: 5,
        xpAdded: 10,
        ascensionTriggered,
        ascensionBonus: ascensionTriggered ? { allStatsGain: ASCENSION_STAT_BONUS } : null,
        isAscended: ascensionTriggered ? true : (row?.isAscended ?? false),
      });
    }

    return res.status(400).json({ error: "Invalid type" });
  } catch (err) {
    req.log.error({ err }, "Error in ascension quick-log");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/ascension/powers", async (req, res) => {
  try {
    const char = await getOrCreateCharacter();
    const powers = await db
      .select()
      .from(celestialPowerTable)
      .where(eq(celestialPowerTable.characterId, char.id));
    res.json(powers);
  } catch (err) {
    req.log.error({ err }, "Error fetching celestial powers");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
