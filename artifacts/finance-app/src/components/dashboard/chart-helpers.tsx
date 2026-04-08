import React from "react";
import { formatCurrency } from "@/lib/constants";
import { SensitiveValue } from "@/components/sensitive-value";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const CHART_COLORS = [
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

export function GoalProgressRing({ goals }: { goals: Array<{ targetAmount: string | number; currentAmount: string | number }> }) {
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

export function WaterfallConnectors(props: CustomizedChartProps) {
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

export function formatDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export function niceYAxisTicks(maxVal: number): number[] {
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

export function formatAxisValue(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(value % 100000 === 0 ? 0 : 1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `₹${value}`;
}

export function computeCategoryTrendData(
  categoryTrend: Array<{ category: string; data: Array<{ cycle: string; total: string | number }> }> | undefined,
  selectedCategory: string,
): { top5Categories: string[]; categoryTrendLineData: Record<string, string | number>[]; visibleCategories: string[] } {
  if (!categoryTrend || categoryTrend.length === 0) {
    return { top5Categories: [], categoryTrendLineData: [], visibleCategories: [] };
  }

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
}

export function DashboardModal({ open, onOpenChange, title, isMobile, children }: {
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
