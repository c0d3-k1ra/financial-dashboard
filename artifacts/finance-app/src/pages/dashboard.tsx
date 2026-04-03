import { useState, useMemo } from "react";
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
import { formatCurrency, formatDate } from "@/lib/constants";
import { getCategoryIcon } from "@/lib/category-icons";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowDownRight, ArrowUpRight, Wallet, CreditCard, Activity, ArrowRight, Droplets, Target, Landmark, Plus, ArrowLeftRight, CheckCircle2, Undo2, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TransferModal from "@/components/transfer-modal";
import SurplusDistributeModal from "@/components/surplus-distribute-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/constants";
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Link, useLocation } from "wouter";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(210, 70%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(35, 80%, 50%)",
  "hsl(170, 60%, 45%)",
  "hsl(330, 65%, 50%)",
];

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "hsl(222 47% 10%)",
  borderColor: "hsl(222 47% 15%)",
  borderRadius: "8px",
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  color: "hsl(210 40% 98%)",
};

const TOOLTIP_LABEL_STYLE: React.CSSProperties = {
  color: "hsl(210 40% 98%)",
};

const TOOLTIP_ITEM_STYLE: React.CSSProperties = {
  color: "hsl(210 40% 98%)",
};

function GoalProgressRing({ goals }: { goals: Array<{ targetAmount: string | number; currentAmount: string | number }> }) {
  const totalTarget = goals.reduce((s, g) => s + Number(g.targetAmount), 0);
  const totalCurrent = goals.reduce((s, g) => s + Number(g.currentAmount), 0);
  const progress = totalTarget > 0 ? Math.min((totalCurrent / totalTarget) * 100, 100) : 0;

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="relative">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="hsl(222 47% 15%)" strokeWidth="10" />
          <circle
            cx="70" cy="70" r={radius} fill="none"
            stroke="hsl(160 84% 39%)" strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 70 70)"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-mono">{progress.toFixed(0)}%</span>
          <span className="text-[10px] text-muted-foreground font-mono">GOALS</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground font-mono mt-2">
        {formatCurrency(totalCurrent)} / {formatCurrency(totalTarget)}
      </p>
    </div>
  );
}


export default function Dashboard() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [spendAccountFilter, setSpendAccountFilter] = useState<"all" | "cc" | "non_cc">("all");
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [undoConfirmOpen, setUndoConfirmOpen] = useState(false);

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary(
    { month: currentMonth },
    { query: { enabled: true, queryKey: getGetDashboardSummaryQueryKey({ month: currentMonth }) } }
  );

  const { data: recentTxs, isLoading: isLoadingTxs } = useGetRecentTransactions(
    { limit: 5 },
    { query: { enabled: true, queryKey: getGetRecentTransactionsQueryKey({ limit: 5 }) } }
  );

  const { data: monthlyTrend, isLoading: isLoadingTrend } = useGetMonthlyTrend({
    query: { enabled: true, queryKey: getGetMonthlyTrendQueryKey() },
  });

  const { data: ccSpendTrend, isLoading: isLoadingCcSpend } = useGetCcSpendTrend(
    { month: currentMonth },
    { query: { enabled: true, queryKey: getGetCcSpendTrendQueryKey({ month: currentMonth }) } }
  );

  const { data: spendByCategory, isLoading: isLoadingCatSpend } = useGetSpendByCategory(
    { month: currentMonth, accountType: spendAccountFilter },
    { query: { enabled: true, queryKey: getGetSpendByCategoryQueryKey({ month: currentMonth, accountType: spendAccountFilter }) } }
  );

  const { data: ccDues, isLoading: isLoadingCcDues } = useGetCcDues({
    query: { enabled: true, queryKey: getGetCcDuesQueryKey() },
  });

  const { data: categoryTrend, isLoading: isLoadingCatTrend } = useGetCategoryTrend(
    { month: currentMonth },
    { query: { enabled: true, queryKey: getGetCategoryTrendQueryKey({ month: currentMonth }) } }
  );

  const { data: goals } = useListGoals();
  const { data: waterfall } = useGetGoalsWaterfall();
  const { data: allAccounts } = useListAccounts();
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

  const pieData = (spendByCategory ?? []).map((item, i) => ({
    name: item.category,
    value: Number(item.total),
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const pieTotal = pieData.reduce((sum, d) => sum + d.value, 0);

  const categoryNames = useMemo(() => (categoryTrend ?? []).map((c) => c.category), [categoryTrend]);

  const categoryTrendLineData = useMemo((): Record<string, string | number>[] => {
    if (!categoryTrend || categoryTrend.length === 0) return [];
    const filtered = selectedCategory === "all"
      ? categoryTrend
      : categoryTrend.filter((c) => c.category === selectedCategory);

    const cycleMap = new Map<string, Record<string, string | number>>();
    for (const cat of filtered) {
      for (const pt of cat.data) {
        if (!cycleMap.has(pt.cycle)) {
          cycleMap.set(pt.cycle, { cycle: pt.cycle });
        }
        const row = cycleMap.get(pt.cycle)!;
        row[cat.category] = Number(pt.total || 0);
      }
    }
    return Array.from(cycleMap.values());
  }, [categoryTrend, selectedCategory]);

  const visibleCategories = selectedCategory === "all" ? categoryNames : [selectedCategory];

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

  const liquidCash = Number(summary?.bankBalance || 0);
  const monthlyExpenses = Number(summary?.plannedExpenses || 1);
  const liquidityRatio = monthlyExpenses > 0 ? liquidCash / monthlyExpenses : 1;
  const liquidityHealthy = liquidityRatio >= 1;

  const { totalBank, totalCcOutstanding, totalLoanOutstanding, netWorth } = useMemo(() => {
    const accounts = allAccounts ?? [];
    const tBank = accounts.filter(a => a.type === "bank").reduce((s, a) => s + Number(a.currentBalance ?? 0), 0);
    const tCc = accounts.filter(a => a.type === "credit_card").reduce((s, a) => s + Math.abs(Number(a.currentBalance ?? 0)), 0);
    const tLoan = accounts.filter(a => a.type === "loan").reduce((s, a) => s + Math.abs(Number(a.currentBalance ?? 0)), 0);
    return { totalBank: tBank, totalCcOutstanding: tCc, totalLoanOutstanding: tLoan, netWorth: tBank - tCc - tLoan };
  }, [allAccounts]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Financial Cockpit</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="font-mono text-xs uppercase tracking-wider" onClick={() => setIsTransferOpen(true)}>
            <ArrowLeftRight className="w-4 h-4 mr-1.5" /> Transfer
          </Button>
          {cycleAlreadyEnded ? (
            <>
              <Button size="sm" variant="outline" className="font-mono text-xs uppercase tracking-wider opacity-60" disabled>
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Cycle Ended
              </Button>
              {canUndo && (
                <Button size="sm" variant="outline" className="font-mono text-xs uppercase tracking-wider text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={() => setUndoConfirmOpen(true)}>
                  <Undo2 className="w-4 h-4 mr-1.5" /> Undo Distribution
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" variant="outline" className="font-mono text-xs uppercase tracking-wider" onClick={handleEndCycle}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> End Cycle
            </Button>
          )}
          <div className="text-sm font-mono text-muted-foreground bg-secondary/50 px-3 py-1 rounded-md border border-border/50">
            {new Date(currentMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card rounded-xl shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">Net Liquidity</CardTitle>
            <Activity className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-12 w-48" />
            ) : (
              <>
                <div className="text-4xl font-extrabold font-mono tracking-tight text-foreground">
                  {formatCurrency(summary?.netLiquidity || 0)}
                </div>
                <div className={`flex items-center gap-1.5 mt-2 text-sm font-mono ${liquidityHealthy ? "text-emerald-400" : "text-amber-400"}`}>
                  <Droplets className="w-3.5 h-3.5" />
                  Covers {liquidityRatio.toFixed(1)}x monthly expenses
                </div>
              </>
            )}
            <div className="flex flex-wrap gap-4 mt-3 text-sm font-mono text-muted-foreground">
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
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-xl shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Net Worth
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!allAccounts ? (
              <Skeleton className="h-10 w-40" />
            ) : (
              <div className={`text-4xl font-bold font-mono tracking-tight ${netWorth >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {formatCurrency(netWorth)}
              </div>
            )}
            <div className="flex flex-wrap gap-4 mt-2 text-sm font-mono text-muted-foreground">
              <span>Banks: {formatCurrency(totalBank)}</span>
              <span>CC: -{formatCurrency(totalCcOutstanding)}</span>
              {totalLoanOutstanding > 0 && <span>Loans: -{formatCurrency(totalLoanOutstanding)}</span>}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-xl shadow-lg">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" /> Goal Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[180px]">
            {goals && goals.length > 0 ? (
              <GoalProgressRing goals={goals} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
                No active goals
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card rounded-xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Monthly Flow</CardTitle>
          <CardDescription>Income → Expenses → Surplus → Goals</CardDescription>
        </CardHeader>
        <CardContent className="h-[220px] w-full pt-2">
          {isLoadingSummary ? (
            <Skeleton className="w-full h-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfallData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "var(--font-mono)" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "var(--font-mono)" }} tickFormatter={(value) => `₹${value / 1000}k`} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {waterfallData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        <Card className="glass-card rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">Monthly Burn Rate</CardTitle>
            <CardDescription>Actual vs Planned Expenses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingSummary ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : (
              <>
                <div className="flex justify-between items-end mb-2">
                  <div className="font-mono text-2xl font-bold">{summary?.burnRate ? summary.burnRate.toFixed(1) : 0}%</div>
                  <div className="text-sm font-mono text-muted-foreground">
                    {formatCurrency(summary?.actualExpenses || 0)} / {formatCurrency(summary?.plannedExpenses || 1)}
                  </div>
                </div>
                <Progress
                  value={Math.min(summary?.burnRate || 0, 100)}
                  className="h-3 bg-secondary"
                  indicatorClassName={(summary?.burnRate || 0) > 100 ? "bg-destructive" : "bg-primary"}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 glass-card rounded-xl">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-lg">Spend by Category</CardTitle>
                <CardDescription>Expense breakdown for this billing cycle</CardDescription>
              </div>
              <div className="flex rounded-lg border border-border/50 overflow-hidden">
                {([["all", "All"], ["cc", "CC"], ["non_cc", "Non-CC"]] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setSpendAccountFilter(value)}
                    className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
                      spendAccountFilter === value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoadingCatSpend ? (
              <Skeleton className="w-full h-[280px]" />
            ) : pieData.length > 0 ? (
              <div className="flex flex-col md:flex-row gap-4 items-start">
                <div className="w-full md:w-[220px] h-[220px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={95}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={TOOLTIP_LABEL_STYLE}
                        itemStyle={TOOLTIP_ITEM_STYLE}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 w-full overflow-auto max-h-[280px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground text-xs font-mono uppercase tracking-wider border-b border-border/50">
                        <th className="text-left py-2 pr-2">Category</th>
                        <th className="text-right py-2 px-2">Amount</th>
                        <th className="text-right py-2 pl-2">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pieData.map((entry, i) => {
                        const Icon = getCategoryIcon(entry.name);
                        const pct = pieTotal > 0 ? ((entry.value / pieTotal) * 100).toFixed(1) : "0.0";
                        return (
                          <tr key={i} className="border-b border-border/30 last:border-0">
                            <td className="py-2 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.fill }} />
                                <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">{entry.name}</span>
                              </div>
                            </td>
                            <td className="text-right py-2 px-2 font-mono text-xs whitespace-nowrap">
                              {formatCurrency(entry.value)}
                            </td>
                            <td className="text-right py-2 pl-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                              {pct}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border/50">
                        <td className="py-2 pr-2 font-medium">Total</td>
                        <td className="text-right py-2 px-2 font-mono text-xs font-bold whitespace-nowrap">
                          {formatCurrency(pieTotal)}
                        </td>
                        <td className="text-right py-2 pl-2 font-mono text-xs text-muted-foreground">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              <div className="w-full h-[220px] flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-border/50">
                No expense data for this cycle
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-destructive" /> CC Outstanding
            </CardTitle>
            <CardDescription>Credit card balances</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCcDues ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : ccDues && ccDues.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {ccDues.map((cc) => (
                    <div key={cc.id} className="p-3 rounded-md bg-secondary/30 border border-border/50">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium">
                            {cc.name}
                            {cc.sharedLimitGroup && (
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">{cc.sharedLimitGroup}</span>
                            )}
                          </p>
                          <p className="text-lg font-bold font-mono mt-0.5">
                            {formatCurrency(cc.outstanding)}
                          </p>
                          {cc.remainingLimit != null && (
                            <p className={`text-xs font-mono mt-0.5 ${
                              cc.creditLimit ? (
                                Number(cc.remainingLimit) / Number(cc.creditLimit) > 0.5 ? "text-emerald-500" :
                                Number(cc.remainingLimit) / Number(cc.creditLimit) > 0.2 ? "text-yellow-500" :
                                "text-destructive"
                              ) : "text-muted-foreground"
                            }`}>
                              Available: {formatCurrency(cc.remainingLimit)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-border/50 p-6 text-center">
                No credit cards
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(loanAccounts.length > 0 || Number(summary?.totalLoanOutstanding || 0) > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="glass-card rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Landmark className="w-4 h-4 text-amber-500" /> Loan Outstanding
              </CardTitle>
              <CardDescription>Total loan principal remaining</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-amber-500">
                {formatCurrency(summary?.totalLoanOutstanding || 0)}
              </div>
              {Number(summary?.totalEmiDue || 0) > 0 && (
                <p className="text-sm font-mono text-muted-foreground mt-2">
                  Monthly EMI burden: {formatCurrency(summary?.totalEmiDue || 0)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Landmark className="w-4 h-4 text-amber-500" /> Upcoming EMI Dues
              </CardTitle>
              <CardDescription>Active loan EMI schedule</CardDescription>
            </CardHeader>
            <CardContent>
              {loanAccounts.length > 0 ? (
                <div className="space-y-3">
                  {loanAccounts.map((loan) => (
                    <div key={loan.id} className="p-3 rounded-md bg-secondary/30 border border-border/50">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium">{loan.name}</p>
                          <p className="text-lg font-bold font-mono mt-0.5">
                            {loan.emiAmount ? formatCurrency(loan.emiAmount) : "—"}/mo
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {loan.emiDay && (
                            <span className="text-xs font-mono px-2 py-1 rounded bg-amber-500/15 text-amber-400">
                              {loan.emiDay}th
                            </span>
                          )}
                          {loan.interestRate && (
                            <span className="text-xs font-mono text-muted-foreground">@ {loan.interestRate}%</span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        Outstanding: {formatCurrency(loan.currentBalance)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-border/50 p-6 text-center">
                  No active loans
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="glass-card rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg">Category Trend</CardTitle>
              <CardDescription>Expense trends over last 6 billing cycles</CardDescription>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px] h-8 text-xs font-mono">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoryNames.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="h-[320px] w-full pt-4">
          {isLoadingCatTrend ? (
            <Skeleton className="w-full h-full" />
          ) : categoryTrendLineData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={categoryTrendLineData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <defs>
                  {visibleCategories.map((cat, i) => {
                    const color = CHART_COLORS[categoryNames.indexOf(cat) % CHART_COLORS.length];
                    return (
                      <linearGradient key={cat} id={`grad-cat-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="cycle" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }} angle={-20} textAnchor="end" height={50} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "var(--font-mono)" }} tickFormatter={(value) => `₹${value / 1000}k`} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(value: number) => formatCurrency(value)} />
                <Legend wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: "11px", paddingTop: "10px" }} />
                {visibleCategories.map((cat, i) => (
                  <Area
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    name={cat}
                    stroke={CHART_COLORS[categoryNames.indexOf(cat) % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    fillOpacity={1}
                    fill={`url(#grad-cat-${i})`}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-border/50">
              No category trend data available
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 glass-card rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">Income vs Expenses Trend</CardTitle>
            <CardDescription>Last 6 billing cycles (25th-24th)</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] w-full pt-4">
            {isLoadingTrend ? (
              <Skeleton className="w-full h-full" />
            ) : monthlyTrend && monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(160 84% 39%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(354 70% 54%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(354 70% 54%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "var(--font-mono)" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "var(--font-mono)" }} tickFormatter={(value) => `₹${value / 1000}k`} />
                  <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(value: number) => formatCurrency(value)} />
                  <Legend wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: "12px", paddingTop: "10px" }} />
                  <Area type="monotone" dataKey="income" name="Income" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} fillOpacity={1} fill="url(#gradIncome)" />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} fillOpacity={1} fill="url(#gradExpenses)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-border/50">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card rounded-xl flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Recent Ledger</CardTitle>
            <Link href="/transactions" className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="flex-1">
            {isLoadingTxs ? (
              <div className="space-y-4 pt-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentTxs && recentTxs.length > 0 ? (
              <div className="space-y-3 pt-2">
                {recentTxs.map((tx) => {
                  const Icon = getCategoryIcon(tx.category);
                  return (
                    <div key={tx.id} className="flex justify-between items-center pb-3 border-b border-border/40 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          tx.type === "Income" ? "bg-emerald-500/10" : "bg-rose-500/10"
                        }`}>
                          <Icon className={`w-4 h-4 ${tx.type === "Income" ? "text-emerald-400" : "text-rose-400"}`} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium line-clamp-1">{tx.description}</span>
                          <div className="flex gap-2 text-xs text-muted-foreground font-mono">
                            <span>{formatDate(tx.date)}</span>
                            <span>&bull;</span>
                            <span className="truncate max-w-[80px]">{tx.category}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`font-mono text-sm font-bold ${tx.type === "Income" ? "text-emerald-500" : "text-foreground"}`}>
                        {tx.type === "Income" ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-border/50 p-6 text-center">
                No recent transactions
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg">CC Spend Trend</CardTitle>
          <CardDescription>Credit card spending per billing cycle</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px] w-full pt-4">
          {isLoadingCcSpend ? (
            <Skeleton className="w-full h-full" />
          ) : ccSpendTrend && ccSpendTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ccSpendTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradCcSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(43 100% 60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(43 100% 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="cycle" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }} angle={-20} textAnchor="end" height={50} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "var(--font-mono)" }} tickFormatter={(value) => `₹${value / 1000}k`} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(value: number) => formatCurrency(value)} />
                <Area type="monotone" dataKey="total" name="CC Spend" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} fillOpacity={1} fill="url(#gradCcSpend)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-border/50">
              No CC spending data available
            </div>
          )}
        </CardContent>
      </Card>

      <TransferModal open={isTransferOpen} onOpenChange={setIsTransferOpen} />

      <Dialog open={distributeOpen} onOpenChange={setDistributeOpen}>
        <DialogContent className="sm:max-w-lg">
          <SurplusDistributeModal
            goals={activeGoals}
            accounts={(allAccounts || []).filter(a => a.type === "bank")}
            month={currentMonth}
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
                      queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
                      queryClient.invalidateQueries({ queryKey: getGetGoalsWaterfallQueryKey() });
                      queryClient.invalidateQueries({ queryKey: getListSurplusAllocationsQueryKey() });
                      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({ month: currentMonth }) });
                      queryClient.invalidateQueries({ queryKey: getCanUndoSurplusQueryKey({ month: currentMonth }) });
                      queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
                      queryClient.invalidateQueries({ queryKey: getGetMonthlySurplusQueryKey() });
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
        </DialogContent>
      </Dialog>

      <Dialog open={undoConfirmOpen} onOpenChange={setUndoConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Undo Last Distribution</DialogTitle>
            <DialogDescription>
              This will reverse the surplus distribution for {new Date(currentMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}. The following changes will be reverted:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {canUndoData?.allocations && canUndoData.allocations.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Goal Allocations to Remove</div>
                {canUndoData.allocations.map((a, i) => (
                  <div key={i} className="flex justify-between items-center p-2 rounded-md bg-secondary/30 text-sm font-mono">
                    <span>{a.goalName}</span>
                    <span className="text-destructive">-{formatCurrency(a.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {(canUndoData?.transferCount ?? 0) > 0 && (
              <div className="text-xs font-mono p-2 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
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
                        queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
                        queryClient.invalidateQueries({ queryKey: getGetGoalsWaterfallQueryKey() });
                        queryClient.invalidateQueries({ queryKey: getListSurplusAllocationsQueryKey() });
                        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({ month: currentMonth }) });
                        queryClient.invalidateQueries({ queryKey: getCanUndoSurplusQueryKey({ month: currentMonth }) });
                        queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
                        queryClient.invalidateQueries({ queryKey: getGetMonthlySurplusQueryKey() });
                      }
                    },
                    onError: (err) => {
                      toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" });
                    },
                  }
                );
              }}
            >
              {undoSurplus.isPending ? "Undoing..." : "Confirm Undo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
