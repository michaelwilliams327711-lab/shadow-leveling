import { pgTable, serial, integer, text, boolean, index, unique } from "drizzle-orm/pg-core";
import { characterTable } from "./character";

export const celestialPowerTable = pgTable("celestial_power", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull().references(() => characterTable.id, { onDelete: "cascade" }),
  domainPair: text("domain_pair").notNull(),
  viceScore: integer("vice_score").notNull().default(0),
  virtueScore: integer("virtue_score").notNull().default(0),
  isAscended: boolean("is_ascended").notNull().default(false),
}, (table) => [
  unique("celestial_power_character_domain_unique").on(table.characterId, table.domainPair),
  index("celestial_power_character_id_idx").on(table.characterId),
]);

export type CelestialPower = typeof celestialPowerTable.$inferSelect;
