import { useState, useMemo } from "react";
import { 
  useGetBudgetAnalysis, 
  getGetBudgetAnalysisQueryKey,
  useListBudgetGoals,
  getListBudgetGoalsQueryKey,
  useUpsertBudgetGoal,
  useDeleteBudgetGoal,
  useListCategories,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import type { BudgetAnalysisRow } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/constants";
import { SensitiveValue } from "@/components/sensitive-value";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Save, TrendingUp, TrendingDown, CheckCircle2, Clock, Minus, Trash2, Plus, Pencil, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CategoryBadge } from "@/components/category-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


function MiniProgressBar({ actual, planned, colorClass }: { actual: number; planned: number; colorClass?: string }) {
  const percent = planned > 0 ? Math.min((actual / planned) * 100, 100) : (actual > 0 ? 100 : 0);
  const isOver = actual > planned && planned > 0;
  const barColor = colorClass ?? (isOver ? "bg-destructive" : percent > 75 ? "bg-amber-500" : "bg-emerald-500");

  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground">{Math.round(percent)}%</span>
    </div>
  );
}

function ProgressBar({ row, isFixed, cycleProgress }: { row: BudgetAnalysisRow; isFixed: boolean; cycleProgress: number }) {
  const planned = Number(row.planned);
  const actual = Number(row.actual);
  const percent = planned > 0 ? Math.min((actual / planned) * 100, 100) : (actual > 0 ? 100 : 0);

  if (isFixed) {
    const paid = actual >= planned && planned > 0;
    const overPaid = actual > planned && planned > 0;
    const pending = actual === 0 && planned > 0;
    const isOverdue = pending && cycleProgress > 70;

    let barColor = "bg-muted-foreground/20";
    if (overPaid) barColor = "bg-destructive";
    else if (paid) barColor = "bg-emerald-500";
    else if (actual > 0) barColor = "bg-amber-500";
    else if (isOverdue) barColor = "bg-destructive/30";

    return (
      <div className="flex items-center gap-2 mt-1.5">
        <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${paid || overPaid ? 100 : percent}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground w-10 text-right shrink-0">
          {paid && !overPaid ? "✓" : `${Math.round(percent)}%`}
        </span>
      </div>
    );
  }

  const totalPercent = planned > 0 ? Math.min((actual / planned) * 100, 150) : (actual > 0 ? 100 : 0);
  const isOver = actual > planned && planned > 0;
  const spendPercent = Number(row.percentSpent);

  let barColor = "bg-emerald-500";
  if (isOver) barColor = "bg-destructive";
  else if (spendPercent > 75) barColor = "bg-amber-500";

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-2 rounded-full bg-muted/50 relative overflow-hidden">
        <div
          className={`h-full rounded-l-full transition-all duration-500 ${barColor} ${totalPercent <= 100 ? "rounded-r-full" : ""}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
        {isOver && (
          <div
            className="absolute top-0 h-full bg-destructive/40 rounded-r-full border-l border-destructive"
            style={{ left: `${Math.min(percent, 100)}%`, width: `${Math.min(totalPercent - 100, 50)}%` }}
          />
        )}
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-10 text-right shrink-0">
        {Math.round(row.percentSpent)}%
      </span>
    </div>
  );
}

function PaceIndicator({ row, cycleProgress }: { row: BudgetAnalysisRow; cycleProgress: number }) {
  if (row.categoryType === "fixed") {
    const planned = Number(row.planned);
    const actual = Number(row.actual);
    if (actual > planned && planned > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium">
          <AlertCircle className="w-3 h-3" /> Overspent
        </span>
      );
    }
    if (actual >= planned && planned > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-medium">
          <CheckCircle2 className="w-3 h-3" /> Paid
        </span>
      );
    }
    if (actual > 0 && actual < planned) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-500 font-medium">
          <Minus className="w-3 h-3" /> Partially paid
        </span>
      );
    }
    if (cycleProgress > 70) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium">
          <AlertCircle className="w-3 h-3" /> Overdue
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-500 font-medium">
        <Clock className="w-3 h-3" /> Pending
      </span>
    );
  }

  if (row.paceStatus === "over_budget") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium">
        <AlertCircle className="w-3 h-3" /> {row.paceMessage}
      </span>
    );
  }
  if (row.paceStatus === "ahead") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-500 font-medium">
        <TrendingUp className="w-3 h-3" /> {row.paceMessage}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-medium">
      <TrendingDown className="w-3 h-3" /> {row.paceMessage}
    </span>
  );
}

function CategoryRow({
  row,
  editingGoals,
  onGoalChange,
  onSaveGoal,
  onRemove,
  isSaving,
  isRemoving,
  cycleProgress,
}: {
  row: BudgetAnalysisRow;
  editingGoals: Record<string, string>;
  onGoalChange: (category: string, value: string) => void;
  onSaveGoal: (row: BudgetAnalysisRow) => void;
  onRemove: (row: BudgetAnalysisRow) => void;
  isSaving: boolean;
  isRemoving: boolean;
  cycleProgress: number;
}) {
  const val = editingGoals[row.category] !== undefined
    ? editingGoals[row.category]
    : row.planned;
  const isFixed = row.categoryType === "fixed";
  const isEditing = editingGoals[row.category] !== undefined;

  const planned = Number(row.planned);
  const actual = Number(row.actual);
  const pending = isFixed && actual === 0 && planned > 0;
  const isOverdue = pending && cycleProgress > 70;

  let diffColorClass = "text-emerald-500";
  if (row.overBudget) {
    diffColorClass = "text-destructive";
  } else if (isFixed && pending) {
    diffColorClass = isOverdue ? "text-destructive" : "text-amber-500";
  }

  return (
    <div className={`border rounded-lg p-3 md:p-4 space-y-2 transition-colors ${
      isOverdue ? "border-destructive/40 bg-destructive/5" :
      pending ? "border-amber-500/30 bg-amber-500/5" :
      row.overBudget ? "border-destructive/30 bg-destructive/5" :
      "border-[var(--divider-color)] bg-[rgba(var(--glass-overlay-rgb),0.02)]"
    }`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <CategoryBadge category={row.category} type="Expense" />
        <div className="flex items-center gap-2">
          <PaceIndicator row={row} cycleProgress={cycleProgress} />
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(row)}
            disabled={isRemoving}
            title="Remove from budget"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <ProgressBar row={row} isFixed={isFixed} cycleProgress={cycleProgress} />

      <div className="grid grid-cols-3 gap-2 text-xs mt-2">
        <div>
          <span className="text-muted-foreground block mb-0.5">Planned</span>
          <SensitiveValue as="div" className="flex items-center gap-1">
            <div className="relative flex-1">
              <span className="absolute left-1.5 top-1.5 text-muted-foreground text-xs font-mono">₹</span>
              <Input
                type="number"
                step="0.01"
                className={`h-7 pl-4 pr-6 font-mono text-xs transition-colors ${
                  isEditing 
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" 
                    : "bg-muted/30 hover:bg-muted/50 border-transparent hover:border-border/40"
                }`}
                value={val}
                onChange={(e) => onGoalChange(row.category, e.target.value)}
              />
              {!isEditing && (
                <Pencil className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
              )}
            </div>
            {isEditing && (
              <Button
                size="icon"
                variant="secondary"
                className="h-7 w-7 bg-primary/10 hover:bg-primary/20 text-primary"
                onClick={() => onSaveGoal(row)}
                disabled={isSaving}
              >
                <Save className="w-3 h-3" />
              </Button>
            )}
          </SensitiveValue>
        </div>
        <div>
          <span className="text-muted-foreground block mb-0.5">Actual</span>
          <SensitiveValue className="font-mono font-medium">{formatCurrency(row.actual)}</SensitiveValue>
        </div>
        <div>
          <span className="text-muted-foreground block mb-0.5">Difference</span>
          <SensitiveValue className={`font-mono font-medium ${diffColorClass}`}>
            {row.overBudget && <AlertCircle className="w-3 h-3 inline mr-0.5" />}
            {formatCurrency(row.difference)}
          </SensitiveValue>
        </div>
      </div>
    </div>
  );
}

function AddCategoryButton({
  availableCategories,
  onAdd,
  isAdding,
}: {
  availableCategories: { id: number; name: string }[];
  onAdd: (categoryId: number, categoryName: string) => void;
  isAdding: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (availableCategories.length === 0 && !isOpen) return null;

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="mt-3 border-dashed border-[var(--divider-color)] hover:border-[rgba(var(--glass-overlay-rgb),0.20)]"
        onClick={() => setIsOpen(true)}
        disabled={isAdding}
      >
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Add category
      </Button>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <Select
        onValueChange={(value) => {
          const cat = availableCategories.find(c => c.id === Number(value));
          if (cat) {
            onAdd(cat.id, cat.name);
            setIsOpen(false);
          }
        }}
      >
        <SelectTrigger className="w-[200px] h-8 text-xs">
          <SelectValue placeholder="Select category..." />
        </SelectTrigger>
        <SelectContent>
          {availableCategories.map(cat => (
            <SelectItem key={cat.id} value={String(cat.id)}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        onClick={() => setIsOpen(false)}
      >
        Cancel
      </Button>
    </div>
  );
}

function TopOverspendCallout({ rows }: { rows: BudgetAnalysisRow[] }) {
  const overspentRows = rows
    .filter(r => r.overBudget && Number(r.planned) > 0)
    .sort((a, b) => Math.abs(Number(a.difference)) - Math.abs(Number(b.difference)))
    .reverse()
    .slice(0, 3);

  if (overspentRows.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
        <span className="text-xs font-semibold text-destructive">Top overspend categories</span>
      </div>
      <div className="space-y-1.5">
        {overspentRows.map(row => (
          <div key={row.category} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{row.category}</span>
            <SensitiveValue className="font-mono text-destructive font-medium">
              {formatCurrency(Math.abs(Number(row.difference)))} over
            </SensitiveValue>
          </div>
        ))}
      </div>
    </div>
  );
}

function BudgetSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-48 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="glass-card rounded-xl border p-6 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>

      <div className="glass-1 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Skeleton className="h-5 w-40 mb-1" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-[var(--divider-color)] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-1 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-[var(--divider-color)] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getMonthOffset(baseMonth: string, offset: number): string {
  const [yearStr, monthStr] = baseMonth.split("-");
  const d = new Date(parseInt(yearStr), parseInt(monthStr) - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Budget() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const todayMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const isCurrentMonth = currentMonth === todayMonth;

  const navigateMonth = (direction: -1 | 1) => {
    setCurrentMonth(prev => getMonthOffset(prev, direction));
  };

  const monthLabel = useMemo(() => {
    return new Date(currentMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [currentMonth]);

  const { data: analysisData, isLoading: isLoadingAnalysis } = useGetBudgetAnalysis(
    { month: currentMonth },
    { query: { enabled: true, queryKey: getGetBudgetAnalysisQueryKey({ month: currentMonth }) } }
  );

  const { isLoading: isLoadingGoals } = useListBudgetGoals(
    { query: { enabled: true, queryKey: getListBudgetGoalsQueryKey() } }
  );

  const { data: categories } = useListCategories(
    { type: "Expense" },
    { query: { queryKey: getListCategoriesQueryKey({ type: "Expense" }) } }
  );

  const upsertGoal = useUpsertBudgetGoal();
  const deleteGoal = useDeleteBudgetGoal();

  const [editingGoals, setEditingGoals] = useState<Record<string, string>>({});

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListBudgetGoalsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetBudgetAnalysisQueryKey({ month: currentMonth }) });
  };

  const handleGoalChange = (category: string, value: string) => {
    setEditingGoals(prev => ({ ...prev, [category]: value }));
  };

  const handleSaveGoal = (row: BudgetAnalysisRow) => {
    const plannedAmount = editingGoals[row.category];
    if (!plannedAmount) return;

    upsertGoal.mutate({ data: { categoryId: row.categoryId, plannedAmount } }, {
      onSuccess: () => {
        toast({ title: "Budget updated", description: `${row.category} budget set to ${formatCurrency(plannedAmount)}` });
        setEditingGoals(prev => {
          const next = { ...prev };
          delete next[row.category];
          return next;
        });
        invalidateAll();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update budget goal", variant: "destructive" });
      },
    });
  };

  const handleRemoveCategory = (row: BudgetAnalysisRow) => {
    if (!row.budgetGoalId) {
      toast({ title: "No budget goal", description: "This category has no budget goal to remove", variant: "destructive" });
      return;
    }
    deleteGoal.mutate({ id: row.budgetGoalId }, {
      onSuccess: () => {
        toast({ title: "Category removed", description: `${row.category} removed from budget` });
        invalidateAll();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to remove category", variant: "destructive" });
      },
    });
  };

  const handleAddCategory = (categoryId: number, categoryName: string) => {
    upsertGoal.mutate({ data: { categoryId, plannedAmount: "0" } }, {
      onSuccess: () => {
        toast({ title: "Category added", description: `${categoryName} added to budget` });
        invalidateAll();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to add category", variant: "destructive" });
      },
    });
  };

  const rows: BudgetAnalysisRow[] = analysisData?.rows ?? [];
  const budgetedRows = useMemo<BudgetAnalysisRow[]>(() => rows.filter(r => r.budgetGoalId != null), [rows]);
  const daysElapsed = analysisData?.daysElapsed ?? 0;
  const totalCycleDays = analysisData?.totalCycleDays ?? 0;
  const cycleProgress = totalCycleDays > 0 ? Math.round((daysElapsed / totalCycleDays) * 100) : 0;

  const fixedRows = useMemo<BudgetAnalysisRow[]>(() => budgetedRows.filter(r => r.categoryType === "fixed"), [budgetedRows]);
  const discretionaryRows = useMemo<BudgetAnalysisRow[]>(() => budgetedRows.filter(r => r.categoryType === "discretionary"), [budgetedRows]);

  const totalPlanned = useMemo(() => budgetedRows.reduce((acc, r) => acc + Number(r.planned), 0), [budgetedRows]);
  const totalActual = useMemo(() => budgetedRows.reduce((acc, r) => acc + Number(r.actual), 0), [budgetedRows]);
  const isOverTotal = totalActual > totalPlanned;

  const fixedPlanned = useMemo(() => fixedRows.reduce((acc, r) => acc + Number(r.planned), 0), [fixedRows]);
  const fixedActual = useMemo(() => fixedRows.reduce((acc, r) => acc + Number(r.actual), 0), [fixedRows]);

  const discPlanned = useMemo(() => discretionaryRows.reduce((acc, r) => acc + Number(r.planned), 0), [discretionaryRows]);
  const discActual = useMemo(() => discretionaryRows.reduce((acc, r) => acc + Number(r.actual), 0), [discretionaryRows]);
  const isDiscOver = discActual > discPlanned && discPlanned > 0;

  const budgetedCategoryIds = useMemo(() => new Set(budgetedRows.map(r => r.categoryId)), [budgetedRows]);
  const availableCategories = useMemo(() => {
    if (!categories) return [];
    return categories
      .filter(c => !budgetedCategoryIds.has(c.id))
      .map(c => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, budgetedCategoryIds]);

  const isLoading = isLoadingAnalysis || isLoadingGoals;

  if (isLoading) {
    return <BudgetSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Budget Analysis</h1>
          <p className="text-muted-foreground text-sm mt-1">Plan vs actual spending for {monthLabel}.</p>
        </div>
        <div className="flex items-center gap-1 glass-2 rounded-lg p-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-[var(--glass-hover)]"
            onClick={() => navigateMonth(-1)}
            title="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium px-3 min-w-[120px] text-center">{monthLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-[var(--glass-hover)]"
            onClick={() => navigateMonth(1)}
            disabled={isCurrentMonth}
            title="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="glass-card glass-animate-in glass-stagger-1 rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Cycle Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
              Day {daysElapsed}/{totalCycleDays}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 rounded-full bg-muted/50">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${cycleProgress}%` }} />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">{cycleProgress}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card glass-animate-in glass-stagger-2 rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Overall</CardTitle>
          </CardHeader>
          <CardContent>
            <SensitiveValue as="div" className={`text-lg font-bold font-mono tracking-tight ${isOverTotal ? 'text-destructive' : 'text-foreground'}`}>
              {formatCurrency(totalActual)}
            </SensitiveValue>
            <SensitiveValue as="div" className="text-xs text-muted-foreground font-mono">of {formatCurrency(totalPlanned)}</SensitiveValue>
            <MiniProgressBar actual={totalActual} planned={totalPlanned} />
          </CardContent>
        </Card>

        <Card className="glass-card glass-animate-in glass-stagger-3 rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Net Difference</CardTitle>
          </CardHeader>
          <CardContent>
            <SensitiveValue as="div" className={`text-lg font-bold font-mono tracking-tight ${isOverTotal ? 'text-destructive' : 'text-emerald-500'}`}>
              {isOverTotal ? "-" : "+"}{formatCurrency(Math.abs(totalPlanned - totalActual))}
            </SensitiveValue>
            <div className={`text-xs font-medium mt-1 ${isOverTotal ? 'text-destructive/80' : 'text-emerald-500/80'}`}>
              {isOverTotal ? "Over budget" : "Under budget"}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card glass-animate-in glass-stagger-4 rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Fixed</CardTitle>
          </CardHeader>
          <CardContent>
            <SensitiveValue as="div" className={`text-lg font-bold font-mono tracking-tight ${fixedActual > fixedPlanned ? 'text-destructive' : 'text-foreground'}`}>
              {formatCurrency(fixedActual)}
            </SensitiveValue>
            <SensitiveValue as="div" className="text-xs text-muted-foreground font-mono">of {formatCurrency(fixedPlanned)}</SensitiveValue>
            <MiniProgressBar actual={fixedActual} planned={fixedPlanned} />
          </CardContent>
        </Card>

        <Card className="glass-card glass-animate-in glass-stagger-5 rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Discretionary</CardTitle>
          </CardHeader>
          <CardContent>
            <SensitiveValue as="div" className={`text-lg font-bold font-mono tracking-tight ${isDiscOver ? 'text-destructive' : 'text-foreground'}`}>
              {formatCurrency(discActual)}
            </SensitiveValue>
            <SensitiveValue as="div" className="text-xs text-muted-foreground font-mono">of {formatCurrency(discPlanned)}</SensitiveValue>
            <MiniProgressBar actual={discActual} planned={discPlanned} />
          </CardContent>
        </Card>
      </div>

      <div className="glass-1 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Fixed Commitments</h2>
            <p className="text-xs text-muted-foreground mt-0.5">EMIs, SIPs, insurance & recurring obligations</p>
          </div>
          <SensitiveValue as="div" className="text-sm font-mono text-muted-foreground">
            {formatCurrency(fixedActual)} / {formatCurrency(fixedPlanned)}
          </SensitiveValue>
        </div>
        {fixedRows.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fixedRows.map(row => (
              <CategoryRow
                key={row.category}
                row={row}
                editingGoals={editingGoals}
                onGoalChange={handleGoalChange}
                onSaveGoal={handleSaveGoal}
                onRemove={handleRemoveCategory}
                isSaving={upsertGoal.isPending}
                isRemoving={deleteGoal.isPending}
                cycleProgress={cycleProgress}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No fixed categories in budget yet.</p>
        )}
        <AddCategoryButton
          availableCategories={availableCategories}
          onAdd={handleAddCategory}
          isAdding={upsertGoal.isPending}
        />
      </div>

      <div className="glass-1 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-lg font-semibold tracking-tight ${isDiscOver ? 'text-destructive' : ''}`}>
                Discretionary
              </h2>
              {isDiscOver && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" />
                  Over budget
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Variable spending you can control</p>
          </div>
          <SensitiveValue as="div" className={`text-sm font-mono ${isDiscOver ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
            {formatCurrency(discActual)} / {formatCurrency(discPlanned)}
          </SensitiveValue>
        </div>
        {discretionaryRows.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {discretionaryRows.map(row => (
                <CategoryRow
                  key={row.category}
                  row={row}
                  editingGoals={editingGoals}
                  onGoalChange={handleGoalChange}
                  onSaveGoal={handleSaveGoal}
                  onRemove={handleRemoveCategory}
                  isSaving={upsertGoal.isPending}
                  isRemoving={deleteGoal.isPending}
                  cycleProgress={cycleProgress}
                />
              ))}
            </div>
            {isDiscOver && <TopOverspendCallout rows={discretionaryRows} />}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No discretionary categories in budget yet.</p>
        )}
        <AddCategoryButton
          availableCategories={availableCategories}
          onAdd={handleAddCategory}
          isAdding={upsertGoal.isPending}
        />
      </div>

      {budgetedRows.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">No budget categories configured. Use the "Add category" buttons above to get started.</div>
      )}

    </div>
  );
}
