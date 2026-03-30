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

const DEFAULT_TIMEZONE = "America/New_York";

function getLocalDateStr(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getLocalHour(timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const hourPart = parts.find(p => p.type === "hour");
  return hourPart ? parseInt(hourPart.value, 10) : -1;
}

let lastProcessedDate: string | null = null;

cron.schedule("0 * * * *", async () => {
  const localHour = getLocalHour(DEFAULT_TIMEZONE);
  const localDate = getLocalDateStr(DEFAULT_TIMEZONE);

  if (localHour !== 0 && localHour !== 1) {
    return;
  }

  if (lastProcessedDate === localDate) {
    logger.info(
      { timezone: DEFAULT_TIMEZONE, localDate, localHour },
      "Daily quest auto-refresh: already processed for today, skipping"
    );
    return;
  }

  lastProcessedDate = localDate;
  logger.info(
    { timezone: DEFAULT_TIMEZONE, localDate, localHour },
    "Daily quest auto-refresh: midnight window detected, running overdue processing"
  );

  try {
    const result = await processOverdueQuestsLogic();
    logger.info(
      { recurringReset: result.recurringReset, penaltiesApplied: result.penaltiesApplied, localDate, timezone: DEFAULT_TIMEZONE },
      "Daily quest auto-refresh complete"
    );
  } catch (err) {
    lastProcessedDate = null;
    logger.error({ err, localDate, timezone: DEFAULT_TIMEZONE }, "Daily quest auto-refresh: error during overdue processing");
  }
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
