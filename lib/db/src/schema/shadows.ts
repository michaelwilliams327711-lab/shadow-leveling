import { pgTable, serial, integer, text, timestamp, real } from "drizzle-orm/pg-core";
import { characterTable } from "./character";

export const shadowArmyTable = pgTable("shadow_army", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull().references(() => characterTable.id),
  name: text("name").notNull(),
  rank: text("rank").notNull(),
  specialAbility: text("special_ability").notNull(),
  assignedTaskId: integer("assigned_task_id"),
  extractedAt: timestamp("extracted_at").defaultNow(),
});

export const shadowJournalTable = pgTable("shadow_journal", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull().references(() => characterTable.id),
  shadowId: integer("shadow_id"),
  shadowName: text("shadow_name").notNull(),
  shadowRank: text("shadow_rank").notNull(),
  questId: integer("quest_id"),
  questName: text("quest_name").notNull(),
  questCategory: text("quest_category").notNull(),
  questDifficulty: text("quest_difficulty").notNull(),
  shadowBonusPct: real("shadow_bonus_pct").notNull(),
  xpAwarded: integer("xp_awarded").notNull(),
  goldAwarded: integer("gold_awarded").notNull(),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
});

export type ShadowSoldier = typeof shadowArmyTable.$inferSelect;
export type ShadowJournalEntry = typeof shadowJournalTable.$inferSelect;
