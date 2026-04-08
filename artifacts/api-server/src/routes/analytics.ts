import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { ZodError } from "zod";
import { db, transactionsTable, accountsTable } from "@workspace/db";
import { getCycleDates, buildLast6Cycles } from "../lib/billing-cycle";
import { getAppSettings } from "../lib/settings-helper";

const router: IRouter = Router();

const EXCLUDED_CATEGORIES = ["Adjustment", "Transfer"];

router.get("/analytics/spend-by-category", async (req, res) => {
  try {
    const month = String(req.query.month || "");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Invalid month format. Expected YYYY-MM." });
      return;
    }

    const accountType = String(req.query.accountType || "all");
    if (!["all", "cc", "non_cc"].includes(accountType)) {
      res.status(400).json({ error: "Invalid accountType. Expected one of: all, cc, non_cc." });
      return;
    }
    const settings = await getAppSettings();
    const { startDate, endDate } = getCycleDates(month, settings.billingCycleDay);

    let accountFilter = sql`1=1`;
    if (accountType === "cc") {
      accountFilter = sql`${transactionsTable.accountId} IN (SELECT ${accountsTable.id} FROM ${accountsTable} WHERE ${accountsTable.type} = 'credit_card')`;
    } else if (accountType === "non_cc") {
      accountFilter = sql`(${transactionsTable.accountId} IS NULL OR ${transactionsTable.accountId} NOT IN (SELECT ${accountsTable.id} FROM ${accountsTable} WHERE ${accountsTable.type} = 'credit_card'))`;
    }

    const rows = await db
      .select({
        category: transactionsTable.category,
        total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)`,
      })
      .from(transactionsTable)
      .where(
        sql`${transactionsTable.type} = 'Expense'
            AND ${transactionsTable.category} NOT IN (${sql.join(EXCLUDED_CATEGORIES.map(c => sql`${c}`), sql`, `)})
            AND ${transactionsTable.date}::date >= ${startDate}::date
            AND ${transactionsTable.date}::date <= ${endDate}::date
            AND ${accountFilter}`
      )
      .groupBy(transactionsTable.category)
      .orderBy(sql`SUM(${transactionsTable.amount}::numeric) DESC`);

    const result = rows
      .filter((r) => Number(r.total) > 0)
      .map((r) => ({
        category: r.category,
        total: Number(r.total).toFixed(2),
      }));

    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Failed to get spend by category");
    if (e instanceof ZodError) {
      res.status(400).json({ error: e.errors });
    } else {
      res.status(500).json({ error: "Internal error" });
    }
  }
});

router.get("/analytics/category-trend", async (req, res) => {
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
        category: transactionsTable.category,
        cycleIdx: sql<string>`CASE ${sql.join(dateRangeConditions, sql` `)} END`,
        total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)`,
      })
      .from(transactionsTable)
      .where(
        sql`${transactionsTable.type} = 'Expense'
            AND ${transactionsTable.category} NOT IN (${sql.join(EXCLUDED_CATEGORIES.map(c => sql`${c}`), sql`, `)})
            AND ${transactionsTable.date}::date >= ${globalStart}::date
            AND ${transactionsTable.date}::date <= ${globalEnd}::date`
      )
      .groupBy(sql`1`, sql`2`);

    const grouped: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      if (row.cycleIdx == null) continue;
      if (!grouped[row.category]) grouped[row.category] = {};
      grouped[row.category][row.cycleIdx] = Number(row.total);
    }

    const result: { category: string; data: { cycle: string; total: string }[] }[] = [];
    for (const [catName, cycleTotals] of Object.entries(grouped)) {
      const data = cycles.map((cycle, idx) => ({
        cycle: cycle.label,
        total: (cycleTotals[idx.toString()] ?? 0).toFixed(2),
      }));
      const hasAnySpend = data.some((d) => Number(d.total) > 0);
      if (hasAnySpend) {
        result.push({ category: catName, data });
      }
    }

    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Failed to get category trend");
    if (e instanceof ZodError) {
      res.status(400).json({ error: e.errors });
    } else {
      res.status(500).json({ error: "Internal error" });
    }
  }
});

router.get("/analytics/cc-dues", async (req, res) => {
  try {
    const ccAccounts = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.type, "credit_card"));

    const today = new Date();

    const getNextDueDate = (fromDate: Date, day: number): Date => {
      let year = fromDate.getFullYear();
      let month = fromDate.getMonth();
      const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
      const clampedDay = Math.min(day, daysInCurrentMonth);
      if (fromDate.getDate() <= clampedDay) {
        return new Date(year, month, clampedDay);
      }
      month++;
      if (month > 11) { month = 0; year++; }
      const daysInNextMonth = new Date(year, month + 1, 0).getDate();
      return new Date(year, month, Math.min(day, daysInNextMonth));
    };

    const groupOutstandings: Record<string, number> = {};
    for (const account of ccAccounts) {
      if (account.sharedLimitGroup) {
        const group = account.sharedLimitGroup;
        groupOutstandings[group] = (groupOutstandings[group] || 0) + Math.abs(Number(account.currentBalance));
      }
    }

    const lastPaymentDates = new Map<number, Date | null>();
    for (const account of ccAccounts) {
      if (!account.billingDueDay) continue;

      const lastPayment = await db
        .select({ date: transactionsTable.date })
        .from(transactionsTable)
        .where(
          sql`${transactionsTable.type} = 'Transfer' AND ${transactionsTable.toAccountId} = ${account.id}`
        )
        .orderBy(sql`${transactionsTable.date} DESC`)
        .limit(1);
      if (lastPayment.length > 0) {
        const parts = String(lastPayment[0].date).split("-");
        lastPaymentDates.set(account.id, new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
      } else {
        lastPaymentDates.set(account.id, null);
      }
    }

    const result = ccAccounts.map((account) => {
      const outstanding = Math.abs(Number(account.currentBalance));
      let daysUntilDue: number | null = null;

      if (account.billingDueDay) {
        const dueDay = account.billingDueDay;
        const lastPaymentDate = lastPaymentDates.get(account.id) ?? null;

        let nextDue: Date;
        if (lastPaymentDate) {
          let nextMonth = lastPaymentDate.getMonth() + 1;
          let nextYear = lastPaymentDate.getFullYear();
          if (nextMonth > 11) { nextMonth = 0; nextYear++; }
          const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
          nextDue = new Date(nextYear, nextMonth, Math.min(dueDay, daysInNextMonth));
          const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          if (nextDue.getTime() < todayMidnight.getTime()) {
            nextDue = getNextDueDate(today, dueDay);
          }
        } else {
          nextDue = getNextDueDate(today, dueDay);
        }
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diffMs = nextDue.getTime() - todayMidnight.getTime();
        daysUntilDue = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      let remainingLimit: string | null = null;
      if (account.sharedLimitGroup && account.creditLimit) {
        const groupTotal = groupOutstandings[account.sharedLimitGroup] || 0;
        remainingLimit = Math.max(0, Number(account.creditLimit) - groupTotal).toFixed(2);
      } else if (account.creditLimit) {
        remainingLimit = Math.max(0, Number(account.creditLimit) - outstanding).toFixed(2);
      }

      return {
        id: account.id,
        name: account.name,
        outstanding: outstanding.toFixed(2),
        billingDueDay: account.billingDueDay,
        daysUntilDue,
        creditLimit: account.creditLimit,
        remainingLimit,
        sharedLimitGroup: account.sharedLimitGroup,
      };
    });

    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Failed to get CC dues");
    if (e instanceof ZodError) {
      res.status(400).json({ error: e.errors });
    } else {
      res.status(500).json({ error: "Internal error" });
    }
  }
});

export default router;
