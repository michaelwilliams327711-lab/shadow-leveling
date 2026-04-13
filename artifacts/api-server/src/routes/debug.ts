import { Router, type IRouter } from "express";
import { processOverdueQuestsLogic } from "./quests.js";

const router: IRouter = Router();

if (process.env["NODE_ENV"] !== "production") {
  /**
   * POST /api/debug/force-penalty
   *
   * Immediately runs the Overseer logic as if it is tomorrow — any quest
   * whose deadline is today or earlier is treated as overdue and failed.
   * Returns the full penalty payload so the frontend Penalty Modal can be tested
   * without waiting for midnight.
   *
   * DEVELOPMENT ONLY — not mounted in production.
   */
  router.post("/debug/force-penalty", async (req, res) => {
    try {
      const now = new Date();
      now.setUTCDate(now.getUTCDate() + 1);
      const tomorrowStr = now.toISOString().split("T")[0]!;

      const result = await processOverdueQuestsLogic(tomorrowStr);

      res.json({
        _debug: true,
        referenceDate: tomorrowStr,
        recurringReset: result.recurringReset,
        penaltiesApplied: result.penaltiesApplied,
        penalties: result.penalties,
        autoFailedQuests: result.autoFailedQuests,
      });
    } catch (err) {
      req.log.error({ err }, "debug/force-penalty: error");
      res.status(500).json({ error: "Internal server error" });
    }
  });
}

export default router;
