import { formatCurrency } from "@/lib/constants";
import { SensitiveValue } from "@/components/sensitive-value";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/query-error-state";
import { Activity, Wallet, CreditCard, Landmark, Target, TrendingUp, Droplets } from "lucide-react";
import { GoalProgressRing } from "./chart-helpers";

interface SummaryCardsProps {
  summary: {
    netLiquidity?: string | number;
    bankBalance?: string | number;
    unpaidCcDues?: string | number;
    totalEmiDue?: string | number;
    totalLoanOutstanding?: string | number;
    plannedExpenses?: string | number;
  } | undefined;
  isLoadingSummary: boolean;
  isErrorSummary: boolean;
  refetchSummary: () => void;
  liquidCash: number;
  liquidityRatio: number;
  liquidityHealthy: boolean;
  totalBank: number;
  totalCcOutstanding: number;
  totalLoanOutstanding: number;
  netWorth: number;
  debtToAssetRatio: number;
  allAccounts: unknown[] | undefined;
  isErrorAccounts: boolean;
  refetchAccounts: () => void;
  goals: Array<{ targetAmount: string | number; currentAmount: string | number; status?: string }> | undefined;
  isErrorGoals: boolean;
  refetchGoals: () => void;
}

export function SummaryCards({
  summary, isLoadingSummary, isErrorSummary, refetchSummary,
  liquidityRatio, liquidityHealthy,
  totalBank, totalCcOutstanding, totalLoanOutstanding, netWorth, debtToAssetRatio,
  allAccounts, isErrorAccounts, refetchAccounts,
  goals, isErrorGoals, refetchGoals,
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card className="glass-card glass-animate-in glass-stagger-1 rounded-xl shadow-lg min-h-[200px] flex flex-col">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">Net Liquidity</CardTitle>
          <Activity className="w-4 h-4 text-primary" />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between">
          {isLoadingSummary ? (
            <Skeleton className="h-12 w-48" />
          ) : isErrorSummary ? (
            <QueryErrorState onRetry={() => refetchSummary()} message="Failed to load summary" />
          ) : (
            <>
              <div>
                <SensitiveValue as="div" className="text-4xl font-extrabold tabular-nums tracking-tight text-foreground dark-text-primary dark-heading-shadow">
                  {formatCurrency(summary?.netLiquidity || 0)}
                </SensitiveValue>
                <SensitiveValue as="div" className={`flex items-center gap-1.5 mt-2 text-sm tabular-nums ${liquidityHealthy ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                  <Droplets className="w-3.5 h-3.5" />
                  Covers {liquidityRatio.toFixed(1)}x monthly expenses
                </SensitiveValue>
              </div>
              <SensitiveValue as="div" className="flex flex-wrap gap-4 mt-3 text-sm tabular-nums text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                  {formatCurrency(summary?.bankBalance || 0)}
                </span>
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-destructive" />
                  -{formatCurrency(summary?.unpaidCcDues || 0)}
                </span>
                {Number(summary?.totalEmiDue || 0) > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-amber-500" />
                    -{formatCurrency(summary?.totalEmiDue || 0)}
                  </span>
                )}
              </SensitiveValue>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card glass-animate-in glass-stagger-2 rounded-xl shadow-lg min-h-[200px] flex flex-col">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">Net Worth</CardTitle>
          <TrendingUp className="w-4 h-4 text-primary" />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between">
          {!allAccounts && !isErrorAccounts ? (
            <Skeleton className="h-10 w-40" />
          ) : isErrorAccounts ? (
            <QueryErrorState onRetry={() => refetchAccounts()} message="Failed to load accounts" />
          ) : (
            <>
              <div>
                <SensitiveValue as="div" className={`text-4xl font-bold tabular-nums tracking-tight dark-heading-shadow ${netWorth >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {formatCurrency(Math.abs(netWorth))}
                </SensitiveValue>
                <SensitiveValue as="div" className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
                  <span className={`tabular-nums font-medium ${debtToAssetRatio > 80 ? "text-destructive" : debtToAssetRatio > 50 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    Debt-to-asset ratio: {debtToAssetRatio.toFixed(1)}%
                  </span>
                </SensitiveValue>
              </div>
              <SensitiveValue as="div" className="flex flex-wrap gap-4 mt-3 text-sm tabular-nums text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                  {formatCurrency(totalBank)}
                </span>
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-destructive" />
                  -{formatCurrency(totalCcOutstanding)}
                </span>
                {totalLoanOutstanding > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-amber-500" />
                    -{formatCurrency(totalLoanOutstanding)}
                  </span>
                )}
              </SensitiveValue>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card glass-animate-in glass-stagger-3 rounded-xl shadow-lg min-h-[200px] flex flex-col">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">Goal Progress</CardTitle>
          <Target className="w-4 h-4 text-primary" />
        </CardHeader>
        <CardContent className="flex-1">
          {isErrorGoals ? (
            <QueryErrorState onRetry={() => refetchGoals()} message="Failed to load goals" />
          ) : goals && goals.length > 0 ? (
            <GoalProgressRing goals={goals} />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
              No active goals
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
