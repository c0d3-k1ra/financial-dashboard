import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTransactionFilters, useSortedPaginatedTransactions, isBalanceAdjustment } from "./use-transaction-filters";
import type { Transaction } from "@workspace/api-client-react";

const mockTransactions: Transaction[] = [
  { id: 1, date: "2026-04-05", amount: "5000", description: "Groceries", category: "Food", type: "Expense", accountId: 1, toAccountId: null, createdAt: "2026-04-05T10:00:00Z" },
  { id: 2, date: "2026-04-04", amount: "100000", description: "April Salary", category: "Paycheck (Salary)", type: "Income", accountId: 1, toAccountId: null, createdAt: "2026-04-04T09:00:00Z" },
  { id: 3, date: "2026-04-03", amount: "2000", description: "Uber rides", category: "Transportation", type: "Expense", accountId: 3, toAccountId: null, createdAt: "2026-04-03T12:00:00Z" },
  { id: 4, date: "2026-04-02", amount: "1500", description: "Balance Adjustment", category: "Utilities", type: "Expense", accountId: 1, toAccountId: null, createdAt: "2026-04-02T14:00:00Z" },
];

describe("isBalanceAdjustment", () => {
  it("returns true for balance adjustment description", () => {
    expect(isBalanceAdjustment(mockTransactions[3])).toBe(true);
  });

  it("returns false for normal transactions", () => {
    expect(isBalanceAdjustment(mockTransactions[0])).toBe(false);
  });
});

describe("useTransactionFilters", () => {
  it("initializes with default values", () => {
    const { result } = renderHook(() => useTransactionFilters());
    expect(result.current.search).toBe("");
    expect(result.current.sortField).toBe("date");
    expect(result.current.sortDir).toBe("desc");
    expect(result.current.currentPage).toBe(1);
    expect(result.current.activeFilterCount).toBe(0);
  });

  it("updates search", () => {
    const { result } = renderHook(() => useTransactionFilters());
    act(() => result.current.setSearch("test"));
    expect(result.current.search).toBe("test");
    expect(result.current.activeFilterCount).toBe(1);
  });

  it("toggleSort changes direction for same field", () => {
    const { result } = renderHook(() => useTransactionFilters());
    act(() => result.current.toggleSort("date"));
    expect(result.current.sortDir).toBe("asc");
  });

  it("toggleSort changes field for different field", () => {
    const { result } = renderHook(() => useTransactionFilters());
    act(() => result.current.toggleSort("amount"));
    expect(result.current.sortField).toBe("amount");
    expect(result.current.sortDir).toBe("desc");
  });

  it("clearAllFilters resets everything", () => {
    const { result } = renderHook(() => useTransactionFilters());
    act(() => {
      result.current.setSearch("test");
      result.current.setFilterCategory("Food");
    });
    expect(result.current.activeFilterCount).toBe(2);
    act(() => result.current.clearAllFilters());
    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.search).toBe("");
  });

  it("handleCategoryClick sets category and resets page", () => {
    const { result } = renderHook(() => useTransactionFilters());
    act(() => result.current.handleCategoryClick("Food"));
    expect(result.current.filterCategory).toBe("Food");
    expect(result.current.currentPage).toBe(1);
  });

  it("toggleAdjustmentDate toggles dates in set", () => {
    const { result } = renderHook(() => useTransactionFilters());
    act(() => result.current.toggleAdjustmentDate("2026-04-02"));
    expect(result.current.expandedAdjustmentDates.has("2026-04-02")).toBe(true);
    act(() => result.current.toggleAdjustmentDate("2026-04-02"));
    expect(result.current.expandedAdjustmentDates.has("2026-04-02")).toBe(false);
  });
});

describe("useSortedPaginatedTransactions", () => {
  it("sorts by date descending by default", () => {
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(mockTransactions, "date", "desc", true, 1),
    );
    expect(result.current.paginatedTransactions[0].date).toBe("2026-04-05");
  });

  it("sorts by amount descending", () => {
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(mockTransactions, "amount", "desc", true, 1),
    );
    const amounts = result.current.paginatedTransactions.map(t => Number(t.amount));
    expect(amounts[0]).toBeGreaterThanOrEqual(amounts[amounts.length - 1]);
  });

  it("sorts by category", () => {
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(mockTransactions, "category", "asc", true, 1),
    );
    expect(result.current.paginatedTransactions.length).toBe(4);
    expect(result.current.totalCount).toBe(4);
  });

  it("sorts by description", () => {
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(mockTransactions, "description", "asc", true, 1),
    );
    expect(result.current.paginatedTransactions.length).toBe(4);
    expect(result.current.totalCount).toBe(4);
  });

  it("filters out balance adjustments when showAdjustments is false", () => {
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(mockTransactions, "date", "desc", false, 1),
    );
    expect(result.current.totalCount).toBe(3);
  });

  it("includes balance adjustments when showAdjustments is true", () => {
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(mockTransactions, "date", "desc", true, 1),
    );
    expect(result.current.totalCount).toBe(4);
  });

  it("groups by date", () => {
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(mockTransactions, "date", "desc", true, 1),
    );
    expect(result.current.dateGroups.length).toBeGreaterThan(0);
    expect(result.current.dateGroups[0].date).toBe("2026-04-05");
  });

  it("calculates dailySpend per date group", () => {
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(mockTransactions, "date", "desc", true, 1),
    );
    const foodGroup = result.current.dateGroups.find(g => g.date === "2026-04-05");
    expect(foodGroup?.dailySpend).toBe(5000);
  });

  it("returns correct showingFrom and showingTo", () => {
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(mockTransactions, "date", "desc", true, 1),
    );
    expect(result.current.showingFrom).toBe(1);
    expect(result.current.showingTo).toBe(4);
  });

  it("handles undefined transactions", () => {
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(undefined, "date", "desc", true, 1),
    );
    expect(result.current.totalCount).toBe(0);
    expect(result.current.showingFrom).toBe(0);
  });

  it("sorts by date ascending", () => {
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(mockTransactions, "date", "asc", true, 1),
    );
    expect(result.current.paginatedTransactions[0].date).toBe("2026-04-02");
  });

  it("sorts by amount ascending", () => {
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(mockTransactions, "amount", "asc", true, 1),
    );
    const amounts = result.current.paginatedTransactions.map(t => Number(t.amount));
    expect(amounts[0]).toBeLessThanOrEqual(amounts[amounts.length - 1]);
  });

  it("sorts by description descending", () => {
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(mockTransactions, "description", "desc", true, 1),
    );
    expect(result.current.paginatedTransactions.length).toBe(4);
  });

  it("sorts by category descending", () => {
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(mockTransactions, "category", "desc", true, 1),
    );
    expect(result.current.paginatedTransactions.length).toBe(4);
  });

  it("handles same-date transactions sorted by amount", () => {
    const sameDateTx: Transaction[] = [
      { id: 1, date: "2026-04-05", amount: "5000", description: "A", category: "Food", type: "Expense", accountId: 1, toAccountId: null, createdAt: "2026-04-05T10:00:00Z" },
      { id: 2, date: "2026-04-05", amount: "3000", description: "B", category: "Food", type: "Expense", accountId: 1, toAccountId: null, createdAt: "2026-04-05T11:00:00Z" },
    ];
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(sameDateTx, "amount", "desc", true, 1),
    );
    expect(Number(result.current.paginatedTransactions[0].amount)).toBe(5000);
    expect(Number(result.current.paginatedTransactions[1].amount)).toBe(3000);
  });

  it("handles same-date transactions sorted by category", () => {
    const sameDateTx: Transaction[] = [
      { id: 1, date: "2026-04-05", amount: "5000", description: "A", category: "Zulu", type: "Expense", accountId: 1, toAccountId: null, createdAt: "2026-04-05T10:00:00Z" },
      { id: 2, date: "2026-04-05", amount: "3000", description: "B", category: "Alpha", type: "Expense", accountId: 1, toAccountId: null, createdAt: "2026-04-05T11:00:00Z" },
    ];
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(sameDateTx, "category", "asc", true, 1),
    );
    expect(result.current.paginatedTransactions[0].category).toBe("Alpha");
  });

  it("handles same-date transactions sorted by description", () => {
    const sameDateTx: Transaction[] = [
      { id: 1, date: "2026-04-05", amount: "5000", description: "Zulu", category: "Food", type: "Expense", accountId: 1, toAccountId: null, createdAt: "2026-04-05T10:00:00Z" },
      { id: 2, date: "2026-04-05", amount: "3000", description: "Alpha", category: "Food", type: "Expense", accountId: 1, toAccountId: null, createdAt: "2026-04-05T11:00:00Z" },
    ];
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(sameDateTx, "description", "asc", true, 1),
    );
    expect(result.current.paginatedTransactions[0].description).toBe("Alpha");
  });

  it("calculates dailySpend for multiple expenses on same date", () => {
    const multiTx: Transaction[] = [
      { id: 1, date: "2026-04-05", amount: "3000", description: "A", category: "Food", type: "Expense", accountId: 1, toAccountId: null, createdAt: "2026-04-05T10:00:00Z" },
      { id: 2, date: "2026-04-05", amount: "2000", description: "B", category: "Food", type: "Expense", accountId: 1, toAccountId: null, createdAt: "2026-04-05T11:00:00Z" },
      { id: 3, date: "2026-04-05", amount: "10000", description: "C", category: "Salary", type: "Income", accountId: 1, toAccountId: null, createdAt: "2026-04-05T12:00:00Z" },
    ];
    const { result } = renderHook(() =>
      useSortedPaginatedTransactions(multiTx, "date", "desc", true, 1),
    );
    expect(result.current.dateGroups[0].dailySpend).toBe(5000);
  });
});

describe("useTransactionFilters - dateRange params", () => {
  it("computes date range params for months filter", () => {
    const { result } = renderHook(() => useTransactionFilters());
    act(() => result.current.setDateRange("3"));
    expect(result.current.queryParams).toHaveProperty("cycleStart");
    expect(result.current.queryParams).toHaveProperty("cycleEnd");
  });

  it("computes date range params for custom with both dates", () => {
    const { result } = renderHook(() => useTransactionFilters());
    act(() => {
      result.current.setDateRange("custom");
      result.current.setCustomFrom(new Date("2026-01-01"));
      result.current.setCustomTo(new Date("2026-03-31"));
    });
    expect(result.current.queryParams.cycleStart).toBe("2026-01-01");
    expect(result.current.queryParams.cycleEnd).toBe("2026-03-31");
  });

  it("returns no date params for custom without dates", () => {
    const { result } = renderHook(() => useTransactionFilters());
    act(() => {
      result.current.setDateRange("custom");
    });
    expect(result.current.queryParams.cycleStart).toBeUndefined();
    expect(result.current.queryParams.cycleEnd).toBeUndefined();
  });

  it("counts all active filters", () => {
    const { result } = renderHook(() => useTransactionFilters());
    act(() => {
      result.current.setFilterCategory("Food");
      result.current.setFilterType("Expense");
      result.current.setFilterAccount("1");
      result.current.setAmountMin("100");
      result.current.setAmountMax("1000");
      result.current.setDateRange("3");
      result.current.setSearch("test");
    });
    expect(result.current.activeFilterCount).toBe(7);
  });

  it("builds queryParams with all filters", () => {
    const { result } = renderHook(() => useTransactionFilters());
    act(() => {
      result.current.setSearch("test");
      result.current.setFilterCategory("Food");
      result.current.setFilterType("Expense");
      result.current.setFilterAccount("1");
      result.current.setAmountMin("100");
      result.current.setAmountMax("500");
    });
    expect(result.current.queryParams.search).toBe("test");
    expect(result.current.queryParams.category).toBe("Food");
    expect(result.current.queryParams.type).toBe("Expense");
    expect(result.current.queryParams.accountId).toBe("1");
    expect(result.current.queryParams.amountMin).toBe("100");
    expect(result.current.queryParams.amountMax).toBe("500");
  });
});
