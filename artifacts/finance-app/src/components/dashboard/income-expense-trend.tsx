import { useCallback } from "react";
import { formatCurrency } from "@/lib/constants";
import { usePrivacy } from "@/lib/privacy-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/query-error-state";
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  ReferenceLine,
} from "recharts";
import { useChartTheme } from "@/lib/chart-theme";
import { niceYAxisTicks, formatAxisValue } from "./chart-helpers";

interface IncomeExpenseTrendProps {
  monthlyTrend: Array<{ month: string; income: string | number; expenses: string | number }> | undefined;
  crossoverMonths: string[];
  incExpYMax: number;
  isLoadingTrend: boolean;
  isErrorTrend: boolean;
  refetchTrend: () => void;
}

export function IncomeExpenseTrend({
  monthlyTrend, crossoverMonths, incExpYMax,
  isLoadingTrend, isErrorTrend, refetchTrend,
}: IncomeExpenseTrendProps) {
  const chartTheme = useChartTheme();
  const { isHidden: privacyHidden } = usePrivacy();
  const privacyTooltipFormatter = (value: number) => formatCurrency(value);

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

  return (
    <Card className="lg:col-span-2 glass-card rounded-xl">
      <CardHeader>
        <CardTitle className="text-lg">Income vs Expenses Trend</CardTitle>
        <CardDescription>Last 6 billing cycles (25th-24th)</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] w-full pt-4">
        {isLoadingTrend ? (
          <Skeleton className="w-full h-full" />
        ) : isErrorTrend ? (
          <QueryErrorState onRetry={() => refetchTrend()} message="Failed to load income/expense trend" />
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
  );
}
