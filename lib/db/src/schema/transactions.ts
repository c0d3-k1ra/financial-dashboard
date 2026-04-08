import { pgTable, serial, text, numeric, date, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { accountsTable } from "./accounts";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  type: text("type").notNull(),
  accountId: integer("account_id").references(() => accountsTable.id),
  toAccountId: integer("to_account_id").references(() => accountsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("transactions_date_idx").on(table.date),
  index("transactions_type_idx").on(table.type),
  index("transactions_account_id_idx").on(table.accountId),
  index("transactions_to_account_id_idx").on(table.toAccountId),
  index("transactions_category_idx").on(table.category),
]);

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
