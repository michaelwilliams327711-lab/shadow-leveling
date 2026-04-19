import app from "./app";
import { logger } from "./lib/logger";
import { pool, db, characterTable, questsTable } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db/schema";
import { eq, and, isNull, lt, inArray } from "drizzle-orm";
import cron from "node-cron";
import { processOverdueQuestsLogic } from "./routes/quests.js";
import { sendDailyQuestReminders, sendOverseerPenaltyNotification } from "./routes/push.js";

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
 * Get the timezone offset in hours.
 * Priority: push_subscriptions table (user's actual device timezone) → LOCAL_TZ_OFFSET env var → 0 (UTC).
 * push_subscriptions stores timezone_offset in minutes (e.g. -300 for UTC-5, 60 for UTC+1).
 */
async function getDynamicTimezoneOffsetHours(): Promise<number> {
  // Priority 1: device timezone from push subscription record
  try {
    const subs = await db
      .select({ timezoneOffset: pushSubscriptionsTable.timezoneOffset })
      .from(pushSubscriptionsTable)
      .limit(1);
    if (subs.length > 0) {
      const offsetHours = subs[0].timezoneOffset / 60;
      logger.debug({ offsetHours, source: "push_subscriptions" }, "[SYSTEM] Timezone resolved from push subscription.");
      return offsetHours;
    }
  } catch (err) {
    logger.warn({ err }, "[SYSTEM] Could not read push_subscriptions table for timezone; falling through.");
  }

  // Priority 2: LOCAL_TZ_OFFSET environment variable
  const envOffset = process.env["LOCAL_TZ_OFFSET"];
  if (envOffset !== undefined && envOffset.trim() !== "") {
    const parsed = parseFloat(envOffset);
    if (!isNaN(parsed)) {
      logger.debug({ offsetHours: parsed, source: "LOCAL_TZ_OFFSET" }, "[SYSTEM] Timezone resolved from LOCAL_TZ_OFFSET env var.");
      return parsed;
    }
    logger.warn({ envOffset }, "[SYSTEM] LOCAL_TZ_OFFSET is set but not a valid number; falling back to UTC.");
  }

  // Priority 3: EST fallback (-5) per spec default — emit a warning so the source is visible in logs
  logger.warn(
    "[SYSTEM] No timezone source found. Defaulting to EST (-5). " +
    "Set LOCAL_TZ_OFFSET (e.g. -5 for EST) or enable push notifications to override."
  );
  return -5;
}

function computeLocalDateTime(offsetHours: number): { localDate: string; localHour: number } {
  const offsetMs = (isNaN(offsetHours) ? 0 : offsetHours) * 3600 * 1000;
  const adjusted = new Date(Date.now() + offsetMs);
  const localDate = adjusted.toISOString().split("T")[0]!;
  const localHour = adjusted.getUTCHours();
  return { localDate, localHour };
}

let _memLastProcessedDate: string | null = null;

cron.schedule("0 * * * *", async () => {
  const offsetHours = await getDynamicTimezoneOffsetHours();
  const { localDate, localHour } = computeLocalDateTime(offsetHours);

  if (localHour !== 0 && localHour !== 1) {
    return;
  }

  if (_memLastProcessedDate === localDate) {
    return;
  }

  // Get ALL characters — process every hunter, not just the first
  const chars = await db
    .select({ id: characterTable.id, lastCronDate: characterTable.lastCronDate })
    .from(characterTable);

  if (chars.length === 0) {
    return;
  }

  const unprocessed = chars.filter(c => c.lastCronDate !== localDate);

  if (unprocessed.length === 0) {
    _memLastProcessedDate = localDate;
    logger.info(
      { localDate, localHour },
      "Daily quest auto-refresh: already processed for today (DB check), skipping"
    );
    return;
  }

  logger.info(
    { localDate, localHour },
    "Daily quest auto-refresh: local midnight window detected, running overdue processing"
  );

  try {
    const result = await processOverdueQuestsLogic(localDate);
    _memLastProcessedDate = localDate;
    logger.info(
      { recurringReset: result.recurringReset, penaltiesApplied: result.penaltiesApplied, localDate },
      "Daily quest auto-refresh complete"
    );
  } catch (err) {
    logger.error({ err, localDate }, "Daily quest auto-refresh: error during overdue processing");
  }
});

let _overseerLastAlertDate: string | null = null;

cron.schedule("* * * * *", async () => {
  await sendDailyQuestReminders({
    info: (msg) => logger.info(msg),
    error: (obj, msg) => logger.error(obj, msg),
  });

  const offsetHours = await getDynamicTimezoneOffsetHours();
  const { localDate, localHour } = computeLocalDateTime(offsetHours);

  if (localHour < 20) return;
  if (_overseerLastAlertDate === localDate) return;

  try {
    const overdueQuests = await db
      .select({ id: questsTable.id })
      .from(questsTable)
      .where(and(
        eq(questsTable.status, "active"),
        isNull(questsTable.deletedAt),
        lt(questsTable.deadline, new Date()),
      ))
      .limit(1);

    if (overdueQuests.length === 0) return;

    _overseerLastAlertDate = localDate;
    logger.warn({ localDate, localHour }, "Overseer: overdue quests detected — firing penalty alert");
    await sendOverseerPenaltyNotification({
      info: (msg) => logger.info(msg),
      error: (obj, msg) => logger.error(obj, msg),
    });
  } catch (err) {
    logger.error({ err }, "Overseer cron: error checking overdue quests");
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
