import { useState, useMemo, useCallback } from "react";
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
import { formatCurrency, formatDate } from "@/lib/constants";
import { getCategoryIcon } from "@/lib/category-icons";
import { SensitiveValue } from "@/components/sensitive-value";
import { usePrivacy } from "@/lib/privacy-context";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowDownRight, ArrowUpRight, Wallet, CreditCard, Activity, ArrowRight, Droplets, Target, Landmark, Plus, ArrowLeftRight, CheckCircle2, Undo2, TrendingUp, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TransferModal from "@/components/transfer-modal";
import SurplusDistributeModal from "@/components/surplus-distribute-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/constants";
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  Customized, ReferenceLine,
} from "recharts";
import { Link, useLocation } from "wouter";
import { useChartTheme } from "@/lib/chart-theme";

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
          <span className="text-2xl font-bold tabular-nums">{progress.toFixed(0)}%</span>
          <span className="text-[10px] text-muted-foreground font-mono">GOALS</span>
        </div>
      </div>
      <SensitiveValue as="div" className="text-xs text-muted-foreground tabular-nums mt-2">
        {formatCurrency(totalCurrent)} / {formatCurrency(totalTarget)}
      </SensitiveValue>
    </div>
  );
}

interface BarRectData {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CustomizedChartProps {
  formattedGraphicalItems?: Array<{
    props?: { data?: BarRectData[] };
  }>;
}

function WaterfallConnectors(props: CustomizedChartProps) {
  const { formattedGraphicalItems } = props;
  if (!formattedGraphicalItems || formattedGraphicalItems.length === 0) return null;
  const firstSeries = formattedGraphicalItems[0];
  if (!firstSeries?.props?.data) return null;
  const bars = firstSeries.props.data;
  return (
    <g>
      {bars.slice(0, -1).map((bar: BarRectData, i: number) => {
        const next = bars[i + 1];
        if (!bar || !next) return null;
        return (
          <line
            key={i}
            x1={bar.x + bar.width + 2}
            y1={bar.y}
            x2={next.x - 2}
            y2={bar.y}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            opacity={0.35}
          />
        );
      })}
    </g>
  );
}

function formatDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

function niceYAxisTicks(maxVal: number): number[] {
  if (maxVal <= 0) return [0];
  const raw = maxVal / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const nice = [1, 2, 2.5, 5, 10].find(n => n * mag >= raw) ?? 10;
  const step = nice * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= maxVal + step * 0.5; v += step) {
    ticks.push(v);
  }
  return ticks;
}

function formatAxisValue(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(value % 100000 === 0 ? 0 : 1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `₹${value}`;
}


export default function Dashboard() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const chartTheme = useChartTheme();
  const isMobile = useIsMobile();
  const { isHidden: privacyHidden } = usePrivacy();

  const PrivacyYAxisTick = useCallback(({ x, y, payload }: { x: number; y: number; payload: { value: number } }) => (
    <text
      x={x}
      y={y}
      textAnchor="end"
      fill={chartTheme.tickFill}
      fontSize={12}
      fontFamily="var(--font-mono)"
      style={privacyHidden ? { filter: "blur(8px)", userSelect: "none" } : undefined}
    >
      {formatAxisValue(payload.value)}
    </text>
  ), [privacyHidden, chartTheme.tickFill]);

  const PrivacyYAxisTick11 = useCallback(({ x, y, payload }: { x: number; y: number; payload: { value: number } }) => (
    <text
      x={x}
      y={y}
      textAnchor="end"
      fill={chartTheme.tickFill}
      fontSize={11}
      fontFamily="var(--font-mono)"
      style={privacyHidden ? { filter: "blur(8px)", userSelect: "none" } : undefined}
    >
      {formatAxisValue(payload.value)}
    </text>
  ), [privacyHidden, chartTheme.tickFill]);

  const privacyTooltipFormatter = (value: number) => formatCurrency(value);
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

  const { top5Categories, categoryTrendLineData, visibleCategories } = useMemo(() => {
    if (!categoryTrend || categoryTrend.length === 0) return { top5Categories: [] as string[], categoryTrendLineData: [] as Record<string, string | number>[], visibleCategories: [] as string[] };

    if (selectedCategory !== "all") {
      const filtered = categoryTrend.filter((c) => c.category === selectedCategory);
      const cycleMap = new Map<string, Record<string, string | number>>();
      for (const cat of filtered) {
        for (const pt of cat.data) {
          if (!cycleMap.has(pt.cycle)) cycleMap.set(pt.cycle, { cycle: pt.cycle });
          cycleMap.get(pt.cycle)![cat.category] = Number(pt.total || 0);
        }
      }
      return {
        top5Categories: [selectedCategory],
        categoryTrendLineData: Array.from(cycleMap.values()),
        visibleCategories: [selectedCategory],
      };
    }

    const totals = categoryTrend.map(c => ({
      category: c.category,
      total: c.data.reduce((s, pt) => s + Number(pt.total || 0), 0),
      data: c.data,
    }));
    totals.sort((a, b) => b.total - a.total);

    const top5 = totals.slice(0, 5);
    const others = totals.slice(5);
    const cats = top5.map(t => t.category);
    if (others.length > 0) cats.push("Others");

    const cycleMap = new Map<string, Record<string, string | number>>();
    for (const cat of top5) {
      for (const pt of cat.data) {
        if (!cycleMap.has(pt.cycle)) cycleMap.set(pt.cycle, { cycle: pt.cycle });
        cycleMap.get(pt.cycle)![cat.category] = Number(pt.total || 0);
      }
    }
    if (others.length > 0) {
      for (const cat of others) {
        for (const pt of cat.data) {
          if (!cycleMap.has(pt.cycle)) cycleMap.set(pt.cycle, { cycle: pt.cycle });
          const row = cycleMap.get(pt.cycle)!;
          row["Others"] = (Number(row["Others"] || 0)) + Number(pt.total || 0);
        }
      }
    }

    return {
      top5Categories: cats,
      categoryTrendLineData: Array.from(cycleMap.values()),
      visibleCategories: cats,
    };
  }, [categoryTrend, selectedCategory]);

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

  interface LegendEntry {
    value: string;
    color: string;
  }

  const renderCategoryLegend = (props: { payload?: LegendEntry[] }) => {
    const { payload } = props;
    if (!payload) return null;
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-3 px-2">
        {payload.map((entry: LegendEntry, index: number) => (
          <button
            key={index}
            className={`flex items-center gap-1.5 text-[11px] transition-opacity hover:opacity-80 ${entry.value === "Others" ? "cursor-default" : "cursor-pointer"}`}
            onClick={() => {
              if (entry.value === "Others") return;
              setSelectedCategory(prev => prev === entry.value ? "all" : entry.value);
            }}
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span style={{
              color: selectedCategory !== "all" && selectedCategory !== entry.value ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))",
              opacity: selectedCategory !== "all" && selectedCategory !== entry.value ? 0.4 : 1,
            }}>
              {entry.value}
            </span>
          </button>
        ))}
      </div>
    );
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

      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="glass-card glass-animate-in glass-stagger-1 rounded-xl shadow-lg min-h-[200px] flex flex-col">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">Net Liquidity</CardTitle>
            <Activity className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            {isLoadingSummary ? (
              <Skeleton className="h-12 w-48" />
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
              </>
            )}
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
          </CardContent>
        </Card>

        <Card className="glass-card glass-animate-in glass-stagger-2 rounded-xl shadow-lg min-h-[200px] flex flex-col">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">Net Worth</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            {!allAccounts ? (
              <Skeleton className="h-10 w-40" />
            ) : (
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
            )}
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
          </CardContent>
        </Card>

        <Card className="glass-card glass-animate-in glass-stagger-3 rounded-xl shadow-lg min-h-[200px] flex flex-col">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">Goal Progress</CardTitle>
            <Target className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="flex-1">
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartTheme.tickFill, fontSize: 12, fontFamily: "var(--font-mono)" }} />
                <YAxis axisLine={false} tickLine={false} tick={PrivacyYAxisTick} />
                <RechartsTooltip contentStyle={{ ...chartTheme.tooltip, ...(privacyHidden ? { filter: "blur(8px)" } : {}) }} labelStyle={chartTheme.label} itemStyle={chartTheme.item} formatter={privacyTooltipFormatter} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {waterfallData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
                <Customized component={WaterfallConnectors} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      
      <div className="grid grid-cols-1 gap-6">
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
                  <SensitiveValue as="div" className="tabular-nums text-2xl font-bold">{summary?.burnRate ? summary.burnRate.toFixed(1) : 0}%</SensitiveValue>
                  <SensitiveValue as="div" className="text-sm tabular-nums text-muted-foreground">
                    {formatCurrency(summary?.actualExpenses || 0)} / {formatCurrency(summary?.plannedExpenses || 1)}
                  </SensitiveValue>
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

      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 glass-card rounded-xl">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-lg">Spend by Category</CardTitle>
                <CardDescription>Expense breakdown for this billing cycle</CardDescription>
              </div>
              <div className="flex rounded-lg border border-border/50 dark:border-[rgba(255,255,255,0.08)] overflow-hidden">
                {([["all", "All"], ["cc", "CC"], ["non_cc", "Non-CC"]] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setSpendAccountFilter(value)}
                    className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-all ${
                      spendAccountFilter === value
                        ? "bg-primary text-primary-foreground font-bold shadow-sm dark:filter-chip-active"
                        : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60 dark:filter-chip-inactive"
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
              <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 items-start">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={115}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ ...chartTheme.tooltip, ...(privacyHidden ? { filter: "blur(8px)" } : {}) }}
                        labelStyle={chartTheme.label}
                        itemStyle={chartTheme.item}
                        formatter={privacyTooltipFormatter}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 w-full relative">
                  <div
                    className="overflow-auto max-h-[280px] scrollbar-thin"
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10;
                      const indicator = el.parentElement?.querySelector('[data-scroll-hint]') as HTMLElement | null;
                      if (indicator) indicator.style.opacity = atBottom ? '0' : '1';
                    }}
                  >
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
                              <td className="text-right py-2 px-2 tabular-nums text-xs whitespace-nowrap">
                                <SensitiveValue>{formatCurrency(entry.value)}</SensitiveValue>
                              </td>
                              <td className="text-right py-2 pl-2 tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                                {pct}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border/50">
                          <td className="py-2 pr-2 font-medium">Total</td>
                          <td className="text-right py-2 px-2 tabular-nums text-xs font-bold whitespace-nowrap">
                            <SensitiveValue>{formatCurrency(pieTotal)}</SensitiveValue>
                          </td>
                          <td className="text-right py-2 pl-2 tabular-nums text-xs text-muted-foreground">100%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {pieData.length > 6 && (
                    <div data-scroll-hint className="flex justify-center pt-1.5 transition-opacity duration-300">
                      <ChevronDown className="w-4 h-4 text-muted-foreground animate-bounce" />
                    </div>
                  )}
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
              <div className="relative">
                <div
                  className="space-y-3 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin"
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10;
                    const indicator = el.parentElement?.querySelector('[data-scroll-hint]') as HTMLElement | null;
                    if (indicator) indicator.style.opacity = atBottom ? '0' : '1';
                  }}
                >
                  {ccDues.map((cc) => (
                      <div key={cc.id} className="p-3 rounded-md bg-secondary/30 border border-border/50">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium">
                              {cc.name}
                              {cc.sharedLimitGroup && (
                                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-medium status-badge-info">{cc.sharedLimitGroup}</span>
                              )}
                            </p>
                            <SensitiveValue as="div" className="text-lg font-bold tabular-nums mt-0.5">
                              {formatCurrency(cc.outstanding)}
                            </SensitiveValue>
                            {cc.remainingLimit != null && (
                              <SensitiveValue as="div" className={`text-xs tabular-nums mt-0.5 ${
                                cc.creditLimit ? (
                                  Number(cc.remainingLimit) / Number(cc.creditLimit) > 0.5 ? "text-emerald-500" :
                                  Number(cc.remainingLimit) / Number(cc.creditLimit) > 0.2 ? "text-yellow-500" :
                                  "text-destructive"
                                ) : "text-muted-foreground"
                              }`}>
                                Available: {formatCurrency(cc.remainingLimit)}
                              </SensitiveValue>
                            )}
                          </div>
                        </div>
                      </div>
                  ))}
                </div>
                {ccDues.length > 3 && (
                  <div data-scroll-hint className="flex justify-center pt-1.5 transition-opacity duration-300">
                    <ChevronDown className="w-4 h-4 text-muted-foreground animate-bounce" />
                  </div>
                )}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="glass-card rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Landmark className="w-4 h-4 text-amber-500" /> Loan Outstanding
              </CardTitle>
              <CardDescription>Total loan principal remaining</CardDescription>
            </CardHeader>
            <CardContent>
              <SensitiveValue as="div" className="text-3xl font-bold tabular-nums text-amber-500">
                {formatCurrency(summary?.totalLoanOutstanding || 0)}
              </SensitiveValue>
              {Number(summary?.totalEmiDue || 0) > 0 && (
                <SensitiveValue as="div" className="text-sm tabular-nums text-muted-foreground mt-2">
                  Monthly EMI burden: {formatCurrency(summary?.totalEmiDue || 0)}
                </SensitiveValue>
              )}
              {loanAccounts.length > 0 && (
                <div className="mt-4 space-y-3">
                  {loanAccounts.map((loan) => {
                    const balance = Number(loan.currentBalance ?? 0);
                    const emi = Number(loan.emiAmount ?? 0);
                    const originalAmount = loan.originalLoanAmount ? Number(loan.originalLoanAmount) : null;
                    const emisPaidCount = Number(loan.emisPaid ?? 0);
                    const tenure = loan.loanTenure ? Number(loan.loanTenure) : null;

                    const principalPaid = originalAmount ? originalAmount - balance : 0;
                    const paidPct = originalAmount && originalAmount > 0
                      ? Math.max(0, Math.min(100, (principalPaid / originalAmount) * 100))
                      : 0;

                    const interestPaidSoFar = emi && originalAmount
                      ? Math.max(0, (emi * emisPaidCount) - principalPaid)
                      : 0;

                    const emisRemaining = tenure ? tenure - emisPaidCount : null;

                    let estimatedPayoff: string | null = null;
                    if (loan.loanStartDate && tenure) {
                      const startDate = new Date(loan.loanStartDate);
                      startDate.setMonth(startDate.getMonth() + tenure);
                      estimatedPayoff = startDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                    } else if (emisRemaining && emisRemaining > 0) {
                      const payoffDate = new Date();
                      payoffDate.setMonth(payoffDate.getMonth() + emisRemaining);
                      estimatedPayoff = payoffDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                    }

                    return (
                      <div key={loan.id} className="p-3 rounded-md bg-secondary/30 border border-border/50">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-sm font-medium">{loan.name}</span>
                          <SensitiveValue className="text-xs tabular-nums text-muted-foreground">
                            {emi > 0 ? `${formatCurrency(emi)}/mo` : "—"}
                          </SensitiveValue>
                        </div>
                        {originalAmount && originalAmount > 0 && (
                          <>
                            <div className="flex items-center gap-2 mb-1.5">
                              <Progress
                                value={paidPct}
                                className="h-1.5 bg-secondary flex-1"
                                indicatorClassName="bg-amber-500"
                              />
                              <span className="text-[10px] tabular-nums text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">
                                {paidPct.toFixed(0)}% paid
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                              <span>Outstanding: {formatCurrency(balance)}</span>
                              <span>Principal Paid: {formatCurrency(principalPaid)}</span>
                              {interestPaidSoFar > 0 && (
                                <span>Interest Paid: {formatCurrency(interestPaidSoFar)}</span>
                              )}
                              {emisRemaining != null && (
                                <span>EMIs: {emisPaidCount}/{tenure}{emisRemaining > 0 ? ` (${emisRemaining} left)` : ""}</span>
                              )}
                            </div>
                            {estimatedPayoff && (
                              <div className="text-xs text-muted-foreground tabular-nums mt-0.5">
                                Payoff: {estimatedPayoff}
                              </div>
                            )}
                          </>
                        )}
                        {!originalAmount && emi > 0 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Set original loan amount for accurate tracking</p>
                        )}
                      </div>
                    );
                  })}
                </div>
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
                          <SensitiveValue as="div" className="text-lg font-bold tabular-nums mt-0.5">
                            {loan.emiAmount ? formatCurrency(loan.emiAmount) : "—"}/mo
                          </SensitiveValue>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {loan.emiDay && (
                            <span className="text-xs font-mono px-2 py-1 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              {loan.emiDay}th
                            </span>
                          )}
                          {loan.interestRate && (
                            <span className="text-xs tabular-nums text-muted-foreground">@ {loan.interestRate}%</span>
                          )}
                        </div>
                      </div>
                      <SensitiveValue as="div" className="text-xs text-muted-foreground tabular-nums mt-1">
                        Outstanding: {formatCurrency(loan.currentBalance)}
                      </SensitiveValue>
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

      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 glass-card rounded-xl">
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
                  {allCategoryNames.map((name) => (
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
                      const colorIdx = cat === "Others" ? CHART_COLORS.length - 1 : allCategoryNames.indexOf(cat);
                      const color = CHART_COLORS[colorIdx >= 0 ? colorIdx % CHART_COLORS.length : i % CHART_COLORS.length];
                      return (
                        <linearGradient key={cat} id={`grad-cat-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} />
                  <XAxis dataKey="cycle" axisLine={false} tickLine={false} tick={{ fill: chartTheme.tickFill, fontSize: 10, fontFamily: "var(--font-mono)" }} angle={-20} textAnchor="end" height={50} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={PrivacyYAxisTick}
                    ticks={niceYAxisTicks(catTrendYMax)}
                    domain={[0, "auto"]}
                    allowDecimals={false}
                  />
                  <RechartsTooltip contentStyle={{ ...chartTheme.tooltip, ...(privacyHidden ? { filter: "blur(8px)" } : {}) }} labelStyle={chartTheme.label} itemStyle={chartTheme.item} formatter={privacyTooltipFormatter} />
                  <Legend content={renderCategoryLegend} />
                  {visibleCategories.map((cat, i) => {
                    const colorIdx = cat === "Others" ? CHART_COLORS.length - 1 : allCategoryNames.indexOf(cat);
                    const color = CHART_COLORS[colorIdx >= 0 ? colorIdx % CHART_COLORS.length : i % CHART_COLORS.length];
                    return (
                      <Area
                        key={cat}
                        type="monotone"
                        dataKey={cat}
                        name={cat}
                        stroke={color}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        fillOpacity={1}
                        fill={`url(#grad-cat-${i})`}
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-border/50">
                No category trend data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">CC Spend Trend</CardTitle>
            <CardDescription>Credit card spending per cycle</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] w-full pt-4">
            {isLoadingCcSpend ? (
              <Skeleton className="w-full h-full" />
            ) : ccSpendTrend && ccSpendTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ccSpendTrend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradCcSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(43 100% 60%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(43 100% 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} />
                  <XAxis dataKey="cycle" axisLine={false} tickLine={false} tick={{ fill: chartTheme.tickFill, fontSize: 9, fontFamily: "var(--font-mono)" }} angle={-20} textAnchor="end" height={50} />
                  <YAxis axisLine={false} tickLine={false} tick={PrivacyYAxisTick11} />
                  <RechartsTooltip contentStyle={{ ...chartTheme.tooltip, ...(privacyHidden ? { filter: "blur(8px)" } : {}) }} labelStyle={chartTheme.label} itemStyle={chartTheme.item} formatter={privacyTooltipFormatter} />
                  <Area type="monotone" dataKey="total" name="CC Spend" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} fillOpacity={1} fill="url(#gradCcSpend)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-border/50">
                No CC spending data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: chartTheme.tickFill, fontSize: 12, fontFamily: "var(--font-mono)" }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={PrivacyYAxisTick}
                    ticks={niceYAxisTicks(incExpYMax)}
                    domain={[0, "auto"]}
                    allowDecimals={false}
                  />
                  <RechartsTooltip contentStyle={{ ...chartTheme.tooltip, ...(privacyHidden ? { filter: "blur(8px)" } : {}) }} labelStyle={chartTheme.label} itemStyle={chartTheme.item} formatter={privacyTooltipFormatter} />
                  <Legend wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: "12px", paddingTop: "10px" }} />
                  {crossoverMonths.map((month, i) => (
                    <ReferenceLine
                      key={`cross-${i}`}
                      x={month}
                      stroke="hsl(354 70% 54%)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                      label={{
                        value: "⚠",
                        position: "top",
                        fill: "hsl(354 70% 54%)",
                        fontSize: 14,
                      }}
                    />
                  ))}
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={(props: { cx: number; cy: number; index: number }) => {
                      const { cx, cy, index } = props;
                      return <circle key={`inc-dot-${index}`} cx={cx} cy={cy} r={4} fill="hsl(160 84% 39%)" stroke="none" />;
                    }}
                    activeDot={{ r: 6 }}
                    fillOpacity={1}
                    fill="url(#gradIncome)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={2}
                    dot={(props: { cx: number; cy: number; index: number; payload: Record<string, number> }) => {
                      const { cx, cy, payload, index } = props;
                      const isOver = Number(payload.expenses) > Number(payload.income);
                      if (isOver) {
                        return (
                          <g key={`exp-dot-${index}`}>
                            <circle cx={cx} cy={cy} r={8} fill="hsl(354 70% 54%)" opacity={0.2} />
                            <circle cx={cx} cy={cy} r={4} fill="hsl(354 70% 54%)" />
                          </g>
                        );
                      }
                      return <circle key={`exp-dot-${index}`} cx={cx} cy={cy} r={4} fill="hsl(354 70% 54%)" stroke="none" />;
                    }}
                    activeDot={{ r: 6 }}
                    fillOpacity={1}
                    fill="url(#gradExpenses)"
                  />
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
            ) : groupedTxs.length > 0 ? (
              <div className="pt-2 space-y-1">
                {groupedTxs.map((group) => (
                  <div key={group.date}>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground py-1.5 border-b border-border/30 mb-1.5">
                      {group.label}
                    </div>
                    {group.txs.map((tx) => {
                      const Icon = getCategoryIcon(tx.category);
                      return (
                        <div key={tx.id} className="flex justify-between items-center pb-2.5 mb-2.5 border-b border-border/20 last:border-0 last:pb-0 last:mb-0">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              tx.type === "Income" ? "bg-emerald-500/10" : "bg-rose-500/10"
                            }`}>
                              <Icon className={`w-4 h-4 ${tx.type === "Income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium line-clamp-1">{tx.description}</span>
                              <span className="text-xs text-muted-foreground font-mono truncate max-w-[100px]">{tx.category}</span>
                            </div>
                          </div>
                          <SensitiveValue className={`tabular-nums text-sm font-bold ${tx.type === "Income" ? "text-emerald-500" : "text-foreground"}`}>
                            {tx.type === "Income" ? "+" : "-"}
                            {formatCurrency(tx.amount)}
                          </SensitiveValue>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-border/50 p-6 text-center">
                No recent transactions
              </div>
            )}
          </CardContent>
        </Card>
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
            <Undo2 className="w-4 h-4 mr-1.5" /> Confirm Undo
          </Button>
        </DialogFooter>
      </DashboardModal>
    </div>
  );
}

function DashboardModal({ open, onOpenChange, title, isMobile, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  isMobile: boolean;
  children: React.ReactNode;
}) {
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
          {title && (
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
          )}
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}
