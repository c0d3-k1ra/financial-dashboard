import { useState } from "react";
import { 
  useGetDashboardSummary, 
  getGetDashboardSummaryQueryKey,
  useGetRecentTransactions,
  getGetRecentTransactionsQueryKey,
  useGetMonthlyTrend,
  getGetMonthlyTrendQueryKey
} from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownRight, ArrowUpRight, Wallet, CreditCard, Activity, ArrowRight } from "lucide-react";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { Link } from "wouter";

export default function Dashboard() {
  const [currentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary(
    { month: currentMonth },
    { query: { enabled: true, queryKey: getGetDashboardSummaryQueryKey({ month: currentMonth }) } }
  );

  const { data: recentTxs, isLoading: isLoadingTxs } = useGetRecentTransactions(
    { limit: 5 },
    { query: { enabled: true, queryKey: getGetRecentTransactionsQueryKey({ limit: 5 }) } }
  );

  const { data: monthlyTrend, isLoading: isLoadingTrend } = useGetMonthlyTrend(
    { query: { enabled: true, queryKey: getGetMonthlyTrendQueryKey() } }
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Financial Cockpit</h1>
        <div className="text-sm font-mono text-muted-foreground bg-secondary/50 px-3 py-1 rounded-md border border-border/50">
          {currentMonth}
        </div>
      </div>

      {/* Top row cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/50 backdrop-blur border-border/60 shadow-sm hover:border-border transition-colors">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">Net Liquidity</CardTitle>
            <Activity className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-3xl font-bold font-mono tracking-tight text-foreground">
                {formatCurrency(summary?.netLiquidity || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              Bank Balance - CC Dues
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/60 shadow-sm hover:border-border transition-colors">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">Bank Balance</CardTitle>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-3xl font-bold font-mono tracking-tight text-emerald-500">
                {formatCurrency(summary?.bankBalance || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              Available Cash
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/60 shadow-sm hover:border-border transition-colors">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">Unpaid CC Dues</CardTitle>
            <CreditCard className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-3xl font-bold font-mono tracking-tight text-destructive">
                {formatCurrency(summary?.unpaidCcDues || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              Pending Liabilities
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Middle row: Burn Rate & Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card/50 backdrop-blur border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Monthly Burn Rate</CardTitle>
            <CardDescription>Actual vs Planned Living Expenses</CardDescription>
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
                  <div className="font-mono text-2xl font-bold">
                    {summary?.burnRate ? summary.burnRate.toFixed(1) : 0}%
                  </div>
                  <div className="text-sm font-mono text-muted-foreground">
                    {formatCurrency(summary?.actualLivingExpenses || 0)} / {formatCurrency(summary?.plannedLivingExpenses || 1)}
                  </div>
                </div>
                <Progress 
                  value={Math.min(summary?.burnRate || 0, 100)} 
                  className="h-3 bg-secondary" 
                  indicatorClassName={
                    (summary?.burnRate || 0) > 100 ? "bg-destructive" : "bg-primary"
                  }
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Monthly Overview</CardTitle>
            <CardDescription>Income & Surplus</CardDescription>
          </CardHeader>
          <CardContent>
             {isLoadingSummary ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center p-3 rounded-md bg-secondary/30 border border-border/50">
                  <div className="flex items-center gap-2">
                    <ArrowDownRight className="w-4 h-4 text-emerald-500" />
                    <span className="font-mono text-sm text-muted-foreground uppercase">Total Income</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-500">{formatCurrency(summary?.totalIncome || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-md bg-secondary/30 border border-border/50">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-primary" />
                    <span className="font-mono text-sm text-muted-foreground uppercase">Est. Surplus</span>
                  </div>
                  <span className="font-mono font-bold text-primary">{formatCurrency(summary?.monthlySurplus || 0)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Chart & Recent Txs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Chart */}
        <Card className="lg:col-span-2 bg-card/50 backdrop-blur border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Income vs Expenses Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] w-full pt-4">
            {isLoadingTrend ? (
              <Skeleton className="w-full h-full" />
            ) : monthlyTrend && monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "var(--font-mono)" }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "var(--font-mono)" }}
                    tickFormatter={(value) => `\u20B9${value/1000}k`}
                  />
                  <RechartsTooltip 
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontFamily: "var(--font-mono)", fontSize: "12px" }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: "12px", paddingTop: "10px" }} />
                  <Bar dataKey="income" name="Income" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-border/50">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Txs */}
        <Card className="bg-card/50 backdrop-blur border-border/60 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Recent Ledger</CardTitle>
            <Link href="/transactions" className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="flex-1">
            {isLoadingTxs ? (
              <div className="space-y-4 pt-2">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentTxs && recentTxs.length > 0 ? (
              <div className="space-y-3 pt-2">
                {recentTxs.map(tx => (
                  <div key={tx.id} className="flex justify-between items-center pb-3 border-b border-border/40 last:border-0 last:pb-0">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium line-clamp-1">{tx.description}</span>
                      <div className="flex gap-2 text-xs text-muted-foreground font-mono">
                        <span>{formatDate(tx.date)}</span>
                        <span>•</span>
                        <span className="truncate max-w-[100px]">{tx.category}</span>
                      </div>
                    </div>
                    <span className={`font-mono text-sm font-bold ${tx.type === 'Income' ? 'text-emerald-500' : 'text-foreground'}`}>
                      {tx.type === 'Income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
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
    </div>
  );
}
