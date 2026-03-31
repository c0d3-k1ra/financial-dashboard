import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, goalVaultsTable, transactionsTable } from "@workspace/db";
import { UpsertGoalVaultBody, GetGoalProjectionQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/goal-vaults", async (req, res) => {
  try {
    const results = await db.select().from(goalVaultsTable);
    res.json(results);
  } catch (e) {
    req.log.error({ err: e }, "Failed to list goal vaults");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/goal-vaults", async (req, res) => {
  try {
    const data = UpsertGoalVaultBody.parse(req.body);
    const existing = await db
      .select()
      .from(goalVaultsTable)
      .where(eq(goalVaultsTable.name, data.name));

    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(goalVaultsTable)
        .set({
          currentBalance: data.currentBalance,
          targetAmount: data.targetAmount,
        })
        .where(eq(goalVaultsTable.name, data.name))
        .returning();
    } else {
      [result] = await db.insert(goalVaultsTable).values(data).returning();
    }
    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Failed to upsert goal vault");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/goal-vaults/projection", async (req, res) => {
  try {
    const { month } = GetGoalProjectionQueryParams.parse(req.query);
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Invalid month format. Expected YYYY-MM." });
      return;
    }

    const efVault = await db
      .select()
      .from(goalVaultsTable)
      .where(eq(goalVaultsTable.name, "Emergency Fund (IDFC)"));

    const currentBalance = efVault.length > 0 ? Number(efVault[0].currentBalance) : 0;
    const targetAmount = efVault.length > 0 ? Number(efVault[0].targetAmount) : 300000;

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
    const monthlySurplus = totalIncome - totalExpenses;

    const projection = [];
    const [yearStr, monthStr] = month.split("-");
    let y = Number(yearStr);
    let m = Number(monthStr);

    for (let i = 0; i < 12; i++) {
      const projMonth = `${y}-${String(m).padStart(2, "0")}`;
      const projBalance = currentBalance + monthlySurplus * i;
      projection.push({
        month: projMonth,
        projectedBalance: projBalance.toFixed(2),
        targetAmount: targetAmount.toFixed(2),
      });
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }

    res.json(projection);
  } catch (e) {
    req.log.error({ err: e }, "Failed to get goal projection");
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/goal-vaults/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(goalVaultsTable).where(eq(goalVaultsTable.id, id));
    res.status(204).send();
  } catch (e) {
    req.log.error({ err: e }, "Failed to delete goal vault");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
