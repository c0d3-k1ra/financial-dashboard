import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, transactionsTable, monthlyConfigTable, budgetGoalsTable, accountsTable } from "@workspace/db";
import { GetDashboardSummaryQueryParams } from "@workspace/api-zod";
import { getCycleDates, generateCycleOptions } from "../lib/billing-cycle";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res) => {
  try {
    const { month } = GetDashboardSummaryQueryParams.parse(req.query);
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Invalid month format. Expected YYYY-MM." });
      return;
    }

    const { startDate, endDate } = getCycleDates(month);

    const config = await db
      .select()
      .from(monthlyConfigTable)
      .where(eq(monthlyConfigTable.month, month));

    const startingBalance = config.length > 0 ? Number(config[0].startingBalance) : 0;

    const incomeResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = 'Income' AND ${transactionsTable.date}::date >= ${startDate}::date AND ${transactionsTable.date}::date <= ${endDate}::date`);

    const expenseResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = 'Expense' AND ${transactionsTable.date}::date >= ${startDate}::date AND ${transactionsTable.date}::date <= ${endDate}::date`);

    const totalIncome = Number(incomeResult[0]?.total ?? 0);
    const totalExpenses = Number(expenseResult[0]?.total ?? 0);
    const endBalance = startingBalance + totalIncome - totalExpenses;
    const monthlySurplus = totalIncome - totalExpenses;

    const allAccounts = await db.select().from(accountsTable);
    const totalBankBalance = allAccounts
      .filter(a => a.type === "bank")
      .reduce((sum, a) => sum + Number(a.currentBalance ?? 0), 0);
    const totalCcOutstanding = allAccounts
      .filter(a => a.type === "credit_card")
      .reduce((sum, a) => sum + Math.abs(Number(a.currentBalance ?? 0)), 0);
    const totalLoanOutstanding = allAccounts
      .filter(a => a.type === "loan")
      .reduce((sum, a) => sum + Math.abs(Number(a.currentBalance ?? 0)), 0);
    const totalEmiDue = allAccounts
      .filter(a => a.type === "loan" && Number(a.currentBalance ?? 0) > 0)
      .reduce((sum, a) => sum + Number(a.emiAmount ?? 0), 0);
    const netLiquidity = totalBankBalance - totalCcOutstanding - totalEmiDue;

    const allBudgetGoals = await db.select().from(budgetGoalsTable);
    const plannedExpenses = allBudgetGoals.reduce((sum, g) => sum + Number(g.plannedAmount ?? 0), 0);
    const actualExpenses = totalExpenses;
    const burnRate = plannedExpenses > 0 ? (actualExpenses / plannedExpenses) * 100 : 0;

    res.json({
      bankBalance: totalBankBalance.toFixed(2),
      unpaidCcDues: totalCcOutstanding.toFixed(2),
      netLiquidity: netLiquidity.toFixed(2),
      totalIncome: totalIncome.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      monthlySurplus: monthlySurplus.toFixed(2),
      burnRate: Math.round(burnRate),
      plannedExpenses: plannedExpenses.toFixed(2),
      actualExpenses: actualExpenses.toFixed(2),
      startingBalance: startingBalance.toFixed(2),
      endBalance: endBalance.toFixed(2),
      totalLoanOutstanding: totalLoanOutstanding.toFixed(2),
      totalEmiDue: totalEmiDue.toFixed(2),
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/dashboard/monthly-trend", async (req, res) => {
  try {
    const now = new Date();
    const trendData = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const { startDate, endDate } = getCycleDates(month);

      const incomeResult = await db
        .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)` })
        .from(transactionsTable)
        .where(sql`${transactionsTable.type} = 'Income' AND ${transactionsTable.date}::date >= ${startDate}::date AND ${transactionsTable.date}::date <= ${endDate}::date`);

      const expenseResult = await db
        .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)` })
        .from(transactionsTable)
        .where(sql`${transactionsTable.type} = 'Expense' AND ${transactionsTable.date}::date >= ${startDate}::date AND ${transactionsTable.date}::date <= ${endDate}::date`);

      trendData.push({
        month,
        income: Number(incomeResult[0]?.total ?? 0).toFixed(2),
        expenses: Number(expenseResult[0]?.total ?? 0).toFixed(2),
      });
    }

    res.json(trendData);
  } catch (e) {
    req.log.error({ err: e }, "Failed to get monthly trend");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/billing-cycles", async (_req, res) => {
  try {
    const cycles = generateCycleOptions(12);
    res.json(cycles.map((c) => ({ label: c.label, startDate: c.startDate, endDate: c.endDate })));
  } catch (e) {
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
