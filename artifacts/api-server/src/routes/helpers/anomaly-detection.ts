import { eq, desc, sql, and, ilike, gte, lte } from "drizzle-orm";
import { likeContains } from "../../lib/escape-like";
import {
  db,
  transactionsTable,
  categoriesTable,
  budgetGoalsTable,
  appSettingsTable,
} from "@workspace/db";

export interface SpendingAnomaly {
  type: "category" | "merchant";
  currentAmount: number;
  averageAmount: number;
  ratio: number;
  typicalAmount?: number;
}

export async function detectSpendingAnomaly(
  amount: number,
  category: string,
  description: string,
): Promise<SpendingAnomaly | null> {
  if (!amount || amount <= 0) return null;

  if (description) {
    const merchantRows = await db
      .select({ amount: transactionsTable.amount })
      .from(transactionsTable)
      .where(and(
        ilike(transactionsTable.description, likeContains(description)),
        sql`${transactionsTable.type} != 'Transfer'`,
      ))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(20);

    if (merchantRows.length >= 3) {
      const merchantAmounts = merchantRows.map(r => Number(r.amount));
      const merchantAvg = merchantAmounts.reduce((s, a) => s + a, 0) / merchantAmounts.length;
      if (merchantAvg > 0 && amount >= merchantAvg * 3) {
        return {
          type: "merchant",
          currentAmount: amount,
          averageAmount: Math.round(merchantAvg),
          ratio: Math.round(amount / merchantAvg * 10) / 10,
          typicalAmount: Math.round(merchantAvg),
        };
      }
    }
  }

  if (category && category !== "Transfer") {
    const catRows = await db
      .select({ amount: transactionsTable.amount })
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.category, category),
        sql`${transactionsTable.type} != 'Transfer'`,
      ))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(30);

    if (catRows.length >= 3) {
      const catAmounts = catRows.map(r => Number(r.amount));
      const catAvg = catAmounts.reduce((s, a) => s + a, 0) / catAmounts.length;
      if (catAvg > 0 && amount >= catAvg * 3) {
        return {
          type: "category",
          currentAmount: amount,
          averageAmount: Math.round(catAvg),
          ratio: Math.round(amount / catAvg * 10) / 10,
        };
      }
    }
  }

  return null;
}

export interface BudgetWarning {
  categoryName: string;
  budgetAmount: number;
  spentSoFar: number;
  afterTransaction: number;
  isOverBudget: boolean;
}

export async function checkBudgetWarning(
  category: string,
  amount: number,
  userCategories: { name: string; type: string }[],
): Promise<BudgetWarning | null> {
  if (!category || category === "Transfer" || !amount || amount <= 0) return null;

  const catInfo = userCategories.find(c => c.name === category);
  if (!catInfo || catInfo.type !== "Expense") return null;

  const [catRow] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.name, category))
    .limit(1);

  if (!catRow) return null;

  const [budgetRow] = await db
    .select()
    .from(budgetGoalsTable)
    .where(eq(budgetGoalsTable.categoryId, catRow.id))
    .limit(1);

  if (!budgetRow || Number(budgetRow.plannedAmount) <= 0) return null;

  const budgetAmount = Number(budgetRow.plannedAmount);

  const [settings] = await db.select().from(appSettingsTable).limit(1);
  const billingDay = settings?.billingCycleDay ?? 25;

  const now = new Date();
  let cycleStart: Date;
  let cycleEnd: Date;

  if (now.getDate() >= billingDay) {
    cycleStart = new Date(now.getFullYear(), now.getMonth(), billingDay);
    cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, billingDay - 1);
  } else {
    cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, billingDay);
    cycleEnd = new Date(now.getFullYear(), now.getMonth(), billingDay - 1);
  }

  const startStr = cycleStart.toISOString().split("T")[0];
  const endStr = cycleEnd.toISOString().split("T")[0];

  const [spentRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), '0')`.as("total"),
    })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.category, category),
      sql`${transactionsTable.type} = 'Expense'`,
      gte(transactionsTable.date, startStr),
      lte(transactionsTable.date, endStr),
    ));

  const spentSoFar = Number(spentRow?.total ?? 0);
  const afterTransaction = spentSoFar + amount;

  if (afterTransaction > budgetAmount) {
    return {
      categoryName: category,
      budgetAmount,
      spentSoFar: Math.round(spentSoFar),
      afterTransaction: Math.round(afterTransaction),
      isOverBudget: spentSoFar >= budgetAmount,
    };
  }

  return null;
}

export interface DuplicateWarning {
  existingId: number;
  existingDate: string;
  existingDescription: string;
  existingAmount: string;
}

export async function detectDuplicate(
  amount: number,
  category: string,
  description: string,
  date: string,
): Promise<DuplicateWarning | null> {
  if (!amount || amount <= 0 || !date) return null;

  const txDate = new Date(date);
  if (isNaN(txDate.getTime())) return null;

  const dayBefore = new Date(txDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayAfter = new Date(txDate);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const beforeStr = dayBefore.toISOString().split("T")[0];
  const afterStr = dayAfter.toISOString().split("T")[0];

  const amountStr = amount.toFixed(2);

  const conditions = [
    eq(transactionsTable.amount, amountStr),
    gte(transactionsTable.date, beforeStr),
    lte(transactionsTable.date, afterStr),
  ];

  if (description) {
    conditions.push(ilike(transactionsTable.description, likeContains(description)));
  } else if (category) {
    conditions.push(eq(transactionsTable.category, category));
  } else {
    return null;
  }

  const matches = await db
    .select()
    .from(transactionsTable)
    .where(and(...conditions))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(1);

  if (matches.length > 0) {
    return {
      existingId: matches[0].id,
      existingDate: matches[0].date,
      existingDescription: matches[0].description,
      existingAmount: matches[0].amount,
    };
  }

  return null;
}
