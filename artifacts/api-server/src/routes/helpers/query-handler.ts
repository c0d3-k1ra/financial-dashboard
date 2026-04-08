import { eq, desc, sql, and, ilike, gte, lte } from "drizzle-orm";
import { likeContains } from "../../lib/escape-like";
import {
  db,
  transactionsTable,
  categoriesTable,
  accountsTable,
  appSettingsTable,
} from "@workspace/db";
import { getAppSettings, getCurrencySymbol } from "../../lib/settings-helper";

export type QueryType =
  | "today_spending"
  | "period_spending"
  | "category_spending"
  | "account_balance"
  | "debt_summary"
  | "recent_transactions"
  | "top_expenses"
  | "monthly_summary";

export interface QueryIntent {
  type: QueryType;
  category?: string;
  period?: string;
  limit?: number;
}

export function detectQueryIntent(message: string): QueryIntent | null {
  const lower = message.toLowerCase().trim();

  if (/\d/.test(lower) && /^[^?]*\b(at|for|on|to|from|spent|paid|bought|expense|income|salary)\b/i.test(lower)) {
    const hasQuestion = /^(what|how|show|check|list|tell|give|display|get|did|do|can|where|when)\b/.test(lower);
    if (!hasQuestion) return null;
  }

  if (/\b(last|recent|previous)\s+(\d+)\s+transactions?\b/.test(lower)) {
    const match = lower.match(/\b(last|recent|previous)\s+(\d+)\s+transactions?\b/);
    return { type: "recent_transactions", limit: Math.min(Math.max(parseInt(match![2]), 1), 50) };
  }
  if (/\b(recent\s+transactions?|what\s+did\s+i\s+buy|show\s+(?:my\s+)?transactions?)\b/.test(lower) && !/today|this\s+week|this\s+month/.test(lower)) {
    return { type: "recent_transactions", limit: 5 };
  }

  if (/\b(what\s+did\s+i\s+spend|did\s+i\s+spend|how\s+much\s+(?:did\s+i\s+)?spend|show\s+(?:my\s+)?spending|expenses?)\b/.test(lower)) {
    if (/\btoday\b/.test(lower)) return { type: "today_spending" };
    if (/\bthis\s+week\b/.test(lower)) return { type: "period_spending", period: "this_week" };
    if (/\bthis\s+month\b/.test(lower) || /\bcurrent\s+(?:month|cycle)\b/.test(lower)) return { type: "period_spending", period: "this_month" };
    if (/\blast\s+month\b/.test(lower)) return { type: "period_spending", period: "last_month" };
    if (/\byesterday\b/.test(lower)) return { type: "period_spending", period: "yesterday" };
    return { type: "today_spending" };
  }

  if (/\bhow\s+much\s+(?:on|for|in)\s+([\w&'\-][\w&'\-\s]*?)(?:\s+(?:today|this\s+week|this\s+month|last\s+month))?\s*\??$/i.test(lower)) {
    const match = lower.match(/\bhow\s+much\s+(?:on|for|in)\s+([\w&'\-][\w&'\-\s]*?)(?:\s+(?:today|this\s+week|this\s+month|last\s+month))?\s*\??$/i);
    if (match) {
      const cat = match[1].trim();
      let period = "this_month";
      if (/\btoday\b/.test(lower)) period = "today";
      else if (/\bthis\s+week\b/.test(lower)) period = "this_week";
      else if (/\blast\s+month\b/.test(lower)) period = "last_month";
      return { type: "category_spending", category: cat, period };
    }
  }
  if (/\b(spending\s+(?:on|for|in)\s+|(\w+)\s+spending|breakdown\s+by\s+category|category\s+breakdown)\b/.test(lower)) {
    const match = lower.match(/\bspending\s+(?:on|for|in)\s+([\w&'\-][\w&'\-\s]*?)(?:\s*\?)?$/i);
    if (match) {
      return { type: "category_spending", category: match[1].trim(), period: "this_month" };
    }
    if (/breakdown|by\s+category/.test(lower)) return { type: "monthly_summary" };
  }

  if (/\b(what'?s?\s+my\s+balance|show\s+(?:my\s+)?balance|account\s+balance|how\s+much\s+(?:in\s+my|do\s+i\s+have)|check\s+(?:my\s+)?balance)/i.test(lower)) {
    return { type: "account_balance" };
  }

  if (/\b(cc\s+debt|credit\s+card\s+(?:debt|outstanding|due|balance)|total\s+debt|how\s+much\s+(?:do\s+i\s+)?owe|outstanding\s+(?:amount|balance))\b/i.test(lower)) {
    return { type: "debt_summary" };
  }

  if (/\b(biggest\s+expense|top\s+(?:spending|expense)|largest\s+(?:spending|expense)|most\s+expensive)\b/i.test(lower)) {
    let period = "this_month";
    if (/\btoday\b/.test(lower)) period = "today";
    else if (/\bthis\s+week\b/.test(lower)) period = "this_week";
    else if (/\blast\s+month\b/.test(lower)) period = "last_month";
    const limitMatch = lower.match(/\btop\s+(\d+)\b/);
    return { type: "top_expenses", period, limit: limitMatch ? Math.min(Math.max(parseInt(limitMatch[1]), 1), 50) : 5 };
  }

  if (/\b(financial\s+summary|monthly\s+summary|how\s+am\s+i\s+doing|income\s+(?:vs|versus)\s+expense|surplus|savings\s+rate)\b/i.test(lower)) {
    return { type: "monthly_summary" };
  }

  return null;
}

function formatAmount(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getDateRange(period: string, billingDay: number): { startDate: string; endDate: string } {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  switch (period) {
    case "today":
      return { startDate: todayStr, endDate: todayStr };
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split("T")[0];
      return { startDate: yStr, endDate: yStr };
    }
    case "this_week": {
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(monday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      return { startDate: monday.toISOString().split("T")[0], endDate: todayStr };
    }
    case "this_month": {
      let cycleStart: Date;
      if (now.getDate() >= billingDay) {
        cycleStart = new Date(now.getFullYear(), now.getMonth(), billingDay);
      } else {
        cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, billingDay);
      }
      return { startDate: cycleStart.toISOString().split("T")[0], endDate: todayStr };
    }
    case "last_month": {
      let cycleStart: Date;
      let cycleEnd: Date;
      if (now.getDate() >= billingDay) {
        cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, billingDay);
        cycleEnd = new Date(now.getFullYear(), now.getMonth(), billingDay - 1);
      } else {
        cycleStart = new Date(now.getFullYear(), now.getMonth() - 2, billingDay);
        cycleEnd = new Date(now.getFullYear(), now.getMonth() - 1, billingDay - 1);
      }
      return { startDate: cycleStart.toISOString().split("T")[0], endDate: cycleEnd.toISOString().split("T")[0] };
    }
    default:
      return { startDate: todayStr, endDate: todayStr };
  }
}

async function getBillingCycleDay(): Promise<number> {
  const [settings] = await db.select().from(appSettingsTable).limit(1);
  return settings?.billingCycleDay ?? 25;
}

export interface QueryResultData {
  queryType: string;
  title: string;
  total?: string;
  items: { label: string; value: string; sublabel?: string }[];
  summary: string;
}

export async function handleQuery(intent: QueryIntent, userAccounts: { id: number; name: string; type: string }[]): Promise<{ reply: string; queryData: QueryResultData }> {
  const settings = await getAppSettings();
  const cs = getCurrencySymbol(settings.currencyCode);
  const billingDay = await getBillingCycleDay();

  switch (intent.type) {
    case "today_spending":
    case "period_spending": {
      const period = intent.type === "today_spending" ? "today" : (intent.period || "today");
      const { startDate, endDate } = getDateRange(period, billingDay);

      const rows = await db
        .select({
          description: transactionsTable.description,
          amount: transactionsTable.amount,
          category: transactionsTable.category,
          accountId: transactionsTable.accountId,
        })
        .from(transactionsTable)
        .where(and(
          gte(transactionsTable.date, startDate),
          lte(transactionsTable.date, endDate),
          sql`${transactionsTable.type} = 'Expense'`,
          sql`${transactionsTable.category} != 'Adjustment'`,
        ))
        .orderBy(desc(transactionsTable.amount));

      const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
      const acctNameMap = new Map(userAccounts.map(a => [a.id, a.name]));

      const periodLabels: Record<string, string> = {
        today: "Today's Spending",
        yesterday: "Yesterday's Spending",
        this_week: "This Week's Spending",
        this_month: "This Month's Spending",
        last_month: "Last Month's Spending",
      };

      const title = periodLabels[period] || "Spending";
      const items = rows.slice(0, 10).map(r => ({
        label: r.description || r.category,
        value: `${cs}${formatAmount(r.amount)}`,
        sublabel: `${r.category}${r.accountId ? ` • ${acctNameMap.get(r.accountId) || ""}` : ""}`,
      }));

      return {
        reply: rows.length > 0
          ? `Here's your spending breakdown:`
          : `No expenses found for this period.`,
        queryData: {
          queryType: intent.type,
          title,
          total: `${cs}${formatAmount(total)}`,
          items,
          summary: rows.length > 0
            ? `${rows.length} transaction${rows.length !== 1 ? "s" : ""} totaling ${cs}${formatAmount(total)}`
            : "No transactions found.",
        },
      };
    }

    case "category_spending": {
      const period = intent.period || "this_month";
      const { startDate, endDate } = getDateRange(period, billingDay);
      const searchCat = intent.category || "";

      const [catRow] = await db
        .select({ name: categoriesTable.name })
        .from(categoriesTable)
        .where(ilike(categoriesTable.name, likeContains(searchCat)))
        .limit(1);

      const catName = catRow?.name || searchCat;

      const rows = await db
        .select({
          description: transactionsTable.description,
          amount: transactionsTable.amount,
          date: transactionsTable.date,
          accountId: transactionsTable.accountId,
        })
        .from(transactionsTable)
        .where(and(
          ilike(transactionsTable.category, catName),
          gte(transactionsTable.date, startDate),
          lte(transactionsTable.date, endDate),
          sql`${transactionsTable.type} = 'Expense'`,
        ))
        .orderBy(desc(transactionsTable.amount));

      const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
      const acctNameMap = new Map(userAccounts.map(a => [a.id, a.name]));

      const periodLabels: Record<string, string> = {
        today: "today",
        this_week: "this week",
        this_month: "this month",
        last_month: "last month",
      };

      return {
        reply: rows.length > 0
          ? `Here's your ${catName} spending:`
          : `No ${catName} expenses found for this period.`,
        queryData: {
          queryType: "category_spending",
          title: `${catName} Spending`,
          total: `${cs}${formatAmount(total)}`,
          items: rows.slice(0, 10).map(r => ({
            label: r.description || catName,
            value: `${cs}${formatAmount(r.amount)}`,
            sublabel: `${r.date}${r.accountId ? ` • ${acctNameMap.get(r.accountId) || ""}` : ""}`,
          })),
          summary: `${rows.length} transaction${rows.length !== 1 ? "s" : ""} on ${catName} ${periodLabels[period] || ""} totaling ${cs}${formatAmount(total)}`,
        },
      };
    }

    case "account_balance": {
      const allAccounts = await db
        .select({
          id: accountsTable.id,
          name: accountsTable.name,
          type: accountsTable.type,
          currentBalance: accountsTable.currentBalance,
          creditLimit: accountsTable.creditLimit,
        })
        .from(accountsTable)
        .orderBy(accountsTable.type, accountsTable.name);

      const items = allAccounts.map(a => {
        const balance = Number(a.currentBalance || 0);
        const typeLabel = (a.type || "bank").replace(/_/g, " ");
        let sublabel = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);
        if (a.type === "credit_card" && a.creditLimit) {
          const limit = Number(a.creditLimit);
          const used = limit - balance;
          sublabel += ` • ${cs}${formatAmount(used > 0 ? used : 0)} outstanding`;
        }
        return {
          label: a.name,
          value: `${cs}${formatAmount(balance)}`,
          sublabel,
        };
      });

      const bankTotal = allAccounts
        .filter(a => a.type === "bank")
        .reduce((sum, a) => sum + Number(a.currentBalance || 0), 0);

      return {
        reply: "Here are your account balances:",
        queryData: {
          queryType: "account_balance",
          title: "Account Balances",
          total: `${cs}${formatAmount(bankTotal)}`,
          items,
          summary: `${allAccounts.length} account${allAccounts.length !== 1 ? "s" : ""} • Bank balance: ${cs}${formatAmount(bankTotal)}`,
        },
      };
    }

    case "debt_summary": {
      const ccAccounts = await db
        .select({
          name: accountsTable.name,
          currentBalance: accountsTable.currentBalance,
          creditLimit: accountsTable.creditLimit,
        })
        .from(accountsTable)
        .where(eq(accountsTable.type, "credit_card"));

      const loanAccounts = await db
        .select({
          name: accountsTable.name,
          currentBalance: accountsTable.currentBalance,
        })
        .from(accountsTable)
        .where(eq(accountsTable.type, "loan"));

      const items: { label: string; value: string; sublabel: string }[] = [];
      let totalCcOutstanding = 0;

      for (const cc of ccAccounts) {
        const limit = Number(cc.creditLimit || 0);
        const balance = Number(cc.currentBalance || 0);
        const outstanding = limit - balance;
        if (outstanding > 0) {
          totalCcOutstanding += outstanding;
          items.push({
            label: cc.name,
            value: `${cs}${formatAmount(outstanding)}`,
            sublabel: `Credit Card • Limit: ${cs}${formatAmount(limit)}`,
          });
        }
      }

      let totalLoanOutstanding = 0;
      for (const loan of loanAccounts) {
        const balance = Number(loan.currentBalance || 0);
        const outstanding = Math.abs(balance);
        if (outstanding > 0) {
          totalLoanOutstanding += outstanding;
          items.push({
            label: loan.name,
            value: `${cs}${formatAmount(outstanding)}`,
            sublabel: "Loan",
          });
        }
      }

      const totalDebt = totalCcOutstanding + totalLoanOutstanding;

      return {
        reply: totalDebt > 0 ? "Here's your debt summary:" : "You have no outstanding debt!",
        queryData: {
          queryType: "debt_summary",
          title: "Debt Summary",
          total: `${cs}${formatAmount(totalDebt)}`,
          items,
          summary: totalDebt > 0
            ? `CC outstanding: ${cs}${formatAmount(totalCcOutstanding)} • Loans: ${cs}${formatAmount(totalLoanOutstanding)}`
            : "No outstanding debt.",
        },
      };
    }

    case "recent_transactions": {
      const limit = intent.limit || 5;
      const rows = await db
        .select({
          description: transactionsTable.description,
          amount: transactionsTable.amount,
          category: transactionsTable.category,
          type: transactionsTable.type,
          date: transactionsTable.date,
          accountId: transactionsTable.accountId,
        })
        .from(transactionsTable)
        .orderBy(desc(transactionsTable.date), desc(transactionsTable.createdAt))
        .limit(limit);

      const acctNameMap = new Map(userAccounts.map(a => [a.id, a.name]));

      return {
        reply: `Here are your last ${rows.length} transactions:`,
        queryData: {
          queryType: "recent_transactions",
          title: `Recent Transactions`,
          items: rows.map(r => ({
            label: r.description || r.category,
            value: `${r.type === "Income" ? "+" : r.type === "Transfer" ? "" : "−"}${cs}${formatAmount(r.amount)}`,
            sublabel: `${r.category} • ${r.date}${r.accountId ? ` • ${acctNameMap.get(r.accountId) || ""}` : ""}`,
          })),
          summary: `Showing ${rows.length} most recent transaction${rows.length !== 1 ? "s" : ""}`,
        },
      };
    }

    case "top_expenses": {
      const period = intent.period || "this_month";
      const limit = intent.limit || 5;
      const { startDate, endDate } = getDateRange(period, billingDay);

      const rows = await db
        .select({
          description: transactionsTable.description,
          amount: transactionsTable.amount,
          category: transactionsTable.category,
          date: transactionsTable.date,
          accountId: transactionsTable.accountId,
        })
        .from(transactionsTable)
        .where(and(
          gte(transactionsTable.date, startDate),
          lte(transactionsTable.date, endDate),
          sql`${transactionsTable.type} = 'Expense'`,
          sql`${transactionsTable.category} != 'Adjustment'`,
        ))
        .orderBy(desc(transactionsTable.amount))
        .limit(limit);

      const acctNameMap = new Map(userAccounts.map(a => [a.id, a.name]));
      const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);

      const periodLabels: Record<string, string> = {
        today: "Today",
        this_week: "This Week",
        this_month: "This Month",
        last_month: "Last Month",
      };

      return {
        reply: `Here are your biggest expenses:`,
        queryData: {
          queryType: "top_expenses",
          title: `Top Expenses — ${periodLabels[period] || ""}`,
          total: `${cs}${formatAmount(total)}`,
          items: rows.map(r => ({
            label: r.description || r.category,
            value: `${cs}${formatAmount(r.amount)}`,
            sublabel: `${r.category} • ${r.date}${r.accountId ? ` • ${acctNameMap.get(r.accountId) || ""}` : ""}`,
          })),
          summary: `Top ${rows.length} expense${rows.length !== 1 ? "s" : ""} totaling ${cs}${formatAmount(total)}`,
        },
      };
    }

    case "monthly_summary": {
      const { startDate, endDate } = getDateRange("this_month", billingDay);

      const [incomeRow] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), '0')`.as("total"),
          count: sql<number>`COUNT(*)`.as("count"),
        })
        .from(transactionsTable)
        .where(and(
          gte(transactionsTable.date, startDate),
          lte(transactionsTable.date, endDate),
          sql`${transactionsTable.type} = 'Income'`,
        ));

      const [expenseRow] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), '0')`.as("total"),
          count: sql<number>`COUNT(*)`.as("count"),
        })
        .from(transactionsTable)
        .where(and(
          gte(transactionsTable.date, startDate),
          lte(transactionsTable.date, endDate),
          sql`${transactionsTable.type} = 'Expense'`,
          sql`${transactionsTable.category} != 'Adjustment'`,
        ));

      const income = Number(incomeRow?.total || 0);
      const expenses = Number(expenseRow?.total || 0);
      const surplus = income - expenses;
      const savingsRate = income > 0 ? Math.round((surplus / income) * 100) : 0;

      const catBreakdown = await db
        .select({
          category: transactionsTable.category,
          total: sql<string>`SUM(${transactionsTable.amount})`.as("total"),
        })
        .from(transactionsTable)
        .where(and(
          gte(transactionsTable.date, startDate),
          lte(transactionsTable.date, endDate),
          sql`${transactionsTable.type} = 'Expense'`,
          sql`${transactionsTable.category} != 'Adjustment'`,
        ))
        .groupBy(transactionsTable.category)
        .orderBy(sql`SUM(${transactionsTable.amount}) DESC`)
        .limit(8);

      const items = [
        { label: "Income", value: `${cs}${formatAmount(income)}`, sublabel: `${incomeRow?.count || 0} transactions` },
        { label: "Expenses", value: `${cs}${formatAmount(expenses)}`, sublabel: `${expenseRow?.count || 0} transactions` },
        { label: "Surplus", value: `${cs}${formatAmount(surplus)}`, sublabel: `${savingsRate}% savings rate` },
      ];

      for (const cat of catBreakdown) {
        items.push({
          label: cat.category,
          value: `${cs}${formatAmount(cat.total)}`,
          sublabel: "Expense category",
        });
      }

      return {
        reply: surplus >= 0 ? "Here's your monthly financial summary:" : "Here's your monthly summary — spending exceeds income this cycle:",
        queryData: {
          queryType: "monthly_summary",
          title: "Monthly Summary",
          total: `${cs}${formatAmount(surplus)}`,
          items,
          summary: `Income ${cs}${formatAmount(income)} — Expenses ${cs}${formatAmount(expenses)} — Surplus ${cs}${formatAmount(surplus)} (${savingsRate}% savings rate)`,
        },
      };
    }
  }
}
