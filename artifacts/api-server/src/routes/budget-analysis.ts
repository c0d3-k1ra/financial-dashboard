import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, transactionsTable, budgetGoalsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/budget-analysis", async (req, res) => {
  try {
    const month = String(req.query.month);

    const goals = await db.select().from(budgetGoalsTable);

    const actuals = await db
      .select({
        category: transactionsTable.category,
        total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)`,
      })
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = 'Expense' AND to_char(${transactionsTable.date}::date, 'YYYY-MM') = ${month}`)
      .groupBy(transactionsTable.category);

    const actualMap = new Map(actuals.map((a) => [a.category, Number(a.total)]));

    const analysis = goals.map((goal) => {
      const planned = Number(goal.plannedAmount);
      const actual = actualMap.get(goal.category) ?? 0;
      const difference = planned - actual;
      return {
        category: goal.category,
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
