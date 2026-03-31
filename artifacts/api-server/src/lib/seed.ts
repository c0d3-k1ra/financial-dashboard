import { db, budgetGoalsTable } from "@workspace/db";
import { logger } from "./logger";

const EXPENSE_CATEGORIES = [
  "EMI (PL)",
  "Father",
  "Credit Card (CC)",
  "Living Expenses",
  "SIP (Investment)",
  "Travel Fund",
  "Term Insurance",
  "Health Insurance",
  "Food",
  "Gifts",
  "Home",
  "Transportation",
  "Personal",
  "Utilities",
  "Medical",
  "Other (Tax)",
] as const;

export async function seedBudgetCategories() {
  try {
    const existing = await db.select().from(budgetGoalsTable);
    if (existing.length > 0) {
      logger.info("Budget categories already seeded, skipping");
      return;
    }

    const values = EXPENSE_CATEGORIES.map((category) => ({
      category,
      plannedAmount: "0.00",
    }));

    await db.insert(budgetGoalsTable).values(values);
    logger.info({ count: values.length }, "Seeded budget categories");
  } catch (e) {
    logger.error({ err: e }, "Failed to seed budget categories");
  }
}
