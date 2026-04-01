import { pgTable, serial, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";

export const budgetGoalsTable = pgTable("budget_goals", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().unique().references(() => categoriesTable.id),
  plannedAmount: numeric("planned_amount", { precision: 12, scale: 2 }).notNull().default("0"),
});

export const insertBudgetGoalSchema = createInsertSchema(budgetGoalsTable).omit({ id: true });
export type InsertBudgetGoal = z.infer<typeof insertBudgetGoalSchema>;
export type BudgetGoal = typeof budgetGoalsTable.$inferSelect;
