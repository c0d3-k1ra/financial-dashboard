import { useState, useMemo } from "react";
import { 
  useGetBudgetAnalysis, 
  getGetBudgetAnalysisQueryKey,
  useListBudgetGoals,
  getListBudgetGoalsQueryKey,
  useUpsertBudgetGoal
} from "@workspace/api-client-react";
import type { BudgetAnalysisRow } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Save, TrendingUp, TrendingDown, CheckCircle2, Clock, Minus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CategoryBadge } from "@/components/category-badge";

function ProgressBar({ row, isFixed }: { row: BudgetAnalysisRow; isFixed: boolean }) {
  const planned = Number(row.planned);
  const actual = Number(row.actual);
  const percent = planned > 0 ? Math.min((actual / planned) * 100, 100) : (actual > 0 ? 100 : 0);
  const overflowPercent = planned > 0 && actual > planned ? Math.min(((actual - planned) / planned) * 100, 50) : 0;

  const colorClass = row.paceStatus === "over_budget"
    ? "bg-destructive"
    : row.paceStatus === "ahead"
      ? "bg-amber-500"
      : "bg-emerald-500";

  if (isFixed) {
    const paid = actual >= planned && planned > 0;
    return (
      <div className="flex items-center gap-2 mt-1.5">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${paid ? "bg-emerald-500" : actual > 0 ? "bg-amber-500" : "bg-muted-foreground/20"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground w-10 text-right shrink-0">
          {paid ? "✓" : `${Math.round(percent)}%`}
        </span>
      </div>
    );
  }

  const totalPercent = planned > 0 ? Math.min((actual / planned) * 100, 150) : (actual > 0 ? 100 : 0);
  const isOver = actual > planned && planned > 0;

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-2 rounded-full bg-muted relative overflow-hidden">
        <div
          className={`h-full rounded-l-full transition-all duration-500 ${isOver ? "bg-destructive" : colorClass} ${totalPercent <= 100 ? "rounded-r-full" : ""}`}
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

function PaceIndicator({ row }: { row: BudgetAnalysisRow }) {
  if (row.categoryType === "fixed") {
    const planned = Number(row.planned);
    const actual = Number(row.actual);
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
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
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
  isSaving,
}: {
  row: BudgetAnalysisRow;
  editingGoals: Record<string, string>;
  onGoalChange: (category: string, value: string) => void;
  onSaveGoal: (category: string) => void;
  isSaving: boolean;
}) {
  const val = editingGoals[row.category] !== undefined
    ? editingGoals[row.category]
    : row.planned;
  const isFixed = row.categoryType === "fixed";

  return (
    <div className="border border-border/40 rounded-lg p-3 md:p-4 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <CategoryBadge category={row.category} type="Expense" />
        <PaceIndicator row={row} />
      </div>

      <ProgressBar row={row} isFixed={isFixed} />

      <div className="grid grid-cols-3 gap-2 text-xs mt-2">
        <div>
          <span className="text-muted-foreground block mb-0.5">Planned</span>
          <div className="flex items-center gap-1">
            <div className="relative flex-1">
              <span className="absolute left-1.5 top-1.5 text-muted-foreground text-xs font-mono">₹</span>
              <Input
                type="number"
                step="0.01"
                className="h-7 pl-4 font-mono text-xs"
                value={val}
                onChange={(e) => onGoalChange(row.category, e.target.value)}
              />
            </div>
            {editingGoals[row.category] !== undefined && (
              <Button
                size="icon"
                variant="secondary"
                className="h-7 w-7"
                onClick={() => onSaveGoal(row.category)}
                disabled={isSaving}
              >
                <Save className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
        <div>
          <span className="text-muted-foreground block mb-0.5">Actual</span>
          <span className="font-mono font-medium">{formatCurrency(row.actual)}</span>
        </div>
        <div>
          <span className="text-muted-foreground block mb-0.5">Difference</span>
          <span className={`font-mono font-medium ${row.overBudget ? "text-destructive" : "text-emerald-500"}`}>
            {row.overBudget && <AlertCircle className="w-3 h-3 inline mr-0.5" />}
            {formatCurrency(row.difference)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Budget() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: analysisData, isLoading: isLoadingAnalysis } = useGetBudgetAnalysis(
    { month: currentMonth },
    { query: { enabled: true, queryKey: getGetBudgetAnalysisQueryKey({ month: currentMonth }) } }
  );

  const { isLoading: isLoadingGoals } = useListBudgetGoals(
    { query: { enabled: true, queryKey: getListBudgetGoalsQueryKey() } }
  );

  const upsertGoal = useUpsertBudgetGoal();

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

  const rows = analysisData?.rows ?? [];
  const daysElapsed = analysisData?.daysElapsed ?? 0;
  const totalCycleDays = analysisData?.totalCycleDays ?? 0;
  const cycleProgress = totalCycleDays > 0 ? Math.round((daysElapsed / totalCycleDays) * 100) : 0;

  const fixedRows = useMemo(() => rows.filter(r => r.categoryType === "fixed"), [rows]);
  const discretionaryRows = useMemo(() => rows.filter(r => r.categoryType === "discretionary"), [rows]);

  const totalPlanned = useMemo(() => rows.reduce((acc, r) => acc + Number(r.planned), 0), [rows]);
  const totalActual = useMemo(() => rows.reduce((acc, r) => acc + Number(r.actual), 0), [rows]);
  const isOverTotal = totalActual > totalPlanned;

  const fixedPlanned = useMemo(() => fixedRows.reduce((acc, r) => acc + Number(r.planned), 0), [fixedRows]);
  const fixedActual = useMemo(() => fixedRows.reduce((acc, r) => acc + Number(r.actual), 0), [fixedRows]);

  const discPlanned = useMemo(() => discretionaryRows.reduce((acc, r) => acc + Number(r.planned), 0), [discretionaryRows]);
  const discActual = useMemo(() => discretionaryRows.reduce((acc, r) => acc + Number(r.actual), 0), [discretionaryRows]);

  const isLoading = isLoadingAnalysis || isLoadingGoals;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Budget Analysis</h1>
        <p className="text-muted-foreground text-sm mt-1">Plan vs actual spending for {new Date(currentMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-card/50 backdrop-blur border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Cycle Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  Day {daysElapsed}/{totalCycleDays}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${cycleProgress}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{cycleProgress}%</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Overall</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className={`text-lg font-bold font-mono tracking-tight ${isOverTotal ? 'text-destructive' : 'text-foreground'}`}>
                  {formatCurrency(totalActual)}
                </div>
                <div className="text-xs text-muted-foreground font-mono">of {formatCurrency(totalPlanned)}</div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Net Difference</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className={`text-lg font-bold font-mono tracking-tight ${isOverTotal ? 'text-destructive' : 'text-emerald-500'}`}>
                {isOverTotal ? "-" : "+"}{formatCurrency(Math.abs(totalPlanned - totalActual))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Fixed</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className={`text-lg font-bold font-mono tracking-tight ${fixedActual > fixedPlanned ? 'text-destructive' : 'text-foreground'}`}>
                  {formatCurrency(fixedActual)}
                </div>
                <div className="text-xs text-muted-foreground font-mono">of {formatCurrency(fixedPlanned)}</div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Discretionary</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className={`text-lg font-bold font-mono tracking-tight ${discActual > discPlanned ? 'text-destructive' : 'text-foreground'}`}>
                  {formatCurrency(discActual)}
                </div>
                <div className="text-xs text-muted-foreground font-mono">of {formatCurrency(discPlanned)}</div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-3 mt-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <>
          {fixedRows.length > 0 && (
            <div className="bg-card/50 backdrop-blur rounded-xl border border-border/60 p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Fixed Commitments</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">EMIs, SIPs, insurance & recurring obligations</p>
                </div>
                <div className="text-sm font-mono text-muted-foreground">
                  {formatCurrency(fixedActual)} / {formatCurrency(fixedPlanned)}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {fixedRows.map(row => (
                  <CategoryRow
                    key={row.category}
                    row={row}
                    editingGoals={editingGoals}
                    onGoalChange={handleGoalChange}
                    onSaveGoal={handleSaveGoal}
                    isSaving={upsertGoal.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {discretionaryRows.length > 0 && (
            <div className="bg-card/50 backdrop-blur rounded-xl border border-border/60 p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Discretionary</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Variable spending you can control</p>
                </div>
                <div className="text-sm font-mono text-muted-foreground">
                  {formatCurrency(discActual)} / {formatCurrency(discPlanned)}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {discretionaryRows.map(row => (
                  <CategoryRow
                    key={row.category}
                    row={row}
                    editingGoals={editingGoals}
                    onGoalChange={handleGoalChange}
                    onSaveGoal={handleSaveGoal}
                    isSaving={upsertGoal.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {rows.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">No budget data found.</div>
          )}
        </>
      )}

    </div>
  );
}
