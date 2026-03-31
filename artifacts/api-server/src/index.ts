import app from "./app";
import { logger } from "./lib/logger";
import cron from "node-cron";
import { processOverdueQuestsLogic } from "./routes/quests.js";

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
  const offsetHours = parseFloat(process.env["LOCAL_TZ_OFFSET"] ?? "0");
  const offsetMs = (isNaN(offsetHours) ? 0 : offsetHours) * 3600 * 1000;
  return new Date(Date.now() + offsetMs).toISOString().split("T")[0];
}

function getLocalHour(): number {
  const offsetHours = parseFloat(process.env["LOCAL_TZ_OFFSET"] ?? "0");
  const offsetMs = (isNaN(offsetHours) ? 0 : offsetHours) * 3600 * 1000;
  return new Date(Date.now() + offsetMs).getUTCHours();
}

let lastProcessedDate: string | null = null;

cron.schedule("0 * * * *", async () => {
  const localHour = getLocalHour();
  const localDate = getLocalDateStr();

  if (localHour !== 0 && localHour !== 1) {
    return;
  }

  if (lastProcessedDate === localDate) {
    logger.info(
      { localDate, localHour },
      "Daily quest auto-refresh: already processed for today, skipping"
    );
    return;
  }

  lastProcessedDate = localDate;
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
    lastProcessedDate = null;
    logger.error({ err, localDate }, "Daily quest auto-refresh: error during overdue processing");
  }
});

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

function shutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal, closing server");
  server.close(() => {
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
