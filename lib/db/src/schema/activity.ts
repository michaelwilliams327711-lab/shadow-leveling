import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const activityTable = pgTable("activity", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),
  count: integer("count").notNull().default(0),
  level: integer("level").notNull().default(0),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
}, (table) => [
  index("activity_date_idx").on(table.date),
]);

export const insertActivitySchema = createInsertSchema(activityTable).omit({ id: true, recordedAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activityTable.$inferSelect;
