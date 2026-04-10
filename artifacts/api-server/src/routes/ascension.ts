import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { celestialPowerTable, characterTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { QuickLogBody } from "@workspace/api-zod";
import { getOrCreateCharacter } from "./character.js";
import { VIRTUE_DOMAIN_MAP } from "../lib/celestialPower.js";

const router: IRouter = Router();

const VIRTUE_SCORE_ASCENSION_THRESHOLD = 100;
const ASCENSION_STAT_BONUS = 50;
const VICE_OVERFLOW_THRESHOLD = 100;
const VICE_OVERFLOW_CORRUPTION = 20;
const VICE_OVERFLOW_XP_PENALTY = 500;

router.post("/ascension/quick-log", async (req, res) => {
  try {
    const parsed = QuickLogBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
    }

    const { type, pair } = parsed.data;
    const char = await getOrCreateCharacter();

    if (type === "vice") {
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
        .where(
          and(
            eq(celestialPowerTable.characterId, char.id),
            eq(celestialPowerTable.domainPair, pair)
          )
        );

      let overflowTriggered = false;
      if (row && row.viceScore > VICE_OVERFLOW_THRESHOLD) {
        overflowTriggered = true;
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
          .where(eq(characterTable.id, char.id));
      }

      return res.json({
        success: true,
        type: "vice",
        pair,
        viceScoreDelta: 5,
        corruptionAdded: overflowTriggered ? 2 + VICE_OVERFLOW_CORRUPTION : 2,
        overflowTriggered,
        overflowPenalty: overflowTriggered
          ? { corruption: VICE_OVERFLOW_CORRUPTION, xpDeducted: VICE_OVERFLOW_XP_PENALTY }
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
        .where(
          and(
            eq(celestialPowerTable.characterId, char.id),
            eq(celestialPowerTable.domainPair, pair)
          )
        );

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
