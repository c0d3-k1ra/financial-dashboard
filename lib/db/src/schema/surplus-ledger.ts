import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const surplusLedgerTable = pgTable("surplus_ledger", {
  id: serial("id").primaryKey(),
  month: text("month").notNull().unique(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  vaultName: text("vault_name").notNull(),
  consolidatedAt: timestamp("consolidated_at").notNull().defaultNow(),
});

export const insertSurplusLedgerSchema = createInsertSchema(surplusLedgerTable).omit({ id: true, consolidatedAt: true });
export type InsertSurplusLedger = z.infer<typeof insertSurplusLedgerSchema>;
export type SurplusLedger = typeof surplusLedgerTable.$inferSelect;
