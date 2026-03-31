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

function getUtcDateStr(): string {
  return new Date().toISOString().split("T")[0];
}

function getUtcHour(): number {
  return new Date().getUTCHours();
}

let lastProcessedDate: string | null = null;

cron.schedule("0 * * * *", async () => {
  const utcHour = getUtcHour();
  const utcDate = getUtcDateStr();

  if (utcHour !== 0 && utcHour !== 1) {
    return;
  }

  if (lastProcessedDate === utcDate) {
    logger.info(
      { utcDate, utcHour },
      "Daily quest auto-refresh: already processed for today, skipping"
    );
    return;
  }

  lastProcessedDate = utcDate;
  logger.info(
    { utcDate, utcHour },
    "Daily quest auto-refresh: UTC midnight window detected, running overdue processing"
  );

  try {
    const result = await processOverdueQuestsLogic(utcDate);
    logger.info(
      { recurringReset: result.recurringReset, penaltiesApplied: result.penaltiesApplied, utcDate },
      "Daily quest auto-refresh complete"
    );
  } catch (err) {
    lastProcessedDate = null;
    logger.error({ err, utcDate }, "Daily quest auto-refresh: error during overdue processing");
  }
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
