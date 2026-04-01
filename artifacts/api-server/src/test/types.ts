export interface AccountResponse {
  id: number;
  name: string;
  type: string;
  currentBalance: string;
  creditLimit: string | null;
  billingDueDay: number | null;
}

export interface TransactionResponse {
  id: number;
  date: string;
  amount: string;
  description: string;
  category: string;
  type: string;
  accountId: number | null;
  toAccountId: number | null;
  createdAt: string;
}

export interface BudgetGoalResponse {
  id: number;
  category: string;
  plannedAmount: string;
}

export interface BudgetAnalysisRow {
  category: string;
  planned: string;
  actual: string;
  difference: string;
  overBudget: boolean;
}

export interface GoalResponse {
  id: number;
  name: string;
  targetAmount: string;
  currentAmount: string;
  accountId: number;
  accountName: string | null;
  status: string;
  targetDate: string | null;
  categoryType: string;
  icon: string | null;
  velocity: number;
  statusIndicator: string;
  projectedFinishDate: string | null;
}

export interface WaterfallResponse {
  totalBankBalance: string;
  goalAllocations: { goalId: number; goalName: string; allocated: string }[];
  remainingLiquidCash: string;
  avgMonthlyLivingExpenses: string;
  stressTest: boolean;
}

export interface ProjectionPoint {
  month: string;
  projectedBalance: string;
  neededBalance: string | null;
  targetAmount: string;
}

export interface SurplusMonthlyResponse {
  month: string;
  income: string;
  expenses: string;
  surplus: string;
}

export interface DistributeResult {
  success: boolean;
  allocatedTotal: string;
  transfers: number;
  surplus: string;
}

export interface AllocationResponse {
  id: number;
  month: string;
  goalId: number;
  goalName: string;
  amount: string;
  sourceAccountId: number | null;
  allocatedAt: string;
}

export interface DashboardSummary {
  bankBalance: string;
  unpaidCcDues: string;
  netLiquidity: string;
  totalIncome: string;
  totalExpenses: string;
  monthlySurplus: string;
  burnRate: number;
  plannedExpenses: string;
  actualExpenses: string;
  startingBalance: string;
  endBalance: string;
}

export interface MonthlyTrendPoint {
  month: string;
  income: string;
  expenses: string;
}

export interface CycleDataPoint {
  cycle: string;
  total: string;
}

export interface SpendByCategoryRow {
  category: string;
  total: string;
}

export interface CcDueItem {
  id: number;
  name: string;
  outstanding: string;
  billingDueDay: number | null;
  daysUntilDue: number | null;
  creditLimit: string | null;
}

export interface BillingCycleItem {
  label: string;
  startDate: string;
  endDate: string;
}

export interface CategoryTrendItem {
  category: string;
  data: { cycle: string; total: string }[];
}

export interface CategoryResponse {
  id: number;
  name: string;
  type: string;
}

export interface GoalVaultResponse {
  id: number;
  name: string;
  currentBalance: string;
  targetAmount: string;
}
