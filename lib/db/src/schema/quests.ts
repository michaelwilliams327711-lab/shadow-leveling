import { pgTable, serial, text, integer, boolean, timestamp, real, jsonb, unique, uuid, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { vocationsTable } from "./vocations";

export const questsTable = pgTable("quests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("Other"),
  difficulty: text("difficulty").notNull().default("D"),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  status: text("status").notNull().default("active"),
  description: text("description"),
  deadline: timestamp("deadline"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  statBoost: text("stat_boost"),
  targetAmount: integer("target_amount"),
  amountUnit: text("amount_unit"),
  isPaused: boolean("is_paused").notNull().default(false),
  recurrence: jsonb("recurrence"),
  vocationId: text("vocation_id").references(() => vocationsTable.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("quests_status_deleted_at_idx").on(table.status, table.deletedAt),
]);

export const questLogTable = pgTable("quest_log", {
  id: serial("id").primaryKey(),
  questName: text("quest_name").notNull(),
  category: text("category").notNull(),
  difficulty: text("difficulty").notNull(),
  outcome: text("outcome").notNull(),
  xpChange: integer("xp_change").notNull(),
  goldChange: integer("gold_change").notNull(),
  multiplierApplied: real("multiplier_applied").notNull().default(1.0),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  actionType: text("action_type").notNull().default("COMPLETED"),
  statCategory: text("stat_category"),
}, (table) => [
  index("quest_log_occurred_at_idx").on(table.occurredAt),
]);

export const penaltyLogTable = pgTable("penalty_log", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id"),
  type: text("type").notNull(),
  description: text("description").notNull(),
  xpDeducted: integer("xp_deducted").notNull().default(0),
  goldDeducted: integer("gold_deducted").notNull().default(0),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
}, (table) => [
  index("penalty_log_occurred_at_idx").on(table.occurredAt),
  index("penalty_log_character_id_idx").on(table.characterId),
]);

export const questDailyLogTable = pgTable("quest_daily_log", {
  id: serial("id").primaryKey(),
  questId: integer("quest_id").notNull().references(() => questsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  currentAmount: integer("current_amount").notNull().default(0),
  isCompleted: boolean("is_completed").notNull().default(false),
}, (table) => [
  unique("quest_daily_log_quest_id_date_unique").on(table.questId, table.date),
  index("quest_daily_log_quest_id_idx").on(table.questId),
]);

export const dailyOrdersTable = pgTable("daily_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: integer("character_id").notNull(),
  name: text("name").notNull(),
  statCategory: text("stat_category").notNull().default("discipline"),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  date: text("date").notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("daily_orders_date_character_id_idx").on(table.date, table.characterId),
]);

export const dailyHiddenBoxRewardsTable = pgTable("daily_hidden_box_rewards", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull(),
  date: text("date").notNull(),
  type: text("type").notNull(),
  goldBonus: integer("gold_bonus"),
  statBoost: integer("stat_boost"),
  stat: text("stat"),
  claimed: boolean("claimed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  claimedAt: timestamp("claimed_at"),
}, (table) => [
  unique("daily_hidden_box_rewards_char_date_unique").on(table.characterId, table.date),
]);

export const insertQuestSchema = createInsertSchema(questsTable).omit({ id: true, createdAt: true, completedAt: true });
export type InsertQuest = z.infer<typeof insertQuestSchema>;
export type Quest = typeof questsTable.$inferSelect;
export type QuestLog = typeof questLogTable.$inferSelect;
export type PenaltyLog = typeof penaltyLogTable.$inferSelect;
export type QuestDailyLog = typeof questDailyLogTable.$inferSelect;
export type DailyOrder = typeof dailyOrdersTable.$inferSelect;
