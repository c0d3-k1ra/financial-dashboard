import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, goalVaultsTable, transactionsTable } from "@workspace/db";
import { ConsolidateSurplusBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/surplus/consolidate", async (req, res) => {
  try {
    const data = ConsolidateSurplusBody.parse(req.body);
    const month = data.month;

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
    const surplus = totalIncome - totalExpenses;

    if (surplus <= 0) {
      res.json({ success: false, newBalance: "0.00", amountAdded: "0.00" });
      return;
    }

    const existing = await db
      .select()
      .from(goalVaultsTable)
      .where(eq(goalVaultsTable.name, "Emergency Fund (IDFC)"));

    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(goalVaultsTable)
        .set({
          currentBalance: sql`(${goalVaultsTable.currentBalance}::numeric + ${surplus})::text`,
        })
        .where(eq(goalVaultsTable.name, "Emergency Fund (IDFC)"))
        .returning();
    } else {
      [result] = await db
        .insert(goalVaultsTable)
        .values({
          name: "Emergency Fund (IDFC)",
          currentBalance: surplus.toFixed(2),
          targetAmount: "300000.00",
        })
        .returning();
    }

    res.json({
      success: true,
      newBalance: Number(result.currentBalance).toFixed(2),
      amountAdded: surplus.toFixed(2),
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to consolidate surplus");
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
