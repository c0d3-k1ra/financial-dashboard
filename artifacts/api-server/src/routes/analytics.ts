import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, transactionsTable, accountsTable } from "@workspace/db";
import { getCycleDates } from "../lib/billing-cycle";
import { getAppSettings } from "../lib/settings-helper";

const router: IRouter = Router();

const EXCLUDED_CATEGORIES = ["Adjustment", "Transfer"];

function buildLast6Cycles(month: string, cycleDay: number = 25): { label: string; startDate: string; endDate: string }[] {
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
    const { startDate, endDate } = getCycleDates(cMonthStr, cycleDay);

    const startLabel = new Date(startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endLabel = new Date(endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    cycles.push({ label: `${startLabel} – ${endLabel}`, startDate, endDate });
  }

  return cycles;
}

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
    res.status(500).json({ error: "Internal error" });
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

    const allCategories = await db
      .selectDistinct({ category: transactionsTable.category })
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = 'Expense'
          AND ${transactionsTable.category} NOT IN (${sql.join(EXCLUDED_CATEGORIES.map(c => sql`${c}`), sql`, `)})`);

    const categoryNames = allCategories.map((c) => c.category);

    const result: { category: string; data: { cycle: string; total: string }[] }[] = [];

    for (const catName of categoryNames) {
      const data: { cycle: string; total: string }[] = [];
      for (const cycle of cycles) {
        const [row] = await db
          .select({
            total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)`,
          })
          .from(transactionsTable)
          .where(
            sql`${transactionsTable.type} = 'Expense'
                AND ${transactionsTable.category} = ${catName}
                AND ${transactionsTable.date}::date >= ${cycle.startDate}::date
                AND ${transactionsTable.date}::date <= ${cycle.endDate}::date`
          );
        data.push({ cycle: cycle.label, total: Number(row.total).toFixed(2) });
      }
      const hasAnySpend = data.some((d) => Number(d.total) > 0);
      if (hasAnySpend) {
        result.push({ category: catName, data });
      }
    }

    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Failed to get category trend");
    res.status(500).json({ error: "Internal error" });
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

    const settings = await getAppSettings();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const { startDate: cycleStartStr, endDate: cycleEndStr } = getCycleDates(currentMonth, settings.billingCycleDay);
    const todayStr = today.toISOString().split("T")[0];

    const currentCyclePayments = new Map<number, boolean>();
    for (const account of ccAccounts) {
      if (!account.billingDueDay) continue;

      const payments = await db
        .select({ count: sql<number>`count(*)` })
        .from(transactionsTable)
        .where(
          sql`${transactionsTable.type} = 'Transfer' AND ${transactionsTable.toAccountId} = ${account.id} AND ${transactionsTable.date}::text >= ${cycleStartStr} AND ${transactionsTable.date}::text <= ${todayStr}`
        );
      currentCyclePayments.set(account.id, Number(payments[0].count) > 0);
    }

    const result = ccAccounts.map((account) => {
      const outstanding = Math.abs(Number(account.currentBalance));
      let daysUntilDue: number | null = null;

      if (account.billingDueDay) {
        const dueDay = account.billingDueDay;
        const paidThisCycle = currentCyclePayments.get(account.id) || false;

        let nextDue: Date;
        if (paidThisCycle) {
          let nextMonth = today.getMonth() + 1;
          let nextYear = today.getFullYear();
          if (nextMonth > 11) { nextMonth = 0; nextYear++; }
          const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
          nextDue = new Date(nextYear, nextMonth, Math.min(dueDay, daysInNextMonth));
        } else {
          nextDue = getNextDueDate(today, dueDay);
        }
        const diffMs = nextDue.getTime() - today.getTime();
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
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
