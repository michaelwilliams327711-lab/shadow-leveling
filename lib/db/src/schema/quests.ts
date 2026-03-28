import { pgTable, serial, text, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const questsTable = pgTable("quests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("Other"),
  difficulty: text("difficulty").notNull().default("D"),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  xpReward: integer("xp_reward").notNull().default(50),
  goldReward: integer("gold_reward").notNull().default(25),
  xpPenalty: integer("xp_penalty").notNull().default(25),
  goldPenalty: integer("gold_penalty").notNull().default(10),
  status: text("status").notNull().default("active"),
  isDaily: boolean("is_daily").notNull().default(false),
  description: text("description"),
  deadline: timestamp("deadline"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  statBoost: text("stat_boost"),
});

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
});

export const penaltyLogTable = pgTable("penalty_log", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  xpDeducted: integer("xp_deducted").notNull().default(0),
  goldDeducted: integer("gold_deducted").notNull().default(0),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
});

export const insertQuestSchema = createInsertSchema(questsTable).omit({ id: true, createdAt: true, completedAt: true });
export type InsertQuest = z.infer<typeof insertQuestSchema>;
export type Quest = typeof questsTable.$inferSelect;
export type QuestLog = typeof questLogTable.$inferSelect;
export type PenaltyLog = typeof penaltyLogTable.$inferSelect;
