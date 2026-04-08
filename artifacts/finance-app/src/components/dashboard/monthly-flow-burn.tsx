import { useCallback } from "react";
import { formatCurrency } from "@/lib/constants";
import { SensitiveValue } from "@/components/sensitive-value";
import { usePrivacy } from "@/lib/privacy-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/query-error-state";
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  Customized,
} from "recharts";
import { useChartTheme } from "@/lib/chart-theme";
import { WaterfallConnectors, formatAxisValue } from "./chart-helpers";

interface MonthlyFlowProps {
  waterfallData: Array<{ name: string; value: number; fill: string }>;
  isLoadingSummary: boolean;
  isErrorSummary: boolean;
  refetchSummary: () => void;
}

export function MonthlyFlowChart({ waterfallData, isLoadingSummary, isErrorSummary, refetchSummary }: MonthlyFlowProps) {
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
    <Card className="glass-card rounded-xl shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg">Monthly Flow</CardTitle>
        <CardDescription>Income → Expenses → Surplus → Goals</CardDescription>
      </CardHeader>
      <CardContent className="h-[220px] w-full pt-2">
        {isLoadingSummary ? (
          <Skeleton className="w-full h-full" />
        ) : isErrorSummary ? (
          <QueryErrorState onRetry={() => refetchSummary()} message="Failed to load summary" />
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
  );
}

interface BurnRateProps {
  summary: {
    burnRate?: number;
    actualExpenses?: string | number;
    plannedExpenses?: string | number;
  } | undefined;
  isLoadingSummary: boolean;
  isErrorSummary: boolean;
  refetchSummary: () => void;
}

export function BurnRateCard({ summary, isLoadingSummary, isErrorSummary, refetchSummary }: BurnRateProps) {
  return (
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
          ) : isErrorSummary ? (
            <QueryErrorState onRetry={() => refetchSummary()} message="Failed to load summary" />
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
  );
}
