import { pgTable, serial, text, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const monthlyConfigTable = pgTable("monthly_config", {
  id: serial("id").primaryKey(),
  month: text("month").notNull().unique(),
  startingBalance: numeric("starting_balance", { precision: 12, scale: 2 }).notNull().default("0"),
});

export const insertMonthlyConfigSchema = createInsertSchema(monthlyConfigTable).omit({ id: true });
export type InsertMonthlyConfig = z.infer<typeof insertMonthlyConfigSchema>;
export type MonthlyConfig = typeof monthlyConfigTable.$inferSelect;
