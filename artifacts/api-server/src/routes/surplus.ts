import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, pool, goalVaultsTable, transactionsTable, surplusLedgerTable, monthlyConfigTable } from "@workspace/db";
import { ConsolidateSurplusBody } from "@workspace/api-zod";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@workspace/db/schema";

const router: IRouter = Router();

function getNextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  let ny = y;
  let nm = m + 1;
  if (nm > 12) { nm = 1; ny++; }
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

async function getVaultBalance(): Promise<string> {
  const vault = await db
    .select()
    .from(goalVaultsTable)
    .where(eq(goalVaultsTable.name, "Emergency Fund (IDFC)"));
  return vault.length > 0 ? Number(vault[0].currentBalance).toFixed(2) : "0.00";
}

router.post("/surplus/consolidate", async (req, res) => {
  try {
    const data = ConsolidateSurplusBody.parse(req.body);
    const month = data.month;

    const existingLedger = await db
      .select()
      .from(surplusLedgerTable)
      .where(eq(surplusLedgerTable.month, month));

    if (existingLedger.length > 0) {
      const currentBalance = await getVaultBalance();
      res.json({
        success: true,
        newBalance: currentBalance,
        amountAdded: Number(existingLedger[0].amount).toFixed(2),
      });
      return;
    }

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
      const currentBalance = await getVaultBalance();
      res.json({ success: false, newBalance: currentBalance, amountAdded: "0.00" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const txDb = drizzle(client, { schema });

      const existing = await txDb
        .select()
        .from(goalVaultsTable)
        .where(eq(goalVaultsTable.name, "Emergency Fund (IDFC)"));

      let result;
      if (existing.length > 0) {
        [result] = await txDb
          .update(goalVaultsTable)
          .set({
            currentBalance: sql`(${goalVaultsTable.currentBalance}::numeric + ${surplus})::text`,
          })
          .where(eq(goalVaultsTable.name, "Emergency Fund (IDFC)"))
          .returning();
      } else {
        [result] = await txDb
          .insert(goalVaultsTable)
          .values({
            name: "Emergency Fund (IDFC)",
            currentBalance: surplus.toFixed(2),
            targetAmount: "300000.00",
          })
          .returning();
      }

      await txDb.insert(surplusLedgerTable).values({
        month,
        amount: surplus.toFixed(2),
        vaultName: "Emergency Fund (IDFC)",
      });

      const config = await txDb
        .select()
        .from(monthlyConfigTable)
        .where(eq(monthlyConfigTable.month, month));

      const startingBalance = config.length > 0 ? Number(config[0].startingBalance) : 0;
      const endBalance = startingBalance + totalIncome - totalExpenses;
      const nextMonth = getNextMonth(month);

      const existingNext = await txDb
        .select()
        .from(monthlyConfigTable)
        .where(eq(monthlyConfigTable.month, nextMonth));

      if (existingNext.length > 0) {
        await txDb
          .update(monthlyConfigTable)
          .set({ startingBalance: endBalance.toFixed(2) })
          .where(eq(monthlyConfigTable.month, nextMonth));
      } else {
        await txDb
          .insert(monthlyConfigTable)
          .values({ month: nextMonth, startingBalance: endBalance.toFixed(2) });
      }

      await client.query("COMMIT");

      res.json({
        success: true,
        newBalance: Number(result.currentBalance).toFixed(2),
        amountAdded: surplus.toFixed(2),
      });
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (e) {
    req.log.error({ err: e }, "Failed to consolidate surplus");
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
