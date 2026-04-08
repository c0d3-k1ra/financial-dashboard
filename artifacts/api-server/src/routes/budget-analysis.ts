import { Router, type IRouter } from "express";
import { sql, eq } from "drizzle-orm";
import { db, transactionsTable, budgetGoalsTable, categoriesTable, accountsTable } from "@workspace/db";
import { GetBudgetAnalysisQueryParams } from "@workspace/api-zod";
import { getCycleDates } from "../lib/billing-cycle";
import { getAppSettings, getCurrencySymbol } from "../lib/settings-helper";

const FIXED_CATEGORY_PATTERNS = [/emi/i, /sip/i, /insurance/i];

const FIXED_CATEGORY_NAMES = new Set([
  "father",
  "credit card (cc)",
]);

function isFixedByName(categoryName: string): boolean {
  const lower = categoryName.toLowerCase();
  if (FIXED_CATEGORY_NAMES.has(lower)) return true;
  return FIXED_CATEGORY_PATTERNS.some(pattern => pattern.test(lower));
}

function isFixedByEmiMatch(planned: number, emiAmounts: Set<number>): boolean {
  if (planned <= 0) return false;
  for (const emi of emiAmounts) {
    if (Math.abs(planned - emi) < 0.01) return true;
  }
  return false;
}

const router: IRouter = Router();

router.get("/budget-analysis", async (req, res) => {
  try {
    const { month } = GetBudgetAnalysisQueryParams.parse(req.query);
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Invalid month format. Expected YYYY-MM." });
      return;
    }

    const settings = await getAppSettings();
    const cs = getCurrencySymbol(settings.currencyCode);
    const { startDate, endDate } = getCycleDates(month, settings.billingCycleDay);

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalCycleDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysElapsed = Math.max(0, Math.min(
      totalCycleDays,
      Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    ));

    const expenseCategories = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.type, "Expense"));

    const goals = await db
      .select({
        id: budgetGoalsTable.id,
        categoryId: budgetGoalsTable.categoryId,
        plannedAmount: budgetGoalsTable.plannedAmount,
      })
      .from(budgetGoalsTable);
    const goalMap = new Map(goals.map((g) => [g.categoryId, Number(g.plannedAmount)]));
    const goalIdMap = new Map(goals.map((g) => [g.categoryId, g.id]));

    const loanAccounts = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.type, "loan"));

    const activeLoanAccounts = loanAccounts
      .filter((a) => Number(a.currentBalance ?? 0) > 0 && a.emiAmount && Number(a.emiAmount) > 0);
    const totalEmi = activeLoanAccounts.reduce((sum, a) => sum + Number(a.emiAmount), 0);

    const emiAmounts = new Set<number>();
    for (const a of activeLoanAccounts) {
      emiAmounts.add(Number(a.emiAmount));
    }
    if (totalEmi > 0) {
      emiAmounts.add(totalEmi);
    }

    const actuals = await db
      .select({
        category: transactionsTable.category,
        total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)`,
      })
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = 'Expense' AND ${transactionsTable.category} NOT IN ('Adjustment', 'Transfer') AND ${transactionsTable.date}::date >= ${startDate}::date AND ${transactionsTable.date}::date <= ${endDate}::date`)
      .groupBy(transactionsTable.category);

    const actualMap = new Map(actuals.map((a) => [a.category, Number(a.total)]));

    const timeRatio = totalCycleDays > 0 ? daysElapsed / totalCycleDays : 1;

    const rows = expenseCategories.map((cat) => {
      let planned = goalMap.get(cat.id) ?? 0;

      if (cat.name === "EMI (PL)") {
        planned = totalEmi;
      }

      const actual = actualMap.get(cat.name) ?? 0;
      const difference = planned - actual;

      const isFixed = isFixedByName(cat.name) || isFixedByEmiMatch(planned, emiAmounts);
      const categoryType = isFixed ? "fixed" as const : "discretionary" as const;

      let paceStatus: "on_pace" | "ahead" | "over_budget";
      let paceMessage: string;
      const percentSpent = planned > 0 ? (actual / planned) * 100 : (actual > 0 ? 100 : 0);

      if (actual > planned && planned > 0) {
        paceStatus = "over_budget";
        paceMessage = `Over by ${cs}${Math.abs(difference).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
      } else if (isFixed) {
        if (actual >= planned && planned > 0) {
          paceStatus = "on_pace";
          paceMessage = "Paid";
        } else if (actual > 0 && actual < planned) {
          paceStatus = "ahead";
          paceMessage = "Partially paid";
        } else {
          paceStatus = "on_pace";
          paceMessage = "Pending";
        }
      } else {
        const expectedSpent = planned * timeRatio;
        if (planned === 0) {
          paceStatus = actual > 0 ? "over_budget" : "on_pace";
          paceMessage = actual > 0 ? `Over by ${cs}${actual.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "No budget set";
        } else if (actual <= expectedSpent * 1.1) {
          paceStatus = "on_pace";
          paceMessage = "On pace";
        } else if (actual <= planned) {
          paceStatus = "ahead";
          const aheadBy = actual - expectedSpent;
          paceMessage = `Ahead by ${cs}${aheadBy.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
        } else {
          paceStatus = "over_budget";
          paceMessage = `Over by ${cs}${Math.abs(difference).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
        }
      }

      return {
        categoryId: cat.id,
        budgetGoalId: goalIdMap.get(cat.id) ?? null,
        category: cat.name,
        planned: planned.toFixed(2),
        actual: actual.toFixed(2),
        difference: difference.toFixed(2),
        overBudget: difference < 0,
        paceStatus,
        categoryType,
        percentSpent: Math.round(percentSpent * 100) / 100,
        paceMessage,
      };
    });

    res.json({
      daysElapsed,
      totalCycleDays,
      rows,
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to get budget analysis");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
