import { useState, useMemo, useEffect, useCallback } from "react";
import { format, subMonths } from "date-fns";
import type { Transaction } from "@workspace/api-client-react";
import { formatDate } from "@/lib/constants";

export type SortField = "date" | "amount" | "category" | "description";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 15;

export const isBalanceAdjustment = (tx: Transaction) =>
  tx.description.toLowerCase().includes("balance adjustment") ||
  tx.category.toLowerCase() === "balance adjustment";

export function useTransactionFilters() {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [dateRange, setDateRange] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [expandedAdjustmentDates, setExpandedAdjustmentDates] = useState<Set<string>>(new Set());

  const dateRangeParams = useMemo(() => {
    if (dateRange === "custom") {
      if (customFrom && customTo) {
        return { cycleStart: format(customFrom, "yyyy-MM-dd"), cycleEnd: format(customTo, "yyyy-MM-dd") };
      }
      return {};
    }
    if (dateRange === "all") return {};
    const months = parseInt(dateRange);
    const now = new Date();
    const start = subMonths(now, months);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { cycleStart: format(start, "yyyy-MM-dd"), cycleEnd: format(endOfMonth, "yyyy-MM-dd") };
  }, [dateRange, customFrom, customTo]);

  const queryParams = useMemo(() => {
    const params: Record<string, string | undefined> = {
      search: search || undefined,
      category: filterCategory !== "all" ? filterCategory : undefined,
      type: filterType !== "all" ? filterType : undefined,
      accountId: filterAccount !== "all" ? filterAccount : undefined,
      amountMin: amountMin || undefined,
      amountMax: amountMax || undefined,
      ...dateRangeParams,
    };
    return params;
  }, [search, filterCategory, filterType, filterAccount, amountMin, amountMax, dateRangeParams]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterCategory !== "all") count++;
    if (filterType !== "all") count++;
    if (filterAccount !== "all") count++;
    if (amountMin) count++;
    if (amountMax) count++;
    if (dateRange !== "all") count++;
    if (search) count++;
    return count;
  }, [filterCategory, filterType, filterAccount, amountMin, amountMax, dateRange, search]);

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setFilterCategory("all");
    setFilterType("all");
    setFilterAccount("all");
    setAmountMin("");
    setAmountMax("");
    setDateRange("all");
    setCustomFrom(undefined);
    setCustomTo(undefined);
    setCurrentPage(1);
  }, []);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }, [sortField]);

  const toggleAdjustmentDate = useCallback((date: string) => {
    setExpandedAdjustmentDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }, []);

  const handleCategoryClick = useCallback((category: string) => {
    setFilterCategory(category);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [queryParams, sortField, sortDir]);

  return {
    search, setSearch,
    sortField, setSortField, sortDir, setSortDir,
    dateRange, setDateRange,
    customFrom, setCustomFrom, customTo, setCustomTo,
    filterCategory, setFilterCategory,
    filterAccount, setFilterAccount,
    filterType, setFilterType,
    amountMin, setAmountMin, amountMax, setAmountMax,
    currentPage, setCurrentPage,
    showAdjustments, setShowAdjustments,
    expandedAdjustmentDates, setExpandedAdjustmentDates,
    queryParams, activeFilterCount,
    clearAllFilters, toggleSort, toggleAdjustmentDate, handleCategoryClick,
  };
}

export function useSortedPaginatedTransactions(
  transactions: Transaction[] | undefined,
  sortField: SortField,
  sortDir: SortDir,
  showAdjustments: boolean,
  currentPage: number,
) {
  const sortedTransactions = useMemo(() => {
    if (!transactions) return [];
    let filtered = [...transactions];
    if (!showAdjustments) {
      filtered = filtered.filter((tx) => !isBalanceAdjustment(tx));
    }
    const sorted = filtered.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (sortField === "date") {
        return sortDir === "asc" ? -dateCmp : dateCmp;
      }
      if (dateCmp !== 0) {
        return sortDir === "asc" ? -dateCmp : dateCmp;
      }
      let cmp = 0;
      switch (sortField) {
        case "amount":
          cmp = Number(a.amount) - Number(b.amount);
          break;
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
        case "description":
          cmp = a.description.localeCompare(b.description);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [transactions, sortField, sortDir, showAdjustments]);

  const totalCount = sortedTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedTransactions.slice(start, start + PAGE_SIZE);
  }, [sortedTransactions, currentPage]);

  const showingFrom = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(currentPage * PAGE_SIZE, totalCount);

  const dateGroups = useMemo(() => {
    const groups: { date: string; formattedDate: string; dailySpend: number; transactions: Transaction[] }[] = [];
    const map = new Map<string, Transaction[]>();
    for (const tx of paginatedTransactions) {
      const existing = map.get(tx.date);
      if (existing) {
        existing.push(tx);
      } else {
        const arr = [tx];
        map.set(tx.date, arr);
        groups.push({
          date: tx.date,
          formattedDate: formatDate(tx.date),
          dailySpend: 0,
          transactions: arr,
        });
      }
    }
    for (const group of groups) {
      group.dailySpend = group.transactions
        .filter((tx) => tx.type === "Expense" && !isBalanceAdjustment(tx))
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
    }
    return groups;
  }, [paginatedTransactions]);

  return { sortedTransactions, paginatedTransactions, dateGroups, totalCount, totalPages, showingFrom, showingTo };
}
