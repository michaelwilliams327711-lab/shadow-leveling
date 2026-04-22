import { Router, type IRouter } from "express";
import { writeSystemLog, type SystemLogLevel } from "../lib/system-logger.js";

const router: IRouter = Router();

const ALLOWED_LEVELS = new Set<SystemLogLevel>(["info", "warn", "error"]);

router.post("/logs", async (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      level?: string;
      message?: string;
      context?: Record<string, unknown> | null;
    };

    const rawLevel = (body.level ?? "error").toLowerCase();
    const level: SystemLogLevel = ALLOWED_LEVELS.has(rawLevel as SystemLogLevel)
      ? (rawLevel as SystemLogLevel)
      : "error";

    const message = typeof body.message === "string" && body.message.length > 0
      ? body.message
      : "client_log";

    const context: Record<string, unknown> = {
      source: "client",
      userAgent: req.headers["user-agent"] ?? null,
      ...(body.context && typeof body.context === "object" ? body.context : {}),
    };

    await writeSystemLog(level, message, context);

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error writing client log");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
