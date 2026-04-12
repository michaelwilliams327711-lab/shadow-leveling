import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  reminderEnabled: boolean("reminder_enabled").notNull().default(true),
  reminderHour: integer("reminder_hour").notNull().default(9),
  reminderMinute: integer("reminder_minute").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
