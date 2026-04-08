import { useCallback } from "react";
import { formatCurrency } from "@/lib/constants";
import { SensitiveValue } from "@/components/sensitive-value";
import { usePrivacy } from "@/lib/privacy-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/query-error-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useChartTheme } from "@/lib/chart-theme";
import { CHART_COLORS, niceYAxisTicks, formatAxisValue } from "./chart-helpers";

interface CategoryTrendProps {
  categoryTrendLineData: Record<string, string | number>[];
  visibleCategories: string[];
  allCategoryNames: string[];
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  catTrendYMax: number;
  isLoadingCatTrend: boolean;
  isErrorCatTrend: boolean;
  refetchCatTrend: () => void;
}

export function CategoryTrendChart({
  categoryTrendLineData, visibleCategories, allCategoryNames,
  selectedCategory, setSelectedCategory,
  catTrendYMax,
  isLoadingCatTrend, isErrorCatTrend, refetchCatTrend,
}: CategoryTrendProps) {
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
              setSelectedCategory(selectedCategory === entry.value ? "all" : entry.value);
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
        ) : isErrorCatTrend ? (
          <QueryErrorState onRetry={() => refetchCatTrend()} message="Failed to load category trends" />
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
  );
}

interface CcSpendTrendProps {
  ccSpendTrend: Array<{ cycle: string; total: string | number }> | undefined;
  isLoadingCcSpend: boolean;
  isErrorCcSpend: boolean;
  refetchCcSpend: () => void;
}

export function CcSpendTrendChart({ ccSpendTrend, isLoadingCcSpend, isErrorCcSpend, refetchCcSpend }: CcSpendTrendProps) {
  const chartTheme = useChartTheme();
  const { isHidden: privacyHidden } = usePrivacy();
  const privacyTooltipFormatter = (value: number) => formatCurrency(value);

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

  return (
    <Card className="glass-card rounded-xl">
      <CardHeader>
        <CardTitle className="text-lg">CC Spend Trend</CardTitle>
        <CardDescription>Credit card spending per cycle</CardDescription>
      </CardHeader>
      <CardContent className="h-[280px] w-full pt-4">
        {isLoadingCcSpend ? (
          <Skeleton className="w-full h-full" />
        ) : isErrorCcSpend ? (
          <QueryErrorState onRetry={() => refetchCcSpend()} message="Failed to load CC spend trend" />
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
  );
}
