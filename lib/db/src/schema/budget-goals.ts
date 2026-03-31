import { pgTable, serial, text, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const budgetGoalsTable = pgTable("budget_goals", {
  id: serial("id").primaryKey(),
  category: text("category").notNull().unique(),
  plannedAmount: numeric("planned_amount", { precision: 12, scale: 2 }).notNull().default("0"),
});

export const insertBudgetGoalSchema = createInsertSchema(budgetGoalsTable).omit({ id: true });
export type InsertBudgetGoal = z.infer<typeof insertBudgetGoalSchema>;
export type BudgetGoal = typeof budgetGoalsTable.$inferSelect;
