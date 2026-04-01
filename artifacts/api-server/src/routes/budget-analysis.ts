import { Router, type IRouter } from "express";
import { sql, eq } from "drizzle-orm";
import { db, transactionsTable, budgetGoalsTable, categoriesTable, accountsTable } from "@workspace/db";
import { GetBudgetAnalysisQueryParams } from "@workspace/api-zod";
import { getCycleDates } from "../lib/billing-cycle";

const router: IRouter = Router();

router.get("/budget-analysis", async (req, res) => {
  try {
    const { month } = GetBudgetAnalysisQueryParams.parse(req.query);
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Invalid month format. Expected YYYY-MM." });
      return;
    }

    const { startDate, endDate } = getCycleDates(month);

    const expenseCategories = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.type, "Expense"));

    const goals = await db
      .select({
        categoryId: budgetGoalsTable.categoryId,
        plannedAmount: budgetGoalsTable.plannedAmount,
      })
      .from(budgetGoalsTable);
    const goalMap = new Map(goals.map((g) => [g.categoryId, Number(g.plannedAmount)]));

    const loanAccounts = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.type, "loan"));

    const totalEmi = loanAccounts
      .filter((a) => Number(a.currentBalance ?? 0) > 0 && a.emiAmount && Number(a.emiAmount) > 0)
      .reduce((sum, a) => sum + Number(a.emiAmount), 0);

    const actuals = await db
      .select({
        category: transactionsTable.category,
        total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)`,
      })
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = 'Expense' AND ${transactionsTable.category} NOT IN ('Adjustment', 'Transfer') AND ${transactionsTable.date}::date >= ${startDate}::date AND ${transactionsTable.date}::date <= ${endDate}::date`)
      .groupBy(transactionsTable.category);

    const actualMap = new Map(actuals.map((a) => [a.category, Number(a.total)]));

    const analysis = expenseCategories.map((cat) => {
      let planned = goalMap.get(cat.id) ?? 0;

      if (cat.name === "EMI (PL)") {
        planned = totalEmi;
      }

      const actual = actualMap.get(cat.name) ?? 0;
      const difference = planned - actual;
      return {
        category: cat.name,
        planned: planned.toFixed(2),
        actual: actual.toFixed(2),
        difference: difference.toFixed(2),
        overBudget: difference < 0,
      };
    });

    res.json(analysis);
  } catch (e) {
    req.log.error({ err: e }, "Failed to get budget analysis");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
