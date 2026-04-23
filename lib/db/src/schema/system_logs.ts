import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const systemLogsTable = pgTable("system_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  level: text("level").notNull(),
  message: text("message").notNull(),
  context: jsonb("context"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => [
  index("system_logs_timestamp_idx").on(table.timestamp),
  index("system_logs_level_idx").on(table.level),
]);

export type SystemLog = typeof systemLogsTable.$inferSelect;
export type InsertSystemLog = typeof systemLogsTable.$inferInsert;
