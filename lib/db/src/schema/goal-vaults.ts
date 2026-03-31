import { pgTable, serial, text, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const goalVaultsTable = pgTable("goal_vaults", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  currentBalance: numeric("current_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull().default("0"),
});

export const insertGoalVaultSchema = createInsertSchema(goalVaultsTable).omit({ id: true });
export type InsertGoalVault = z.infer<typeof insertGoalVaultSchema>;
export type GoalVault = typeof goalVaultsTable.$inferSelect;
