import { pgTable, serial, text, numeric, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type").notNull().default("Bank"),
  currentBalance: numeric("current_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }),
  billingDueDay: integer("billing_due_day"),
  emiAmount: numeric("emi_amount", { precision: 12, scale: 2 }),
  emiDay: integer("emi_day"),
  loanTenure: integer("loan_tenure"),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }),
  linkedAccountId: integer("linked_account_id"),
  useInSurplus: boolean("use_in_surplus").notNull().default(false),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({ id: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
