import { db, budgetGoalsTable, accountsTable, categoriesTable, transactionsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
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

const INCOME_CATEGORIES = ["Paycheck (Salary)", "Bonus", "Interest", "Other"] as const;

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

export async function seedAccountsAndCategories() {
  try {
    const existingAccounts = await db.select().from(accountsTable);
    let primaryBankId: number;

    if (existingAccounts.length === 0) {
      const [primaryBank] = await db
        .insert(accountsTable)
        .values({ name: "Primary Bank", type: "bank", currentBalance: "0" })
        .returning();
      primaryBankId = primaryBank.id;
      logger.info("Created default Primary Bank account");
    } else {
      primaryBankId = existingAccounts[0].id;
      logger.info("Accounts already exist, skipping creation");
    }

    const existingCategories = await db.select().from(categoriesTable);
    if (existingCategories.length === 0) {
      const categoryValues = [
        ...EXPENSE_CATEGORIES.map((name) => ({ name, type: "Expense" })),
        ...INCOME_CATEGORIES.map((name) => ({ name, type: "Income" })),
      ];
      await db.insert(categoriesTable).values(categoryValues);
      logger.info({ count: categoryValues.length }, "Seeded categories");
    } else {
      logger.info("Categories already exist, skipping");
    }

    const [unmappedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.accountId} IS NULL`);

    const unmappedCount = Number(unmappedResult.count);
    if (unmappedCount > 0) {
      await db
        .update(transactionsTable)
        .set({ accountId: primaryBankId })
        .where(sql`${transactionsTable.accountId} IS NULL`);
      logger.info({ count: unmappedCount }, "Mapped unmapped transactions to Primary Bank");
    }
  } catch (e) {
    logger.error({ err: e }, "Failed to seed accounts and categories");
  }
}
