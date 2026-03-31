import { pgTable, serial, text, numeric, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { accountsTable } from "./accounts";

export const goalsTable = pgTable("goals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  currentAmount: numeric("current_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  accountId: integer("account_id").references(() => accountsTable.id).notNull(),
  status: text("status").notNull().default("Active"),
  targetDate: date("target_date"),
  categoryType: text("category_type").notNull().default("General"),
  icon: text("icon"),
});

export const insertGoalSchema = createInsertSchema(goalsTable).omit({ id: true });
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goalsTable.$inferSelect;
