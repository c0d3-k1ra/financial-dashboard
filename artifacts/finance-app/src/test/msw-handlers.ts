import { http, HttpResponse } from "msw";
import type {
  DashboardSummary,
  Transaction,
  AccountItem,
  CategoryItem,
  AppSettings,
  GoalItem,
  MonthlyTrendPoint,
  CcSpendPoint,
  CategorySpendItem,
  CcDueItem,
  CategoryTrendItem,
  WaterfallData,
  SurplusAllocation,
  CanUndoSurplusResult,
} from "@workspace/api-client-react";

export const mockSummary: DashboardSummary = {
  bankBalance: "150000",
  unpaidCcDues: "25000",
  netLiquidity: "125000",
  totalIncome: "100000",
  totalExpenses: "60000",
  bankExpenses: "40000",
  ccExpenses: "20000",
  nonCcExpenses: "40000",
  ccTransfers: "5000",
  monthlySurplus: "40000",
  burnRate: 60,
  plannedExpenses: "70000",
  actualExpenses: "60000",
  startingBalance: "110000",
  endBalance: "150000",
  totalLoanOutstanding: "500000",
  totalEmiDue: "15000",
};

export const mockAccounts: AccountItem[] = [
  { id: 1, name: "HDFC Savings", type: "bank", currentBalance: "100000", useInSurplus: true },
  { id: 2, name: "SBI Savings", type: "bank", currentBalance: "50000", useInSurplus: false },
  { id: 3, name: "ICICI Credit Card", type: "credit_card", currentBalance: "-25000", creditLimit: "200000", billingDueDay: 15 },
  { id: 4, name: "Home Loan", type: "loan", currentBalance: "-500000", emiAmount: "15000", emiDay: 5, loanTenure: 240, interestRate: "8.5" },
];

export const mockTransactions: Transaction[] = [
  { id: 1, date: "2026-04-05", amount: "5000", description: "Groceries", category: "Food", type: "Expense", accountId: 1, toAccountId: null, createdAt: "2026-04-05T10:00:00Z" },
  { id: 2, date: "2026-04-04", amount: "100000", description: "April Salary", category: "Paycheck (Salary)", type: "Income", accountId: 1, toAccountId: null, createdAt: "2026-04-04T09:00:00Z" },
  { id: 3, date: "2026-04-03", amount: "2000", description: "Uber rides", category: "Transportation", type: "Expense", accountId: 3, toAccountId: null, createdAt: "2026-04-03T12:00:00Z" },
  { id: 4, date: "2026-04-02", amount: "1500", description: "Electricity bill", category: "Utilities", type: "Expense", accountId: 1, toAccountId: null, createdAt: "2026-04-02T14:00:00Z" },
  { id: 5, date: "2026-04-01", amount: "3000", description: "Restaurant", category: "Food", type: "Expense", accountId: 3, toAccountId: null, createdAt: "2026-04-01T20:00:00Z" },
];

export const mockCategories: CategoryItem[] = [
  { id: 1, name: "Food", type: "Expense" },
  { id: 2, name: "Transportation", type: "Expense" },
  { id: 3, name: "Utilities", type: "Expense" },
  { id: 4, name: "Paycheck (Salary)", type: "Income" },
  { id: 5, name: "Personal", type: "Expense" },
];

export const mockSettings: AppSettings = {
  billingCycleDay: 1,
  currencyCode: "INR",
};

export const mockGoals: GoalItem[] = [
  {
    id: 1, name: "Emergency Fund", targetAmount: "300000", currentAmount: "150000",
    accountId: 1, accountName: "HDFC Savings", status: "Active",
    targetDate: "2027-01-01", categoryType: "savings", icon: null,
    velocity: 12, statusIndicator: "on_track", projectedFinishDate: "2026-12-01",
  },
];

export const mockMonthlyTrend: MonthlyTrendPoint[] = [
  { month: "2026-01", income: "95000", expenses: "55000" },
  { month: "2026-02", income: "95000", expenses: "62000" },
  { month: "2026-03", income: "100000", expenses: "58000" },
  { month: "2026-04", income: "100000", expenses: "60000" },
];

export const mockCcSpendTrend: CcSpendPoint[] = [
  { cycle: "2026-02", total: "18000" },
  { cycle: "2026-03", total: "22000" },
  { cycle: "2026-04", total: "20000" },
];

export const mockSpendByCategory: CategorySpendItem[] = [
  { category: "Food", total: "15000" },
  { category: "Transportation", total: "8000" },
  { category: "Utilities", total: "5000" },
  { category: "Personal", total: "12000" },
];

export const mockCcDues: CcDueItem[] = [
  { id: 3, name: "ICICI Credit Card", outstanding: "25000", billingDueDay: 15, daysUntilDue: 7, creditLimit: "200000", remainingLimit: "175000" },
];

export const mockCategoryTrend: CategoryTrendItem[] = [
  { category: "Food", data: [{ cycle: "2026-03", total: "14000" }, { cycle: "2026-04", total: "15000" }] },
  { category: "Transportation", data: [{ cycle: "2026-03", total: "7000" }, { cycle: "2026-04", total: "8000" }] },
];

export const mockWaterfall: WaterfallData = {
  totalBankBalance: "150000",
  goalAllocations: [{ goalId: 1, goalName: "Emergency Fund", allocated: "150000" }],
  remainingLiquidCash: "0",
  avgMonthlyLivingExpenses: "60000",
  stressTest: false,
};

export const mockBudgetAnalysis = {
  daysElapsed: 10,
  totalCycleDays: 30,
  rows: [
    {
      categoryId: 1, budgetGoalId: 1, category: "Food", planned: "15000", actual: "8000",
      difference: "7000", overBudget: false, paceStatus: "on_pace" as const,
      categoryType: "discretionary" as const, percentSpent: 53, paceMessage: "On track",
    },
    {
      categoryId: 6, budgetGoalId: 2, category: "EMI (PL)", planned: "10000", actual: "10000",
      difference: "0", overBudget: false, paceStatus: "on_pace" as const,
      categoryType: "fixed" as const, percentSpent: 100, paceMessage: "Paid",
    },
    {
      categoryId: 3, budgetGoalId: 3, category: "Utilities", planned: "5000", actual: "6000",
      difference: "-1000", overBudget: true, paceStatus: "over_budget" as const,
      categoryType: "discretionary" as const, percentSpent: 120, paceMessage: "Over by ₹1,000",
    },
  ],
};

export const mockBudgetGoals = [
  { id: 1, categoryId: 1, plannedAmount: "15000" },
  { id: 2, categoryId: 6, plannedAmount: "10000" },
  { id: 3, categoryId: 3, plannedAmount: "5000" },
];

export const mockAllocations: SurplusAllocation[] = [];

export const mockCanUndo: CanUndoSurplusResult = {
  canUndo: false,
  month: "2026-04",
};

export const handlers = [
  http.get("/api/dashboard/summary", () => HttpResponse.json(mockSummary)),
  http.get("/api/transactions/recent", () => HttpResponse.json(mockTransactions.slice(0, 5))),
  http.get("/api/transactions", () => HttpResponse.json(mockTransactions)),
  http.get("/api/dashboard/monthly-trend", () => HttpResponse.json(mockMonthlyTrend)),
  http.get("/api/trends/cc-spend", () => HttpResponse.json(mockCcSpendTrend)),
  http.get("/api/analytics/spend-by-category", () => HttpResponse.json(mockSpendByCategory)),
  http.get("/api/analytics/cc-dues", () => HttpResponse.json(mockCcDues)),
  http.get("/api/analytics/category-trend", () => HttpResponse.json(mockCategoryTrend)),
  http.get("/api/accounts", () => HttpResponse.json(mockAccounts)),
  http.get("/api/categories", () => HttpResponse.json(mockCategories)),
  http.get("/api/settings", () => HttpResponse.json(mockSettings)),
  http.get("/api/goals", () => HttpResponse.json(mockGoals)),
  http.get("/api/goals/waterfall", () => HttpResponse.json(mockWaterfall)),
  http.get("/api/surplus/monthly", () => HttpResponse.json({ surplus: "40000" })),
  http.get("/api/surplus/allocations", () => HttpResponse.json(mockAllocations)),
  http.get("/api/surplus/can-undo", () => HttpResponse.json(mockCanUndo)),
  http.get("/api/trends/living-expenses", () => HttpResponse.json([])),
  http.post("/api/transactions", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id: 100, ...body, createdAt: new Date().toISOString() }, { status: 201 });
  }),
  http.put("/api/transactions/:id", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...body, id: 1, createdAt: new Date().toISOString() });
  }),
  http.delete("/api/transactions/:id", () => HttpResponse.json({ success: true })),
  http.post("/api/accounts", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id: 100, ...body }, { status: 201 });
  }),
  http.put("/api/accounts/:id", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...body });
  }),
  http.delete("/api/accounts/:id", () => HttpResponse.json({ success: true })),
  http.post("/api/accounts/:id/reconcile", () => HttpResponse.json({ success: true, previousBalance: "100000", newBalance: "120000", adjustment: "20000" })),
  http.post("/api/categories", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id: 100, ...body }, { status: 201 });
  }),
  http.post("/api/accounts/process-emis", () => HttpResponse.json({ processed: 0, message: "All loans are up to date." })),
  http.post("/api/surplus/distribute", () => HttpResponse.json({ success: true, allocatedTotal: "10000", transfers: 1 })),
  http.post("/api/surplus/undo", () => HttpResponse.json({ success: true, deletedAllocations: 1, deletedTransfers: 1, revertedGoals: 1 })),
  http.get("/api/goals/:id/projection", () => HttpResponse.json([
    { month: "Jan 2026", actual: 5000, currentPace: 5000, neededPace: 6000, targetAmount: 50000 },
    { month: "Feb 2026", actual: 10000, currentPace: 10000, neededPace: 12000, targetAmount: 50000 },
    { month: "Mar 2026", actual: 15000, currentPace: 15000, neededPace: 18000, targetAmount: 50000 },
    { month: "Apr 2026", actual: null, currentPace: 20000, neededPace: 24000, targetAmount: 50000 },
  ])),
  http.put("/api/settings", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...mockSettings, ...body });
  }),
  http.get("/api/healthz", () => HttpResponse.json({ status: "ok" })),
  http.get("/api/budget-analysis", () =>
    HttpResponse.json(mockBudgetAnalysis),
  ),
  http.get("/api/budget-goals", () => HttpResponse.json(mockBudgetGoals)),
  http.post("/api/budget-goals", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: 10, ...body }, { status: 201 });
  }),
  http.delete("/api/budget-goals/:id", () =>
    HttpResponse.json({ success: true }),
  ),
  http.post("/api/goals", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      { id: 10, ...body, currentAmount: "0", status: "Active", velocity: 0 },
      { status: 201 },
    );
  }),
  http.put("/api/goals/:id", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...body });
  }),
  http.delete("/api/goals/:id", () => HttpResponse.json({ success: true })),
  http.delete("/api/categories/:id", () =>
    HttpResponse.json({ success: true }),
  ),
  http.put("/api/categories/:id/rename", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...body });
  }),
  http.post("/api/reset", () =>
    HttpResponse.json({ success: true }),
  ),
  http.post("/api/transfers", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      { id: 200, ...body, createdAt: new Date().toISOString() },
      { status: 201 },
    );
  }),
  http.post("/api/ai/chat", () =>
    HttpResponse.json({
      reply: "I found a transaction: ₹450 at Starbucks",
      transaction: {
        transactionType: "Expense",
        amount: "450",
        date: new Date().toISOString().split("T")[0],
        description: "Starbucks",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
      warnings: [],
    }),
  ),
];
