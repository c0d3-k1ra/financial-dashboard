import { describe, it, expect } from "vitest";
import { db, mockChain } from "../test/db-mock";
import { detectQueryIntent, handleQuery } from "../routes/helpers/query-handler";

const mockAccounts = [
  { id: 1, name: "SBI", type: "bank" },
  { id: 2, name: "HDFC CC", type: "credit_card" },
];

describe("handleQuery", () => {
  it("handles today_spending with results", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([
        { description: "Coffee", amount: "300", category: "Food", accountId: 1 },
        { description: "Lunch", amount: "500", category: "Food", accountId: 1 },
      ]));
    const result = await handleQuery({ type: "today_spending" }, mockAccounts);
    expect(result.reply).toContain("spending breakdown");
    expect(result.queryData.queryType).toBe("today_spending");
    expect(result.queryData.items).toHaveLength(2);
  });

  it("handles today_spending with no results", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]));
    const result = await handleQuery({ type: "today_spending" }, mockAccounts);
    expect(result.reply).toContain("No expenses");
  });

  it("handles period_spending this_week", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([
        { description: "Groceries", amount: "1500", category: "Groceries", accountId: 1 },
      ]));
    const result = await handleQuery({ type: "period_spending", period: "this_week" }, mockAccounts);
    expect(result.queryData.title).toBe("This Week's Spending");
  });

  it("handles period_spending this_month", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 25, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 25 }]))
      .mockReturnValueOnce(mockChain([]));
    const result = await handleQuery({ type: "period_spending", period: "this_month" }, mockAccounts);
    expect(result.queryData.title).toBe("This Month's Spending");
  });

  it("handles period_spending last_month", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 25, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 25 }]))
      .mockReturnValueOnce(mockChain([]));
    const result = await handleQuery({ type: "period_spending", period: "last_month" }, mockAccounts);
    expect(result.queryData.title).toBe("Last Month's Spending");
  });

  it("handles period_spending yesterday", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([]));
    const result = await handleQuery({ type: "period_spending", period: "yesterday" }, mockAccounts);
    expect(result.queryData.title).toBe("Yesterday's Spending");
  });

  it("handles category_spending", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([{ name: "Food" }]))
      .mockReturnValueOnce(mockChain([
        { description: "Lunch", amount: "500", date: "2025-03-01", accountId: 1 },
      ]));
    const result = await handleQuery({ type: "category_spending", category: "food" }, mockAccounts);
    expect(result.queryData.queryType).toBe("category_spending");
    expect(result.queryData.title).toContain("Food");
  });

  it("handles category_spending no results", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]));
    const result = await handleQuery({ type: "category_spending", category: "food" }, mockAccounts);
    expect(result.reply).toContain("No");
  });

  it("handles category_spending with period last_month", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([{ name: "Food" }]))
      .mockReturnValueOnce(mockChain([]));
    const result = await handleQuery({ type: "category_spending", category: "food", period: "last_month" }, mockAccounts);
    expect(result.queryData.summary).toContain("last month");
  });

  it("handles account_balance", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([
        { id: 1, name: "SBI", type: "bank", currentBalance: "200000", creditLimit: null },
        { id: 2, name: "HDFC CC", type: "credit_card", currentBalance: "40000", creditLimit: "100000" },
      ]));
    const result = await handleQuery({ type: "account_balance" }, mockAccounts);
    expect(result.queryData.queryType).toBe("account_balance");
    expect(result.queryData.items).toHaveLength(2);
    expect(result.queryData.items[1].sublabel).toContain("outstanding");
  });

  it("handles debt_summary with cc debt", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([
        { name: "HDFC CC", currentBalance: "40000", creditLimit: "100000" },
      ]))
      .mockReturnValueOnce(mockChain([]));
    const result = await handleQuery({ type: "debt_summary" }, mockAccounts);
    expect(result.queryData.queryType).toBe("debt_summary");
    expect(result.reply).toContain("debt summary");
  });

  it("handles debt_summary with loan", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([
        { name: "Home Loan", currentBalance: "-500000" },
      ]));
    const result = await handleQuery({ type: "debt_summary" }, mockAccounts);
    expect(result.queryData.items.some(i => i.sublabel === "Loan")).toBe(true);
  });

  it("handles debt_summary no debt", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]));
    const result = await handleQuery({ type: "debt_summary" }, mockAccounts);
    expect(result.reply).toContain("no outstanding debt");
  });

  it("handles recent_transactions", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([
        { description: "Coffee", amount: "300", category: "Food", type: "Expense", date: "2025-03-01", accountId: 1 },
        { description: "Salary", amount: "50000", category: "Salary", type: "Income", date: "2025-03-01", accountId: 1 },
      ]));
    const result = await handleQuery({ type: "recent_transactions", limit: 5 }, mockAccounts);
    expect(result.queryData.queryType).toBe("recent_transactions");
    expect(result.queryData.items).toHaveLength(2);
    expect(result.queryData.items[1].value).toContain("+");
  });

  it("handles top_expenses", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([
        { description: "Rent", amount: "20000", category: "Rent", date: "2025-03-01", accountId: 1 },
      ]));
    const result = await handleQuery({ type: "top_expenses" }, mockAccounts);
    expect(result.queryData.queryType).toBe("top_expenses");
    expect(result.reply).toContain("biggest expenses");
  });

  it("handles monthly_summary with positive surplus", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([{ total: "50000", count: 1 }]))
      .mockReturnValueOnce(mockChain([{ total: "30000", count: 10 }]))
      .mockReturnValueOnce(mockChain([
        { category: "Food", total: "15000" },
        { category: "Transport", total: "5000" },
      ]));
    const result = await handleQuery({ type: "monthly_summary" }, mockAccounts);
    expect(result.queryData.queryType).toBe("monthly_summary");
    expect(result.queryData.items.length).toBeGreaterThanOrEqual(3);
    expect(result.queryData.summary).toContain("Surplus");
  });

  it("handles monthly_summary with negative surplus", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([{ total: "30000", count: 1 }]))
      .mockReturnValueOnce(mockChain([{ total: "50000", count: 10 }]))
      .mockReturnValueOnce(mockChain([]));
    const result = await handleQuery({ type: "monthly_summary" }, mockAccounts);
    expect(result.reply).toContain("exceeds income");
  });

  it("handles default settings fallback", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]));
    const result = await handleQuery({ type: "today_spending" }, []);
    expect(result.queryData.queryType).toBe("today_spending");
  });

  it("handles period_spending with null period defaults to today", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([]));
    const result = await handleQuery({ type: "period_spending" }, mockAccounts);
    expect(result.queryData.queryType).toBe("period_spending");
  });

  it("handles category_spending with no catRow found", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([
        { description: null, amount: "500", date: "2025-03-01", accountId: null },
      ]));
    const result = await handleQuery({ type: "category_spending", category: "Unknown" }, mockAccounts);
    expect(result.queryData.title).toContain("Unknown");
  });

  it("handles recent_transactions with Transfer and no accountId", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([
        { description: null, amount: "1000", category: "Transfer", type: "Transfer", date: "2025-03-01", accountId: null },
      ]));
    const result = await handleQuery({ type: "recent_transactions" }, mockAccounts);
    expect(result.queryData.items).toHaveLength(1);
  });

  it("handles top_expenses with this_week period", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([
        { description: null, amount: "2000", category: "Rent", date: "2025-03-01", accountId: null },
      ]));
    const result = await handleQuery({ type: "top_expenses", period: "this_week", limit: 3 }, mockAccounts);
    expect(result.queryData.queryType).toBe("top_expenses");
  });

  it("handles top_expenses with unknown period", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([]));
    const result = await handleQuery({ type: "top_expenses", period: "unknown_period" }, mockAccounts);
    expect(result.queryData.queryType).toBe("top_expenses");
  });

  it("handles account_balance with no creditLimit", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([
        { id: 1, name: "SBI", type: "bank", currentBalance: null, creditLimit: null },
        { id: 2, name: "CC", type: "credit_card", currentBalance: null, creditLimit: null },
      ]));
    const result = await handleQuery({ type: "account_balance" }, mockAccounts);
    expect(result.queryData.items).toHaveLength(2);
  });

  it("handles debt_summary with zero outstanding cc", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([
        { name: "CC", currentBalance: null, creditLimit: null },
      ]))
      .mockReturnValueOnce(mockChain([
        { name: "Loan", currentBalance: null },
      ]));
    const result = await handleQuery({ type: "debt_summary" }, mockAccounts);
    expect(result.reply).toContain("no outstanding debt");
  });

  it("handles monthly_summary with null totals", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([{ total: null, count: null }]))
      .mockReturnValueOnce(mockChain([{ total: null, count: null }]))
      .mockReturnValueOnce(mockChain([]));
    const result = await handleQuery({ type: "monthly_summary" }, mockAccounts);
    expect(result.queryData.queryType).toBe("monthly_summary");
  });

  it("handles today_spending with null description and accountId rows", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ billingCycleDay: 1 }]))
      .mockReturnValueOnce(mockChain([
        { description: null, amount: "300", category: "Food", accountId: null },
      ]));
    const result = await handleQuery({ type: "today_spending" }, mockAccounts);
    expect(result.queryData.items).toHaveLength(1);
  });
});

describe("detectQueryIntent edge cases", () => {
  it("detects most expensive this week", () => {
    const result = detectQueryIntent("most expensive this week");
    expect(result?.type).toBe("top_expenses");
    expect(result?.period).toBe("this_week");
  });

  it("detects top spending today", () => {
    const result = detectQueryIntent("top spending today");
    expect(result?.type).toBe("top_expenses");
    expect(result?.period).toBe("today");
  });

  it("detects most expensive last month", () => {
    const result = detectQueryIntent("most expensive last month");
    expect(result?.type).toBe("top_expenses");
    expect(result?.period).toBe("last_month");
  });

  it("detects financial summary", () => {
    const result = detectQueryIntent("show me my financial summary");
    expect(result?.type).toBe("monthly_summary");
  });

  it("detects savings rate query", () => {
    const result = detectQueryIntent("what is my savings rate");
    expect(result?.type).toBe("monthly_summary");
  });
});
