import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, transactionsTable, monthlyConfigTable, budgetGoalsTable, accountsTable, categoriesTable } from "@workspace/db";
import { GetDashboardSummaryQueryParams } from "@workspace/api-zod";
import { getCycleDates, generateCycleOptions, buildLast6Cycles } from "../lib/billing-cycle";
import { getAppSettings } from "../lib/settings-helper";
import { calculateTotalEmiDue } from "../lib/emi-due";
import { asyncHandler } from "../lib/async-handler";

const router: IRouter = Router();

router.get("/dashboard/summary", asyncHandler(async (req, res) => {
  const { month } = GetDashboardSummaryQueryParams.parse(req.query);
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ error: "Invalid month format. Expected YYYY-MM." });
    return;
  }

  const settings = await getAppSettings();
  const { startDate, endDate } = getCycleDates(month, settings.billingCycleDay);

  const [
    config,
    incomeResult,
    bankExpenseResult,
    ccTransferResult,
    ccExpenseResult,
    allExpenseResult,
    allAccounts,
    expenseCategories,
    allBudgetGoals,
  ] = await Promise.all([
    db.select().from(monthlyConfigTable).where(eq(monthlyConfigTable.month, month)),
    db.select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = 'Income' AND ${transactionsTable.date}::date >= ${startDate}::date AND ${transactionsTable.date}::date <= ${endDate}::date`),
    db.select({ total: sql<string>`COALESCE(SUM(t.amount::numeric), 0)` })
      .from(sql`${transactionsTable} t JOIN ${accountsTable} a ON t.account_id = a.id`)
      .where(sql`t.type = 'Expense' AND t.category != 'Adjustment' AND a.type = 'bank' AND t.date::date >= ${startDate}::date AND t.date::date <= ${endDate}::date`),
    db.select({ total: sql<string>`COALESCE(SUM(t.amount::numeric), 0)` })
      .from(sql`${transactionsTable} t JOIN ${accountsTable} a ON t.to_account_id = a.id`)
      .where(sql`t.type = 'Transfer' AND a.type = 'credit_card' AND t.date::date >= ${startDate}::date AND t.date::date <= ${endDate}::date`),
    db.select({ total: sql<string>`COALESCE(SUM(t.amount::numeric), 0)` })
      .from(sql`${transactionsTable} t JOIN ${accountsTable} a ON t.account_id = a.id`)
      .where(sql`t.type = 'Expense' AND t.category != 'Adjustment' AND a.type = 'credit_card' AND t.date::date >= ${startDate}::date AND t.date::date <= ${endDate}::date`),
    db.select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = 'Expense' AND ${transactionsTable.category} != 'Adjustment' AND ${transactionsTable.date}::date >= ${startDate}::date AND ${transactionsTable.date}::date <= ${endDate}::date`),
    db.select().from(accountsTable),
    db.select().from(categoriesTable).where(eq(categoriesTable.type, "Expense")),
    db.select({
      categoryId: budgetGoalsTable.categoryId,
      plannedAmount: budgetGoalsTable.plannedAmount,
    }).from(budgetGoalsTable).innerJoin(categoriesTable, eq(budgetGoalsTable.categoryId, categoriesTable.id)),
  ]);

  const startingBalance = config.length > 0 ? Number(config[0].startingBalance) : 0;

  const totalIncome = Number(incomeResult[0]?.total ?? 0);
  const bankExpenses = Number(bankExpenseResult[0]?.total ?? 0);
  const ccTransfers = Number(ccTransferResult[0]?.total ?? 0);
  const ccExpenses = Number(ccExpenseResult[0]?.total ?? 0);
  const allExpenses = Number(allExpenseResult[0]?.total ?? 0);
  const nonCcExpenses = allExpenses - ccExpenses;
  const totalExpenses = bankExpenses + ccTransfers;
  const endBalance = startingBalance + totalIncome - totalExpenses;

  const grossSurplusBalance = allAccounts
    .filter(a => a.useInSurplus)
    .reduce((sum, a) => sum + Number(a.currentBalance ?? 0), 0);
  const totalBankBalance = allAccounts
    .filter(a => a.type === "bank")
    .reduce((sum, a) => sum + Number(a.currentBalance ?? 0), 0);
  const totalCcOutstanding = allAccounts
    .filter(a => a.type === "credit_card")
    .reduce((sum, a) => sum + Math.abs(Number(a.currentBalance ?? 0)), 0);
  const totalLoanOutstanding = allAccounts
    .filter(a => a.type === "loan")
    .reduce((sum, a) => sum + Math.abs(Number(a.currentBalance ?? 0)), 0);
  const { totalEmiDue } = await calculateTotalEmiDue(allAccounts, startDate, endDate);
  const monthlySurplus = grossSurplusBalance - totalEmiDue - totalCcOutstanding;
  const netLiquidity = totalBankBalance - totalCcOutstanding - totalEmiDue;
  const expenseCatIds = new Set(expenseCategories.map(c => c.id));
  const plannedExpenses = allBudgetGoals
    .filter(g => expenseCatIds.has(g.categoryId))
    .reduce((sum, g) => sum + Number(g.plannedAmount ?? 0), 0);
  const actualExpenses = allExpenses;
  const burnRate = plannedExpenses > 0 ? (actualExpenses / plannedExpenses) * 100 : 0;

  res.json({
    bankBalance: totalBankBalance.toFixed(2),
    unpaidCcDues: totalCcOutstanding.toFixed(2),
    netLiquidity: netLiquidity.toFixed(2),
    totalIncome: totalIncome.toFixed(2),
    totalExpenses: totalExpenses.toFixed(2),
    bankExpenses: bankExpenses.toFixed(2),
    ccExpenses: ccExpenses.toFixed(2),
    nonCcExpenses: nonCcExpenses.toFixed(2),
    ccTransfers: ccTransfers.toFixed(2),
    monthlySurplus: monthlySurplus.toFixed(2),
    burnRate: Math.round(burnRate),
    plannedExpenses: plannedExpenses.toFixed(2),
    actualExpenses: actualExpenses.toFixed(2),
    startingBalance: startingBalance.toFixed(2),
    endBalance: endBalance.toFixed(2),
    totalLoanOutstanding: totalLoanOutstanding.toFixed(2),
    totalEmiDue: totalEmiDue.toFixed(2),
  });
}));

router.get("/dashboard/monthly-trend", asyncHandler(async (req, res) => {
  const settings = await getAppSettings();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const cycles = buildLast6Cycles(currentMonth, settings.billingCycleDay);

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const dateRangeConditions = cycles.map((cycle, idx) =>
    sql`WHEN ${transactionsTable.date}::date >= ${cycle.startDate}::date AND ${transactionsTable.date}::date <= ${cycle.endDate}::date THEN ${idx.toString()}`
  );

  const globalStart = cycles[0].startDate;
  const globalEnd = cycles[cycles.length - 1].endDate;

  const rows = await db
    .select({
      cycleIdx: sql<string>`CASE ${sql.join(dateRangeConditions, sql` `)} END`,
      type: transactionsTable.type,
      total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)`,
    })
    .from(transactionsTable)
    .where(
      sql`(${transactionsTable.type} = 'Income' OR (${transactionsTable.type} = 'Expense' AND ${transactionsTable.category} != 'Adjustment'))
          AND ${transactionsTable.date}::date >= ${globalStart}::date
          AND ${transactionsTable.date}::date <= ${globalEnd}::date`
    )
    .groupBy(sql`1`, sql`2`);

  const incomeMap: Record<string, number> = {};
  const expenseMap: Record<string, number> = {};
  for (const row of rows) {
    if (row.cycleIdx == null) continue;
    if (row.type === "Income") incomeMap[row.cycleIdx] = Number(row.total);
    else expenseMap[row.cycleIdx] = Number(row.total);
  }

  const trendData = months.map((month, idx) => ({
    month,
    income: (incomeMap[idx.toString()] ?? 0).toFixed(2),
    expenses: (expenseMap[idx.toString()] ?? 0).toFixed(2),
  }));

  res.json(trendData);
}));

router.get("/billing-cycles", asyncHandler(async (_req, res) => {
  const settings = await getAppSettings();
  const cycles = generateCycleOptions(12, settings.billingCycleDay);
  res.json(cycles.map((c) => ({ label: c.label, startDate: c.startDate, endDate: c.endDate })));
}));

export default router;
