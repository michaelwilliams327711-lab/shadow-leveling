import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { celestialPowerTable, characterTable, penaltyLogTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { getOrCreateCharacter, invalidateCharacterCache } from "./character.js";
import { z } from "zod";

const router: IRouter = Router();
const VIRTUE_SCORE_ASCENSION_THRESHOLD = 100;
const VICE_OVERFLOW_THRESHOLD          = 100;
const VICE_OVERFLOW_CORRUPTION         = 20;
const GREAT_FALL_CORRUPTION            = 40;

const QuickLogBody = z.object({
  type:   z.enum(["virtue", "vice"]),
  pair:   z.string(),
  points: z.number().int().positive(),
});

router.get("/ascension/powers", async (req, res) => {
  try {
    const char = await getOrCreateCharacter();
    const powers = await db.select().from(celestialPowerTable).where(eq(celestialPowerTable.characterId, char.id));
    res.json(powers);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ascension/quick-log", async (req, res) => {
  try {
    const parsed = QuickLogBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

    const { type, pair, points } = parsed.data;
    const char = await getOrCreateCharacter();

    let overflowTriggered = false;
    let greatFall         = false;
    let ascensionTriggered = false;

    await db.transaction(async (tx) => {
      await tx.insert(celestialPowerTable)
        .values({ characterId: char.id, domainPair: pair, virtueScore: 0, viceScore: 0 })
        .onConflictDoNothing();

      const [existing] = await tx.select().from(celestialPowerTable)
        .where(and(eq(celestialPowerTable.characterId, char.id), eq(celestialPowerTable.domainPair, pair)));

      if (!existing) throw new Error("Failed to secure celestial row");

      if (type === "virtue") {
        const newScore = Math.min(200, existing.virtueScore + points);
        const ascends = newScore >= VIRTUE_SCORE_ASCENSION_THRESHOLD && !existing.isAscended;
        if (ascends) ascensionTriggered = true;

        await tx.update(celestialPowerTable)
          .set({ virtueScore: newScore, isAscended: ascends ? true : existing.isAscended })
          .where(eq(celestialPowerTable.id, existing.id));

      } else {
        // ── Vice branch: Resilience Rule (ascended domains take half damage) ──
        const increment = existing.isAscended ? 5 : points;
        const newViceScore = existing.viceScore + increment;

        await tx.update(celestialPowerTable)
          .set({ viceScore: newViceScore })
          .where(eq(celestialPowerTable.id, existing.id));

        if (newViceScore > VICE_OVERFLOW_THRESHOLD) {
          overflowTriggered = true;

          if (existing.isAscended) {
            // ── The Great Fall ──────────────────────────────────────────────
            greatFall = true;
            await tx.update(celestialPowerTable)
              .set({ viceScore: 0, virtueScore: 0, isAscended: false })
              .where(eq(celestialPowerTable.id, existing.id));

            await tx.update(characterTable).set({
              corruption: sql`${characterTable.corruption} + ${GREAT_FALL_CORRUPTION}`,
              gold:       sql`GREATEST(0, FLOOR(${characterTable.gold} * 0.25))`,
              streak:     0,
              multiplier: 1.0,
              strength:   sql`GREATEST(1, ${characterTable.strength}   - 50)`,
              intellect:  sql`GREATEST(1, ${characterTable.intellect}  - 50)`,
              endurance:  sql`GREATEST(1, ${characterTable.endurance}  - 50)`,
              agility:    sql`GREATEST(1, ${characterTable.agility}    - 50)`,
              discipline: sql`GREATEST(1, ${characterTable.discipline} - 50)`,
            }).where(eq(characterTable.id, char.id));

            await tx.insert(penaltyLogTable).values({
              type: "GREAT_FALL",
              description: `Domain ${pair} has fallen. Ascension lost, stats decayed, wealth seized.`,
              xpDeducted: 0,
              goldDeducted: 0,
            });

          } else {
            // ── Standard Overflow: gold halved, streak reset ───────────────
            await tx.update(celestialPowerTable)
              .set({ viceScore: 0 })
              .where(eq(celestialPowerTable.id, existing.id));

            await tx.update(characterTable).set({
              corruption: sql`${characterTable.corruption} + ${VICE_OVERFLOW_CORRUPTION}`,
              gold:       sql`GREATEST(0, FLOOR(${characterTable.gold} * 0.5))`,
              streak:     0,
              multiplier: 1.0,
            }).where(eq(characterTable.id, char.id));
          }

          invalidateCharacterCache();
        }
      }
    });

    const [updated] = await db.select().from(celestialPowerTable)
      .where(and(eq(celestialPowerTable.characterId, char.id), eq(celestialPowerTable.domainPair, pair)));

    res.json({ domain: updated, overflowTriggered, greatFall, ascensionTriggered });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
