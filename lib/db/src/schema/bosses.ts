import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { characterTable } from "./character";

export const bossesTable = pgTable("bosses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  rank: text("rank").notNull().default("D"),
  xpThreshold: integer("xp_threshold").notNull().default(1000),
  xpReward: integer("xp_reward").notNull().default(500),
  goldReward: integer("gold_reward").notNull().default(1000),
  xpPenalty: integer("xp_penalty").notNull().default(300),
  challenge: text("challenge").notNull(),
  maxHp: integer("max_hp").notNull().default(1000),
  currentHp: integer("current_hp").notNull().default(1000),
  isDefeated: boolean("is_defeated").notNull().default(false),
  isExtracted: boolean("is_extracted").notNull().default(false),
  gateUnlocked: boolean("gate_unlocked").notNull().default(false),
  /** @deprecated Boss visibility is governed by xpThreshold and gateUnlocked only. */
  intellectRequirement: integer("intellect_requirement").notNull().default(0),
  defeatRecordedAt: timestamp("defeat_recorded_at"),
  failureRecordedAt: timestamp("failure_recorded_at"),
  lastDamageAt: timestamp("last_damage_at"),
  lastRetaliationAt: timestamp("last_retaliation_at"),
});

export const bossDamageLogTable = pgTable("boss_damage_log", {
  id: serial("id").primaryKey(),
  bossId: integer("boss_id").notNull().references(() => bossesTable.id, { onDelete: "cascade" }),
  characterId: integer("character_id").notNull().references(() => characterTable.id, { onDelete: "cascade" }),
  damageAmount: integer("damage_amount").notNull(),
  sourceDesc: text("source_desc").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertBossSchema = createInsertSchema(bossesTable).omit({ id: true });
export type InsertBoss = z.infer<typeof insertBossSchema>;
export type Boss = typeof bossesTable.$inferSelect;
export type BossDamageLog = typeof bossDamageLogTable.$inferSelect;
