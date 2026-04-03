import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const merchantMappingsTable = pgTable("merchant_mappings", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull(),
  category: text("category").notNull(),
  accountId: integer("account_id").references(() => accountsTable.id),
  useCount: integer("use_count").notNull().default(1),
  lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
});
