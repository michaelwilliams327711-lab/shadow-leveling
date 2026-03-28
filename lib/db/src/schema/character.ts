import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const characterTable = pgTable("character", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Hunter"),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  gold: integer("gold").notNull().default(0),
  strength: integer("strength").notNull().default(10),
  intellect: integer("intellect").notNull().default(10),
  endurance: integer("endurance").notNull().default(10),
  agility: integer("agility").notNull().default(10),
  discipline: integer("discipline").notNull().default(10),
  streak: integer("streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  multiplier: real("multiplier").notNull().default(1.0),
  lastCheckin: timestamp("last_checkin"),
  totalQuestsCompleted: integer("total_quests_completed").notNull().default(0),
  totalQuestsFailed: integer("total_quests_failed").notNull().default(0),
});

export const insertCharacterSchema = createInsertSchema(characterTable).omit({ id: true });
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof characterTable.$inferSelect;
