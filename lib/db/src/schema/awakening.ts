import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { characterTable } from "./character";

export const awakeningTable = pgTable("awakening", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").references(() => characterTable.id, { onDelete: "cascade" }),
  vision: text("vision"),
  antiVision: text("anti_vision"),
  coreValues: text("core_values"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAwakeningSchema = createInsertSchema(awakeningTable).omit({ id: true });
export type InsertAwakening = z.infer<typeof insertAwakeningSchema>;
export type Awakening = typeof awakeningTable.$inferSelect;
