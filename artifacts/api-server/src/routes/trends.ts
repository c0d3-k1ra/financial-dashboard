import { Router, type IRouter } from "express";
import { sql, eq } from "drizzle-orm";
import { db, transactionsTable, accountsTable } from "@workspace/db";
import { buildLast6Cycles } from "../lib/billing-cycle";
import { getAppSettings } from "../lib/settings-helper";

const router: IRouter = Router();

router.get("/trends/cc-spend", async (req, res) => {
  try {
    const month = String(req.query.month || "");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Invalid month format. Expected YYYY-MM." });
      return;
    }

    const settings = await getAppSettings();
    const cycles = buildLast6Cycles(month, settings.billingCycleDay);

    const dateRangeConditions = cycles.map((cycle, idx) =>
      sql`WHEN ${transactionsTable.date}::date >= ${cycle.startDate}::date AND ${transactionsTable.date}::date <= ${cycle.endDate}::date THEN ${idx.toString()}`
    );

    const globalStart = cycles[0].startDate;
    const globalEnd = cycles[cycles.length - 1].endDate;

    const rows = await db
      .select({
        cycleIdx: sql<string>`CASE ${sql.join(dateRangeConditions, sql` `)} END`,
        total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)`,
      })
      .from(transactionsTable)
      .innerJoin(accountsTable, eq(transactionsTable.accountId, accountsTable.id))
      .where(
        sql`${accountsTable.type} = 'credit_card'
            AND ${transactionsTable.type} = 'Expense'
            AND ${transactionsTable.category} != 'Adjustment'
            AND ${transactionsTable.date}::date >= ${globalStart}::date
            AND ${transactionsTable.date}::date <= ${globalEnd}::date`
      )
      .groupBy(sql`1`);

    const cycleMap: Record<string, number> = {};
    for (const row of rows) {
      if (row.cycleIdx != null) cycleMap[row.cycleIdx] = Number(row.total);
    }

    const results = cycles.map((cycle, idx) => ({
      cycle: cycle.label,
      total: (cycleMap[idx.toString()] ?? 0).toFixed(2),
    }));

    res.json(results);
  } catch (e) {
    req.log.error({ err: e }, "Failed to get CC spend trend");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/trends/living-expenses", async (req, res) => {
  try {
    const month = String(req.query.month || "");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Invalid month format. Expected YYYY-MM." });
      return;
    }

    const settings = await getAppSettings();
    const cycles = buildLast6Cycles(month, settings.billingCycleDay);

    const dateRangeConditions = cycles.map((cycle, idx) =>
      sql`WHEN ${transactionsTable.date}::date >= ${cycle.startDate}::date AND ${transactionsTable.date}::date <= ${cycle.endDate}::date THEN ${idx.toString()}`
    );

    const globalStart = cycles[0].startDate;
    const globalEnd = cycles[cycles.length - 1].endDate;

    const rows = await db
      .select({
        cycleIdx: sql<string>`CASE ${sql.join(dateRangeConditions, sql` `)} END`,
        total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)`,
      })
      .from(transactionsTable)
      .where(
        sql`${transactionsTable.category} = 'Living Expenses' 
            AND ${transactionsTable.type} != 'Transfer'
            AND ${transactionsTable.date}::date >= ${globalStart}::date 
            AND ${transactionsTable.date}::date <= ${globalEnd}::date`
      )
      .groupBy(sql`1`);

    const cycleMap: Record<string, number> = {};
    for (const row of rows) {
      if (row.cycleIdx != null) cycleMap[row.cycleIdx] = Number(row.total);
    }

    const results = cycles.map((cycle, idx) => ({
      cycle: cycle.label,
      total: (cycleMap[idx.toString()] ?? 0).toFixed(2),
    }));

    res.json(results);
  } catch (e) {
    req.log.error({ err: e }, "Failed to get living expenses trend");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
