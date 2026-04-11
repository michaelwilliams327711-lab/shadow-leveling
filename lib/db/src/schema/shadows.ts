import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
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

export type ShadowSoldier = typeof shadowArmyTable.$inferSelect;
