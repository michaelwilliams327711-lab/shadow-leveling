import { db, systemLogsTable } from "@workspace/db";
import { logger } from "./logger.js";

export type SystemLogLevel = "info" | "warn" | "error";

export async function writeSystemLog(
  level: SystemLogLevel,
  message: string,
  context?: Record<string, unknown> | null,
): Promise<void> {
  try {
    await db.insert(systemLogsTable).values({
      level,
      message: message.slice(0, 8000),
      context: context ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to persist system_log entry");
  }
}
