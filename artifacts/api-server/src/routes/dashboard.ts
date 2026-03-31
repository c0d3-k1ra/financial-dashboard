import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, transactionsTable, monthlyConfigTable, budgetGoalsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res) => {
  try {
    const month = String(req.query.month);

    const config = await db
      .select()
      .from(monthlyConfigTable)
      .where(eq(monthlyConfigTable.month, month));

    const startingBalance = config.length > 0 ? Number(config[0].startingBalance) : 0;

    const incomeResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = 'Income' AND to_char(${transactionsTable.date}::date, 'YYYY-MM') = ${month}`);

    const expenseResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = 'Expense' AND to_char(${transactionsTable.date}::date, 'YYYY-MM') = ${month}`);

    const totalIncome = Number(incomeResult[0]?.total ?? 0);
    const totalExpenses = Number(expenseResult[0]?.total ?? 0);
    const endBalance = startingBalance + totalIncome - totalExpenses;
    const monthlySurplus = totalIncome - totalExpenses;

    const ccResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.category} = 'Credit Card (CC)' AND to_char(${transactionsTable.date}::date, 'YYYY-MM') = ${month}`);

    const unpaidCcDues = Number(ccResult[0]?.total ?? 0);
    const netLiquidity = endBalance - unpaidCcDues;

    const livingResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.category} = 'Living Expenses' AND to_char(${transactionsTable.date}::date, 'YYYY-MM') = ${month}`);

    const actualLivingExpenses = Number(livingResult[0]?.total ?? 0);

    const plannedLivingGoal = await db
      .select()
      .from(budgetGoalsTable)
      .where(eq(budgetGoalsTable.category, "Living Expenses"));

    const plannedLivingExpenses = plannedLivingGoal.length > 0 ? Number(plannedLivingGoal[0].plannedAmount) : 0;
    const burnRate = plannedLivingExpenses > 0 ? (actualLivingExpenses / plannedLivingExpenses) * 100 : 0;

    res.json({
      bankBalance: endBalance.toFixed(2),
      unpaidCcDues: unpaidCcDues.toFixed(2),
      netLiquidity: netLiquidity.toFixed(2),
      totalIncome: totalIncome.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      monthlySurplus: monthlySurplus.toFixed(2),
      burnRate: Math.round(burnRate),
      plannedLivingExpenses: plannedLivingExpenses.toFixed(2),
      actualLivingExpenses: actualLivingExpenses.toFixed(2),
      startingBalance: startingBalance.toFixed(2),
      endBalance: endBalance.toFixed(2),
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/dashboard/monthly-trend", async (req, res) => {
  try {
    const incomeByMonth = await db
      .select({
        month: sql<string>`to_char(${transactionsTable.date}::date, 'YYYY-MM')`,
        total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)`,
      })
      .from(transactionsTable)
      .where(eq(transactionsTable.type, "Income"))
      .groupBy(sql`to_char(${transactionsTable.date}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${transactionsTable.date}::date, 'YYYY-MM')`);

    const expenseByMonth = await db
      .select({
        month: sql<string>`to_char(${transactionsTable.date}::date, 'YYYY-MM')`,
        total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)`,
      })
      .from(transactionsTable)
      .where(eq(transactionsTable.type, "Expense"))
      .groupBy(sql`to_char(${transactionsTable.date}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${transactionsTable.date}::date, 'YYYY-MM')`);

    const months = new Set<string>();
    incomeByMonth.forEach((r) => months.add(r.month));
    expenseByMonth.forEach((r) => months.add(r.month));

    const incomeMap = new Map(incomeByMonth.map((r) => [r.month, r.total]));
    const expenseMap = new Map(expenseByMonth.map((r) => [r.month, r.total]));

    const trend = Array.from(months)
      .sort()
      .slice(-6)
      .map((month) => ({
        month,
        income: Number(incomeMap.get(month) ?? 0).toFixed(2),
        expenses: Number(expenseMap.get(month) ?? 0).toFixed(2),
      }));

    res.json(trend);
  } catch (e) {
    req.log.error({ err: e }, "Failed to get monthly trend");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
