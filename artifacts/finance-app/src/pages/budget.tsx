import { useState, useMemo } from "react";
import { 
  useGetBudgetAnalysis, 
  getGetBudgetAnalysisQueryKey,
  useListBudgetGoals,
  getListBudgetGoalsQueryKey,
  useUpsertBudgetGoal
} from "@workspace/api-client-react";
import type { BudgetAnalysisRow } from "@workspace/api-client-react";
import { formatCurrency, EXPENSE_CATEGORIES } from "@/lib/constants";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getCategoryIcon } from "@/lib/category-icons";
import { CategoryBadge } from "@/components/category-badge";

export default function Budget() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: analysis, isLoading: isLoadingAnalysis } = useGetBudgetAnalysis(
    { month: currentMonth },
    { query: { enabled: true, queryKey: getGetBudgetAnalysisQueryKey({ month: currentMonth }) } }
  );

  const { data: goals, isLoading: isLoadingGoals } = useListBudgetGoals(
    { query: { enabled: true, queryKey: getListBudgetGoalsQueryKey() } }
  );

  const upsertGoal = useUpsertBudgetGoal();

  // Local state for editing goals
  const [editingGoals, setEditingGoals] = useState<Record<string, string>>({});

  const handleGoalChange = (category: string, value: string) => {
    setEditingGoals(prev => ({ ...prev, [category]: value }));
  };

  const handleSaveGoal = (category: string) => {
    const plannedAmount = editingGoals[category];
    if (!plannedAmount) return;

    upsertGoal.mutate({ data: { category, plannedAmount } }, {
      onSuccess: () => {
        toast({ title: "Budget updated", description: `${category} budget set to ${formatCurrency(plannedAmount)}` });
        // Clear local edit state for this category so it falls back to DB value
        setEditingGoals(prev => {
          const next = { ...prev };
          delete next[category];
          return next;
        });
        queryClient.invalidateQueries({ queryKey: getListBudgetGoalsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBudgetAnalysisQueryKey({ month: currentMonth }) });
      }
    });
  };

  const columns = [
    {
      header: "Category",
      accessorKey: "category" as const,
      className: "font-medium max-w-[200px]",
      cell: (row: BudgetAnalysisRow) => (
        <CategoryBadge category={row.category} type="Expense" />
      ),
    },
    {
      header: "Planned",
      accessorKey: "planned" as const,
      cell: (row: BudgetAnalysisRow) => {
        const val = editingGoals[row.category] !== undefined 
          ? editingGoals[row.category] 
          : row.planned;

        return (
          <div className="flex items-center gap-2 max-w-[140px] md:max-w-none">
            <div className="relative flex-1">
              <span className="absolute left-2 top-2 text-muted-foreground text-xs font-mono">{"\u20B9"}</span>
              <Input 
                type="number" 
                step="0.01" 
                className="h-8 pl-5 font-mono text-xs" 
                value={val}
                onChange={(e) => handleGoalChange(row.category, e.target.value)}
              />
            </div>
            {editingGoals[row.category] !== undefined && (
              <Button 
                size="icon" 
                variant="secondary" 
                className="h-8 w-8"
                onClick={() => handleSaveGoal(row.category)}
                disabled={upsertGoal.isPending}
              >
                <Save className="w-3 h-3" />
              </Button>
            )}
          </div>
        );
      }
    },
    {
      header: "Actual",
      accessorKey: "actual" as const,
      className: "text-right font-mono",
      cell: (row: BudgetAnalysisRow) => formatCurrency(row.actual)
    },
    {
      header: "Difference",
      accessorKey: "difference" as const,
      className: "text-right font-mono",
      cell: (row: BudgetAnalysisRow) => (
        <span className={row.overBudget ? "text-destructive font-bold flex items-center justify-end gap-1" : "text-emerald-500 flex items-center justify-end gap-1"}>
          {row.overBudget && <AlertCircle className="w-3 h-3" />}
          {formatCurrency(row.difference)}
        </span>
      )
    },
  ];

  const totalPlanned = useMemo(() => analysis?.reduce((acc, r) => acc + Number(r.planned), 0) || 0, [analysis]);
  const totalActual = useMemo(() => analysis?.reduce((acc, r) => acc + Number(r.actual), 0) || 0, [analysis]);
  const isOverTotal = totalActual > totalPlanned;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Budget Analysis</h1>
        <p className="text-muted-foreground text-sm mt-1">Plan vs actual spending for {new Date(currentMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/50 backdrop-blur border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">Total Planned</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAnalysis ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {formatCurrency(totalPlanned)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">Total Actual</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAnalysis ? <Skeleton className="h-8 w-24" /> : (
              <div className={`text-2xl font-bold font-mono tracking-tight ${isOverTotal ? 'text-destructive' : 'text-foreground'}`}>
                {formatCurrency(totalActual)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">Net Difference</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAnalysis ? <Skeleton className="h-8 w-24" /> : (
              <div className={`text-2xl font-bold font-mono tracking-tight ${isOverTotal ? 'text-destructive' : 'text-emerald-500'}`}>
                {isOverTotal ? "-" : "+"}{formatCurrency(Math.abs(totalPlanned - totalActual))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="bg-card/50 backdrop-blur rounded-xl border border-border/60 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Category Breakdown</h2>
        </div>
        
        {isLoadingAnalysis || isLoadingGoals ? (
           <div className="space-y-3 mt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <ResponsiveTable 
            data={analysis || []} 
            columns={columns} 
            keyExtractor={(r) => r.category}
            emptyState={
              <div className="text-center py-12">No budget data found.</div>
            }
          />
        )}
      </div>

    </div>
  );
}
