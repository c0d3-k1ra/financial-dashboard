import { Router, type IRouter } from "express";
import { sql, eq } from "drizzle-orm";
import { db, transactionsTable, accountsTable } from "@workspace/db";
import { getCycleDates } from "../lib/billing-cycle";

const router: IRouter = Router();

function buildLast6Cycles(month: string): { label: string; startDate: string; endDate: string }[] {
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr);
  const mo = parseInt(monthStr);
  const cycles: { label: string; startDate: string; endDate: string }[] = [];

  for (let i = 5; i >= 0; i--) {
    let cYear = year;
    let cMonth = mo - i;
    while (cMonth <= 0) {
      cMonth += 12;
      cYear--;
    }
    const cMonthStr = `${cYear}-${String(cMonth).padStart(2, "0")}`;
    const { startDate, endDate } = getCycleDates(cMonthStr);

    const startLabel = new Date(startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endLabel = new Date(endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    cycles.push({ label: `${startLabel} – ${endLabel}`, startDate, endDate });
  }

  return cycles;
}

router.get("/trends/cc-spend", async (req, res) => {
  try {
    const month = String(req.query.month || "");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Invalid month format. Expected YYYY-MM." });
      return;
    }

    const cycles = buildLast6Cycles(month);
    const results: { cycle: string; total: string }[] = [];

    for (const cycle of cycles) {
      const [row] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)`,
        })
        .from(transactionsTable)
        .innerJoin(accountsTable, eq(transactionsTable.accountId, accountsTable.id))
        .where(
          sql`${accountsTable.type} = 'credit_card'
              AND ${transactionsTable.type} != 'Transfer'
              AND ${transactionsTable.date}::date >= ${cycle.startDate}::date
              AND ${transactionsTable.date}::date <= ${cycle.endDate}::date`
        );
      results.push({ cycle: cycle.label, total: Number(row.total).toFixed(2) });
    }

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

    const cycles = buildLast6Cycles(month);
    const results: { cycle: string; total: string }[] = [];

    for (const cycle of cycles) {
      const [row] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)`,
        })
        .from(transactionsTable)
        .where(
          sql`${transactionsTable.category} = 'Living Expenses' 
              AND ${transactionsTable.type} != 'Transfer'
              AND ${transactionsTable.date}::date >= ${cycle.startDate}::date 
              AND ${transactionsTable.date}::date <= ${cycle.endDate}::date`
        );
      results.push({ cycle: cycle.label, total: Number(row.total).toFixed(2) });
    }

    res.json(results);
  } catch (e) {
    req.log.error({ err: e }, "Failed to get living expenses trend");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
