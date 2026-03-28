import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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
  isDefeated: boolean("is_defeated").notNull().default(false),
  defeatRecordedAt: timestamp("defeat_recorded_at"),
  failureRecordedAt: timestamp("failure_recorded_at"),
});

export const insertBossSchema = createInsertSchema(bossesTable).omit({ id: true });
export type InsertBoss = z.infer<typeof insertBossSchema>;
export type Boss = typeof bossesTable.$inferSelect;
