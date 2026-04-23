import { pgTable, uuid, text, integer } from "drizzle-orm/pg-core";

export const shopItemsTable = pgTable("shop_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  cost: integer("cost").notNull(),
  category: text("category").notNull(),
  icon: text("icon").notNull(),
});

export type ShopItem = typeof shopItemsTable.$inferSelect;
export type InsertShopItem = typeof shopItemsTable.$inferInsert;
