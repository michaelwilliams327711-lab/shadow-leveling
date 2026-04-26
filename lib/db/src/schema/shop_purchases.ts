import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { shopItemsTable } from "./shop_items";
import { characterTable } from "./character";

export const shopPurchasesTable = pgTable(
  "shop_purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => shopItemsTable.id, { onDelete: "set null" }),
    characterId: integer("character_id")
      .notNull()
      .references(() => characterTable.id, { onDelete: "cascade" }),
    itemName: text("item_name").notNull(),
    goldSpent: integer("gold_spent").notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    characterIdIdx: index("shop_purchases_character_id_idx").on(table.characterId),
    redeemedAtIdx: index("shop_purchases_redeemed_at_idx").on(table.redeemedAt),
    characterRedeemedIdx: index("shop_purchases_character_redeemed_idx").on(
      table.characterId,
      table.redeemedAt,
    ),
  }),
);

export type ShopPurchase = typeof shopPurchasesTable.$inferSelect;
export type InsertShopPurchase = typeof shopPurchasesTable.$inferInsert;
