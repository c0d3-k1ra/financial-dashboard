import { db, budgetGoalsTable, accountsTable, categoriesTable, transactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { BUDGET_DEFAULTS, DEFAULT_PLANNED } from "./budget-defaults";

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
      let updated = 0;
      for (const goal of existing) {
        if (Number(goal.plannedAmount) === 0 && goal.category !== "EMI (PL)") {
          const defaultAmount = BUDGET_DEFAULTS[goal.category] ?? DEFAULT_PLANNED;
          await db
            .update(budgetGoalsTable)
            .set({ plannedAmount: defaultAmount.toFixed(2) })
            .where(eq(budgetGoalsTable.id, goal.id));
          updated++;
        }
      }
      if (updated > 0) {
        logger.info({ count: updated }, "Updated budget goals with default amounts");
      }

      const existingCategories = existing.map((g) => g.category);
      const expenseCats = await db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.type, "Expense"));
      let inserted = 0;
      for (const cat of expenseCats) {
        if (!existingCategories.includes(cat.name)) {
          const defaultAmount = cat.name === "EMI (PL)" ? 0 : (BUDGET_DEFAULTS[cat.name] ?? DEFAULT_PLANNED);
          await db.insert(budgetGoalsTable).values({
            category: cat.name,
            plannedAmount: defaultAmount.toFixed(2),
          });
          inserted++;
        }
      }
      if (inserted > 0) {
        logger.info({ count: inserted }, "Created missing budget goals for existing categories");
      }

      if (updated === 0 && inserted === 0) {
        logger.info("Budget categories already seeded, skipping");
      }
      return;
    }

    const values = EXPENSE_CATEGORIES.map((category) => ({
      category,
      plannedAmount: category === "EMI (PL)" ? "0.00" : (BUDGET_DEFAULTS[category] ?? DEFAULT_PLANNED).toFixed(2),
    }));

    await db.insert(budgetGoalsTable).values(values);
    logger.info({ count: values.length }, "Seeded budget categories with defaults");
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
