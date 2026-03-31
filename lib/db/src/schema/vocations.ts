import { pgTable, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { questsTable } from "./quests";
import { sql } from "drizzle-orm";

export const vocationsTable = pgTable("vocations", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  currentTitleIndex: integer("current_title_index").notNull().default(0),
  currentLevel: integer("current_level").notNull().default(1),
  currentXp: integer("current_xp").notNull().default(0),
  gateThreshold: integer("gate_threshold").notNull().default(20),
  gateActive: boolean("gate_active").notNull().default(false),
  milestoneQuestDescription: text("milestone_quest_description"),
  titleLadder: jsonb("title_ladder").notNull().default(sql`'["Novice"]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const vocationLogTable = pgTable("vocation_log", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  vocationId: text("vocation_id").notNull().references(() => vocationsTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  delta: integer("delta").notNull().default(0),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertVocationSchema = createInsertSchema(vocationsTable).omit({ id: true, createdAt: true });
export type InsertVocation = z.infer<typeof insertVocationSchema>;
export type Vocation = typeof vocationsTable.$inferSelect;
export type VocationLog = typeof vocationLogTable.$inferSelect;
