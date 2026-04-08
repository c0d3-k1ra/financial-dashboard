import { formatCurrency } from "@/lib/constants";
import { getCategoryIcon } from "@/lib/category-icons";
import { SensitiveValue } from "@/components/sensitive-value";
import { usePrivacy } from "@/lib/privacy-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/query-error-state";
import { CreditCard } from "lucide-react";
import { ChevronDown } from "lucide-react";
import {
  PieChart, Pie, Cell,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import { useChartTheme } from "@/lib/chart-theme";

interface SpendByCategoryProps {
  pieData: Array<{ name: string; value: number; fill: string }>;
  pieTotal: number;
  isLoadingCatSpend: boolean;
  isErrorCatSpend: boolean;
  refetchCatSpend: () => void;
  spendAccountFilter: "all" | "cc" | "non_cc";
  setSpendAccountFilter: (v: "all" | "cc" | "non_cc") => void;
  ccDues: Array<{
    id: number;
    name: string;
    outstanding: string | number;
    sharedLimitGroup?: string | null;
    creditLimit?: string | number | null;
    remainingLimit?: string | number | null;
  }> | undefined;
  isLoadingCcDues: boolean;
  isErrorCcDues: boolean;
  refetchCcDues: () => void;
}

export function SpendByCategorySection({
  pieData, pieTotal,
  isLoadingCatSpend, isErrorCatSpend, refetchCatSpend,
  spendAccountFilter, setSpendAccountFilter,
  ccDues, isLoadingCcDues, isErrorCcDues, refetchCcDues,
}: SpendByCategoryProps) {
  const chartTheme = useChartTheme();
  const { isHidden: privacyHidden } = usePrivacy();
  const privacyTooltipFormatter = (value: number) => formatCurrency(value);

  return (
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
          ) : isErrorCatSpend ? (
            <QueryErrorState onRetry={() => refetchCatSpend()} message="Failed to load spending data" />
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
          ) : isErrorCcDues ? (
            <QueryErrorState onRetry={() => refetchCcDues()} message="Failed to load CC dues" />
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
  );
}
