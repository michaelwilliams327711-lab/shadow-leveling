import { pgTable, text, integer, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { characterTable } from "./character";

export const badHabitsTable = pgTable("bad_habits", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: integer("character_id").references(() => characterTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("Other"),
  severity: text("severity").notNull().default("Medium"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isActive: integer("is_active").notNull().default(1),
  deletedAt: timestamp("deleted_at"),
  sinCategory: text("sin_category"),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastCleanDate: text("last_clean_date"),
}, (table) => [
  index("bad_habits_deleted_at_idx").on(table.deletedAt),
]);

export const badHabitLogTable = pgTable("bad_habit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  habitId: uuid("habit_id").notNull().references(() => badHabitsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  type: text("type").notNull(),
  corruptionDelta: integer("corruption_delta").notNull().default(0),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
});

export const insertBadHabitSchema = createInsertSchema(badHabitsTable).omit({ id: true, createdAt: true });
export type InsertBadHabit = z.infer<typeof insertBadHabitSchema>;
export type BadHabit = typeof badHabitsTable.$inferSelect;
export type BadHabitLog = typeof badHabitLogTable.$inferSelect;
