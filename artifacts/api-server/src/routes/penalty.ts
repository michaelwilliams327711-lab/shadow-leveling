import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { characterTable, questLogTable, questsTable, celestialPowerTable } from "@workspace/db";
import { eq, and, isNull, lt, gt } from "drizzle-orm";
import { getOrCreateCharacter } from "./character.js";

const router: IRouter = Router();

router.post("/penalty/acknowledge", async (req, res) => {
  try {
    const char = await getOrCreateCharacter();

    const [overdueQuests, highVice] = await Promise.all([
      db
        .select({ id: questsTable.id })
        .from(questsTable)
        .where(
          and(
            eq(questsTable.status, "active"),
            isNull(questsTable.deletedAt),
            lt(questsTable.deadline, new Date()),
          ),
        )
        .limit(1),
      db
        .select({ id: celestialPowerTable.id })
        .from(celestialPowerTable)
        .where(
          and(
            eq(celestialPowerTable.characterId, char.id),
            gt(celestialPowerTable.viceScore, 50),
          ),
        )
        .limit(1),
    ]);

    const isValidPenalty =
      overdueQuests.length > 0 || highVice.length > 0 || char.corruption >= 30;

    if (!isValidPenalty) {
      return res
        .status(400)
        .json({ error: "No active penalty condition detected. Trial cannot be acknowledged." });
    }

    const buffExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await Promise.all([
      db.insert(questLogTable).values({
        characterId: char.id,
        questName: "[ SYSTEM: TRIAL SURVIVED ]",
        category: "Other",
        difficulty: "SSS",
        outcome: "PENALTY_CLEARED",
        xpChange: 0,
        goldChange: 0,
        multiplierApplied: 1.05,
        actionType: "PENALTY_CLEARED",
      }),
      db
        .update(characterTable)
        .set({ survivorBuffExpiresAt: buffExpiry })
        .where(eq(characterTable.id, char.id)),
    ]);

    res.json({
      ok: true,
      message: "Trial of the Unworthy: Debt settled. Survivor's Will activated.",
      buff: {
        name: "Survivor's Will",
        multiplier: 1.05,
        expiresAt: buffExpiry.toISOString(),
        description: "5% Spirit XP multiplier for 24 hours — earned through the Trial.",
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error acknowledging penalty");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
