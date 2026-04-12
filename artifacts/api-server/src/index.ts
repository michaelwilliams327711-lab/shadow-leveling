import app from "./app";
import { logger } from "./lib/logger";
import { pool, db, characterTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import cron from "node-cron";
import { processOverdueQuestsLogic } from "./routes/quests.js";
import { sendDailyQuestReminders } from "./routes/push.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/**
 * Compute the "local date string" for the configured timezone.
 * Set LOCAL_TZ_OFFSET to a signed integer (e.g. "-5" for UTC-5, "5.5" for UTC+5:30).
 * When unset the cron fires at UTC midnight (offset = 0).
 */
function getLocalDateStr(): string {
  const offsetHours = parseFloat(process.env["LOCAL_TZ_OFFSET"] ?? "-5");
  const offsetMs = (isNaN(offsetHours) ? 0 : offsetHours) * 3600 * 1000;
  return new Date(Date.now() + offsetMs).toISOString().split("T")[0];
}

function getLocalHour(): number {
  const offsetHours = parseFloat(process.env["LOCAL_TZ_OFFSET"] ?? "-5");
  const offsetMs = (isNaN(offsetHours) ? 0 : offsetHours) * 3600 * 1000;
  return new Date(Date.now() + offsetMs).getUTCHours();
}

let _memLastProcessedDate: string | null = null;

cron.schedule("0 * * * *", async () => {
  const localHour = getLocalHour();
  const localDate = getLocalDateStr();

  if (localHour !== 0 && localHour !== 1) {
    return;
  }

  if (_memLastProcessedDate === localDate) {
    return;
  }

  const chars = await db
    .select({ id: characterTable.id, lastCronDate: characterTable.lastCronDate })
    .from(characterTable)
    .limit(1);

  if (chars.length > 0 && chars[0].lastCronDate === localDate) {
    _memLastProcessedDate = localDate;
    logger.info(
      { localDate, localHour },
      "Daily quest auto-refresh: already processed for today (DB check), skipping"
    );
    return;
  }

  if (chars.length > 0) {
    await db
      .update(characterTable)
      .set({ lastCronDate: localDate })
      .where(eq(characterTable.id, chars[0].id));
  }

  _memLastProcessedDate = localDate;
  logger.info(
    { localDate, localHour },
    "Daily quest auto-refresh: local midnight window detected, running overdue processing"
  );

  try {
    const result = await processOverdueQuestsLogic(localDate);
    logger.info(
      { recurringReset: result.recurringReset, penaltiesApplied: result.penaltiesApplied, localDate },
      "Daily quest auto-refresh complete"
    );
  } catch (err) {
    if (chars.length > 0) {
      await db
        .update(characterTable)
        .set({ lastCronDate: null })
        .where(eq(characterTable.id, chars[0].id))
        .catch(() => {});
    }
    _memLastProcessedDate = null;
    logger.error({ err, localDate }, "Daily quest auto-refresh: error during overdue processing");
  }
});

cron.schedule("* * * * *", async () => {
  await sendDailyQuestReminders({
    info: (msg) => logger.info(msg),
    error: (obj, msg) => logger.error(obj, msg),
  });
});

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  if (!process.env.API_SECRET_KEY) {
    logger.warn("========================================================");
    logger.warn("  WARNING: SECURE MODE DISABLED");
    logger.warn("  API_SECRET_KEY is not set.");
    logger.warn("  All API endpoints are publicly accessible.");
    logger.warn("  Set API_SECRET_KEY before deploying to production.");
    logger.warn("========================================================");
  }
});

function shutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal, closing server");
  server.close(async () => {
    try {
      await pool.end();
      logger.info("Database pool closed");
    } catch (err) {
      logger.error({ err }, "Error closing database pool");
    }
    logger.info("Server closed, exiting");
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn("Forceful shutdown after timeout");
    process.exit(1);
  }, 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
