import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { goalsTable } from "./goals";
import { accountsTable } from "./accounts";

export const surplusAllocationsTable = pgTable("surplus_allocations", {
  id: serial("id").primaryKey(),
  month: text("month").notNull(),
  goalId: integer("goal_id").references(() => goalsTable.id).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  sourceAccountId: integer("source_account_id").references(() => accountsTable.id),
  allocatedAt: timestamp("allocated_at").defaultNow().notNull(),
});

export const insertSurplusAllocationSchema = createInsertSchema(surplusAllocationsTable).omit({ id: true, allocatedAt: true });
export type InsertSurplusAllocation = z.infer<typeof insertSurplusAllocationSchema>;
export type SurplusAllocation = typeof surplusAllocationsTable.$inferSelect;
