import { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useGetRecentTransactions,
  getGetRecentTransactionsQueryKey,
  useGetMonthlyTrend,
  getGetMonthlyTrendQueryKey,
  useGetCcSpendTrend,
  getGetCcSpendTrendQueryKey,
  useGetSpendByCategory,
  getGetSpendByCategoryQueryKey,
  useGetCcDues,
  getGetCcDuesQueryKey,
  useGetCategoryTrend,
  getGetCategoryTrendQueryKey,
  useListGoals,
  getListGoalsQueryKey,
  useGetGoalsWaterfall,
  getGetGoalsWaterfallQueryKey,
  useListAccounts,
  getListAccountsQueryKey,
  useGetMonthlySurplus,
  getGetMonthlySurplusQueryKey,
  useDistributeSurplus,
  useListSurplusAllocations,
  getListSurplusAllocationsQueryKey,
  useCanUndoSurplus,
  getCanUndoSurplusQueryKey,
  useUndoSurplusDistribution,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/constants";
import { SensitiveValue } from "@/components/sensitive-value";

import { Button } from "@/components/ui/button";
import { ArrowLeftRight, CheckCircle2, Undo2 } from "lucide-react";
import { DialogFooter } from "@/components/ui/dialog";
import TransferModal from "@/components/transfer-modal";
import SurplusDistributeModal from "@/components/surplus-distribute-modal";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/constants";
import { useLocation } from "wouter";

import { CHART_COLORS, formatDateGroup, DashboardModal, computeCategoryTrendData } from "@/components/dashboard/chart-helpers";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { SpendByCategorySection } from "@/components/dashboard/spend-by-category";
import { RecentLedger } from "@/components/dashboard/recent-ledger";
import { LoanSection } from "@/components/dashboard/loan-section";
import { CategoryTrendChart, CcSpendTrendChart } from "@/components/dashboard/category-trend";
import { IncomeExpenseTrend } from "@/components/dashboard/income-expense-trend";
import { MonthlyFlowChart, BurnRateCard } from "@/components/dashboard/monthly-flow-burn";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [currentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [spendAccountFilter, setSpendAccountFilter] = useState<"all" | "cc" | "non_cc">("all");
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [undoConfirmOpen, setUndoConfirmOpen] = useState(false);

  const { data: summary, isLoading: isLoadingSummary, isError: isErrorSummary, refetch: refetchSummary } = useGetDashboardSummary(
    { month: currentMonth },
    { query: { enabled: true, queryKey: getGetDashboardSummaryQueryKey({ month: currentMonth }) } }
  );

  const { data: recentTxs, isLoading: isLoadingTxs, isError: isErrorTxs, refetch: refetchTxs } = useGetRecentTransactions(
    { limit: 5 },
    { query: { enabled: true, queryKey: getGetRecentTransactionsQueryKey({ limit: 5 }) } }
  );

  const { data: monthlyTrend, isLoading: isLoadingTrend, isError: isErrorTrend, refetch: refetchTrend } = useGetMonthlyTrend({
    query: { enabled: true, queryKey: getGetMonthlyTrendQueryKey() },
  });

  const { data: ccSpendTrend, isLoading: isLoadingCcSpend, isError: isErrorCcSpend, refetch: refetchCcSpend } = useGetCcSpendTrend(
    { month: currentMonth },
    { query: { enabled: true, queryKey: getGetCcSpendTrendQueryKey({ month: currentMonth }) } }
  );

  const { data: spendByCategory, isLoading: isLoadingCatSpend, isError: isErrorCatSpend, refetch: refetchCatSpend } = useGetSpendByCategory(
    { month: currentMonth, accountType: spendAccountFilter },
    { query: { enabled: true, queryKey: getGetSpendByCategoryQueryKey({ month: currentMonth, accountType: spendAccountFilter }) } }
  );

  const { data: ccDues, isLoading: isLoadingCcDues, isError: isErrorCcDues, refetch: refetchCcDues } = useGetCcDues({
    query: { enabled: true, queryKey: getGetCcDuesQueryKey() },
  });

  const { data: categoryTrend, isLoading: isLoadingCatTrend, isError: isErrorCatTrend, refetch: refetchCatTrend } = useGetCategoryTrend(
    { month: currentMonth },
    { query: { enabled: true, queryKey: getGetCategoryTrendQueryKey({ month: currentMonth }) } }
  );

  const { data: goals, isError: isErrorGoals, refetch: refetchGoals } = useListGoals();
  const { data: waterfall } = useGetGoalsWaterfall();
  const { data: allAccounts, isError: isErrorAccounts, refetch: refetchAccounts } = useListAccounts();
  const { refetch: refetchSurplus } = useGetMonthlySurplus(
    { month: currentMonth },
    { query: { enabled: false, queryKey: getGetMonthlySurplusQueryKey({ month: currentMonth }) } }
  );
  const { data: allAllocations } = useListSurplusAllocations();
  const distribute = useDistributeSurplus();
  const { data: canUndoData } = useCanUndoSurplus(
    { month: currentMonth },
    { query: { enabled: true, queryKey: getCanUndoSurplusQueryKey({ month: currentMonth }) } }
  );
  const undoSurplus = useUndoSurplusDistribution();

  const activeGoals = goals?.filter((g) => g.status === "Active") || [];
  const cycleAlreadyEnded = allAllocations?.some((a) => a.month === currentMonth) ?? false;
  const canUndo = canUndoData?.canUndo === true;

  const handleEndCycle = async () => {
    const result = await refetchSurplus();
    const surplus = Number(result.data?.surplus ?? 0);
    if (surplus <= 0) {
      toast({
        title: "No Surplus",
        description: `No surplus for ${new Date(currentMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}. Income minus expenses is ${formatCurrency(result.data?.surplus ?? "0")}.`,
        variant: "destructive",
      });
      return;
    }
    setDistributeOpen(true);
  };

  const loanAccounts = useMemo(() =>
    (allAccounts ?? []).filter((a) => a.type === "loan" && Number(a.currentBalance ?? 0) > 0),
    [allAccounts]
  );

  const pieData = useMemo(() => {
    const raw = (spendByCategory ?? []).map((item, i) => ({
      name: item.category,
      value: Number(item.total),
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));
    const total = raw.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return raw;
    const significant = raw.filter(d => d.value / total >= 0.02);
    const othersTotal = raw.filter(d => d.value / total < 0.02).reduce((s, d) => s + d.value, 0);
    if (othersTotal > 0) {
      significant.push({ name: "Others", value: othersTotal, fill: "hsl(215 16% 47%)" });
    }
    return significant;
  }, [spendByCategory]);

  const pieTotal = pieData.reduce((sum, d) => sum + d.value, 0);

  const allCategoryNames = useMemo(() => (categoryTrend ?? []).map((c) => c.category), [categoryTrend]);

  const { top5Categories, categoryTrendLineData, visibleCategories } = useMemo(
    () => computeCategoryTrendData(categoryTrend, selectedCategory),
    [categoryTrend, selectedCategory],
  );

  const waterfallData = useMemo(() => {
    if (!summary) return [];
    const income = Number(summary.totalIncome || 0);
    const expenses = Number(summary.totalExpenses || 0);
    const surplus = Number(summary.monthlySurplus || 0);
    const goalTotal = goals?.reduce((s, g) => s + Number(g.currentAmount), 0) || 0;
    return [
      { name: "Income", value: income, fill: "hsl(160 84% 39%)" },
      { name: "Expenses", value: expenses, fill: "hsl(354 70% 54%)" },
      { name: "Surplus", value: Math.max(surplus, 0), fill: "hsl(210 100% 50%)" },
      { name: "Goals", value: goalTotal, fill: "hsl(270 100% 60%)" },
    ];
  }, [summary, goals]);

  const liquidCash = Number(summary?.netLiquidity || 0);
  const monthlyOutflow = Number(summary?.plannedExpenses || 0) + Number(summary?.totalEmiDue || 0);
  const liquidityRatio = monthlyOutflow > 0 ? liquidCash / monthlyOutflow : 1;
  const liquidityHealthy = liquidityRatio >= 1;

  const { totalBank, totalCcOutstanding, totalLoanOutstanding, netWorth } = useMemo(() => {
    const accounts = allAccounts ?? [];
    const tBank = accounts.filter(a => a.type === "bank").reduce((s, a) => s + Number(a.currentBalance ?? 0), 0);
    const tCc = accounts.filter(a => a.type === "credit_card").reduce((s, a) => s + Math.abs(Number(a.currentBalance ?? 0)), 0);
    const tLoan = accounts.filter(a => a.type === "loan").reduce((s, a) => s + Math.abs(Number(a.currentBalance ?? 0)), 0);
    return { totalBank: tBank, totalCcOutstanding: tCc, totalLoanOutstanding: tLoan, netWorth: tBank - tCc - tLoan };
  }, [allAccounts]);

  const debtToAssetRatio = totalBank > 0 ? ((totalCcOutstanding + totalLoanOutstanding) / totalBank * 100) : 0;

  const crossoverMonths = useMemo(() => {
    if (!monthlyTrend) return [] as string[];
    return monthlyTrend
      .filter(d => Number(d.expenses) > Number(d.income))
      .map(d => d.month as string);
  }, [monthlyTrend]);

  const groupedTxs = useMemo(() => {
    if (!recentTxs || recentTxs.length === 0) return [];
    const groups: { date: string; label: string; txs: typeof recentTxs }[] = [];
    for (const tx of recentTxs) {
      const dateStr = tx.date.split("T")[0];
      const existing = groups.find(g => g.date === dateStr);
      if (existing) {
        existing.txs.push(tx);
      } else {
        groups.push({ date: dateStr, label: formatDateGroup(tx.date), txs: [tx] });
      }
    }
    return groups;
  }, [recentTxs]);

  const catTrendYMax = useMemo(() => {
    let max = 0;
    for (const row of categoryTrendLineData) {
      for (const key of Object.keys(row)) {
        if (key === "cycle") continue;
        const v = Number(row[key]);
        if (v > max) max = v;
      }
    }
    return max;
  }, [categoryTrendLineData]);

  const incExpYMax = useMemo(() => {
    if (!monthlyTrend) return 0;
    let max = 0;
    for (const d of monthlyTrend) {
      max = Math.max(max, Number(d.income || 0), Number(d.expenses || 0));
    }
    return max;
  }, [monthlyTrend]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetGoalsWaterfallQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListSurplusAllocationsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({ month: currentMonth }) });
    queryClient.invalidateQueries({ queryKey: getCanUndoSurplusQueryKey({ month: currentMonth }) });
    queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMonthlySurplusQueryKey() });
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight dark-text-primary dark-heading-shadow">Financial Cockpit</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="text-xs uppercase tracking-wider" onClick={() => setIsTransferOpen(true)}>
            <ArrowLeftRight className="w-4 h-4 mr-1.5" /> Transfer
          </Button>
          {cycleAlreadyEnded ? (
            <>
              <Button size="sm" variant="outline" className="text-xs uppercase tracking-wider opacity-60" disabled>
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Cycle Ended
              </Button>
              {canUndo && (
                <Button size="sm" variant="outline" className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={() => setUndoConfirmOpen(true)}>
                  <Undo2 className="w-4 h-4 mr-1.5" /> Undo Distribution
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" className="text-xs uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleEndCycle}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> End Cycle
            </Button>
          )}
          <div className="text-sm font-mono text-muted-foreground bg-secondary/50 px-3 py-1 rounded-md border border-border/50">
            {new Date(currentMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
        </div>
      </div>

      <SummaryCards
        summary={summary}
        isLoadingSummary={isLoadingSummary}
        isErrorSummary={isErrorSummary}
        refetchSummary={refetchSummary}
        liquidCash={liquidCash}
        liquidityRatio={liquidityRatio}
        liquidityHealthy={liquidityHealthy}
        totalBank={totalBank}
        totalCcOutstanding={totalCcOutstanding}
        totalLoanOutstanding={totalLoanOutstanding}
        netWorth={netWorth}
        debtToAssetRatio={debtToAssetRatio}
        allAccounts={allAccounts}
        isErrorAccounts={isErrorAccounts}
        refetchAccounts={refetchAccounts}
        goals={goals}
        isErrorGoals={isErrorGoals}
        refetchGoals={refetchGoals}
      />

      <MonthlyFlowChart
        waterfallData={waterfallData}
        isLoadingSummary={isLoadingSummary}
        isErrorSummary={isErrorSummary}
        refetchSummary={refetchSummary}
      />

      <BurnRateCard
        summary={summary}
        isLoadingSummary={isLoadingSummary}
        isErrorSummary={isErrorSummary}
        refetchSummary={refetchSummary}
      />

      <SpendByCategorySection
        pieData={pieData}
        pieTotal={pieTotal}
        isLoadingCatSpend={isLoadingCatSpend}
        isErrorCatSpend={isErrorCatSpend}
        refetchCatSpend={refetchCatSpend}
        spendAccountFilter={spendAccountFilter}
        setSpendAccountFilter={setSpendAccountFilter}
        ccDues={ccDues}
        isLoadingCcDues={isLoadingCcDues}
        isErrorCcDues={isErrorCcDues}
        refetchCcDues={refetchCcDues}
      />

      {(loanAccounts.length > 0 || Number(summary?.totalLoanOutstanding || 0) > 0) && (
        <LoanSection
          loanAccounts={loanAccounts}
          totalLoanOutstanding={summary?.totalLoanOutstanding || 0}
          totalEmiDue={summary?.totalEmiDue || 0}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CategoryTrendChart
          categoryTrendLineData={categoryTrendLineData}
          visibleCategories={visibleCategories}
          allCategoryNames={allCategoryNames}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          catTrendYMax={catTrendYMax}
          isLoadingCatTrend={isLoadingCatTrend}
          isErrorCatTrend={isErrorCatTrend}
          refetchCatTrend={refetchCatTrend}
        />
        <CcSpendTrendChart
          ccSpendTrend={ccSpendTrend}
          isLoadingCcSpend={isLoadingCcSpend}
          isErrorCcSpend={isErrorCcSpend}
          refetchCcSpend={refetchCcSpend}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <IncomeExpenseTrend
          monthlyTrend={monthlyTrend}
          crossoverMonths={crossoverMonths}
          incExpYMax={incExpYMax}
          isLoadingTrend={isLoadingTrend}
          isErrorTrend={isErrorTrend}
          refetchTrend={refetchTrend}
        />
        <RecentLedger
          groupedTxs={groupedTxs}
          isLoadingTxs={isLoadingTxs}
          isErrorTxs={isErrorTxs}
          refetchTxs={refetchTxs}
        />
      </div>

      <TransferModal open={isTransferOpen} onOpenChange={setIsTransferOpen} />

      <DashboardModal open={distributeOpen} onOpenChange={setDistributeOpen} isMobile={isMobile}>
        <SurplusDistributeModal
          goals={activeGoals}
          accounts={(allAccounts || []).filter(a => a.type === "bank")}
          month={currentMonth}
          onClose={() => setDistributeOpen(false)}
          onDistribute={(data) => {
            distribute.mutate(
              { data },
              {
                onSuccess: (res) => {
                  if (res.success) {
                    toast({
                      title: "Cycle Ended — Surplus Distributed",
                      description: `₹${res.allocatedTotal} allocated across goals. ${res.transfers} transfer(s) created.`,
                    });
                    setDistributeOpen(false);
                    invalidateAll();
                  }
                },
                onError: (err) => {
                  toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" });
                },
              }
            );
          }}
          isPending={distribute.isPending}
        />
      </DashboardModal>

      <DashboardModal open={undoConfirmOpen} onOpenChange={setUndoConfirmOpen} title="Undo Last Distribution" isMobile={isMobile}>
        <p className="text-sm text-muted-foreground">
          This will reverse the surplus distribution for {new Date(currentMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}. The following changes will be reverted:
        </p>
        <div className="space-y-3 py-2">
          {canUndoData?.allocations && canUndoData.allocations.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Goal Allocations to Remove</div>
              {canUndoData.allocations.map((a, i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded-md bg-secondary/30 text-sm tabular-nums">
                  <span>{a.goalName}</span>
                  <SensitiveValue className="text-destructive">-{formatCurrency(a.amount)}</SensitiveValue>
                </div>
              ))}
            </div>
          )}
          {(canUndoData?.transferCount ?? 0) > 0 && (
            <div className="text-xs font-mono p-2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {canUndoData!.transferCount} auto-transfer transaction(s) will be deleted and account balances reversed.
            </div>
          )}
          <div className="text-xs font-mono p-2 rounded-md bg-secondary/30 text-muted-foreground">
            The next month's starting balance entry will also be removed.
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setUndoConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={undoSurplus.isPending}
            onClick={() => {
              undoSurplus.mutate(
                { data: { month: currentMonth } },
                {
                  onSuccess: (res) => {
                    if (res.success) {
                      toast({
                        title: "Distribution Undone",
                        description: `Reverted ${res.deletedAllocations} allocation(s) and ${res.deletedTransfers} transfer(s).`,
                      });
                      setUndoConfirmOpen(false);
                      invalidateAll();
                    }
                  },
                  onError: (err) => {
                    toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" });
                  },
                }
              );
            }}
          >
            <Undo2 className="w-4 h-4 mr-1.5" /> Confirm Undo
          </Button>
        </DialogFooter>
      </DashboardModal>
    </div>
  );
}
