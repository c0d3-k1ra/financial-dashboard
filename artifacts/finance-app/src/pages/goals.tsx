import { useState } from "react";
import {
  useListGoals,
  getListGoalsQueryKey,
  useCreateGoal,
  useDeleteGoal,
  useUpdateGoal,
  useGetGoalsWaterfall,
  getGetGoalsWaterfallQueryKey,
  useListAccounts,
  useGetGoalProjectionById,
  getGetGoalProjectionByIdQueryKey,
} from "@workspace/api-client-react";
import { formatCurrency, getApiErrorMessage } from "@/lib/constants";
import { SensitiveValue } from "@/components/sensitive-value";
import { usePrivacy } from "@/lib/privacy-context";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/query-error-state";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import { Plus, Target, AlertTriangle, TrendingUp, Trash2, Pencil, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useChartTheme } from "@/lib/chart-theme";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

const CATEGORY_OPTIONS = ["Emergency", "Debt", "Travel", "Purchase", "General"];
const CATEGORY_ICONS: Record<string, string> = {
  Emergency: "🛡️",
  Debt: "💳",
  Travel: "✈️",
  Purchase: "🛍️",
  General: "🎯",
};

const STATUS_COLORS: Record<string, string> = {
  "On Track": "status-badge-success",
  "At Risk": "status-badge-warning",
  "Behind": "status-badge-danger",
  "Not Started": "status-badge-neutral",
  "Achieved": "status-badge-success",
};

export default function Goals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { isHidden: _privacyHidden } = usePrivacy();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [chartExpanded, setChartExpanded] = useState(false);

  const [newGoal, setNewGoal] = useState({
    name: "",
    targetAmount: "",
    targetDate: "",
    categoryType: "General",
    accountId: "",
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<{
    id: number;
    name: string;
    targetAmount: string;
    currentAmount: string;
    targetDate: string;
    categoryType: string;
    accountId: string;
  } | null>(null);

  const { data: goals, isLoading: isLoadingGoals, isError: isErrorGoals, refetch: refetchGoals } = useListGoals();
  const { data: waterfall } = useGetGoalsWaterfall();
  const { data: accounts } = useListAccounts();
  const createGoal = useCreateGoal();
  const deleteGoal = useDeleteGoal();
  const updateGoal = useUpdateGoal();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetGoalsWaterfallQueryKey() });
  };

  const handleCreateGoal = () => {
    if (!newGoal.name || !newGoal.targetAmount || !newGoal.accountId) {
      toast({ title: "Missing fields", description: "Name, target amount, and funding account are required.", variant: "destructive" });
      return;
    }
    createGoal.mutate(
      {
        data: {
          name: newGoal.name,
          targetAmount: newGoal.targetAmount,
          targetDate: newGoal.targetDate || undefined,
          categoryType: newGoal.categoryType,
          accountId: Number(newGoal.accountId),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Goal Created", description: `"${newGoal.name}" has been created.` });
          setNewGoal({ name: "", targetAmount: "", targetDate: "", categoryType: "General", accountId: "" });
          setCreateOpen(false);
          invalidateAll();
        },
        onError: (err) => {
          toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const handleDeleteGoal = (id: number) => {
    deleteGoal.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Goal Deleted" });
        invalidateAll();
      },
      onError: (err) => {
        toast({ title: "Cannot delete goal", description: getApiErrorMessage(err), variant: "destructive" });
      },
    });
  };

  const openEditDialog = (goal: NonNullable<typeof goals>[number]) => {
    setEditGoal({
      id: goal.id,
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      targetDate: goal.targetDate ?? "",
      categoryType: goal.categoryType,
      accountId: String(goal.accountId),
    });
    setEditOpen(true);
  };

  const handleUpdateGoal = () => {
    if (!editGoal) return;
    if (!editGoal.name || !editGoal.targetAmount || !editGoal.accountId) {
      toast({ title: "Missing fields", description: "Name, target amount, and funding account are required.", variant: "destructive" });
      return;
    }
    updateGoal.mutate(
      {
        id: editGoal.id,
        data: {
          name: editGoal.name,
          targetAmount: editGoal.targetAmount,
          currentAmount: editGoal.currentAmount,
          targetDate: editGoal.targetDate || undefined,
          categoryType: editGoal.categoryType,
          accountId: Number(editGoal.accountId),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Goal Updated", description: `"${editGoal.name}" has been updated.` });
          setEditOpen(false);
          setEditGoal(null);
          invalidateAll();
        },
        onError: (err) => {
          toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const activeGoals = goals?.filter((g) => g.status === "Active") || [];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Goal Manager</h1>
          <p className="text-muted-foreground text-sm mt-1">Track savings goals linked to your accounts.</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="font-mono text-xs uppercase tracking-wider" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create Goal
          </Button>
          <GoalFormModal open={createOpen} onOpenChange={setCreateOpen} title="Create New Goal" isMobile={isMobile}>
            <div className="space-y-4 py-2">
              <div>
                <Label>Name</Label>
                <Input placeholder="e.g., Vacation Fund" value={newGoal.name} onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })} />
              </div>
              <div>
                <Label>Target Amount (₹)</Label>
                <Input type="number" placeholder="50000" value={newGoal.targetAmount} onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })} />
              </div>
              <div>
                <Label>Target Date (optional)</Label>
                <DatePicker date={newGoal.targetDate ? new Date(newGoal.targetDate + "T00:00:00") : undefined} onSelect={(d) => setNewGoal({ ...newGoal, targetDate: d ? format(d, "yyyy-MM-dd") : "" })} placeholder="Pick a date" className="w-full" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={newGoal.categoryType} onValueChange={(v) => setNewGoal({ ...newGoal, categoryType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => (<SelectItem key={c} value={c}>{CATEGORY_ICONS[c]} {c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Funding Account</Label>
                <Select value={newGoal.accountId} onValueChange={(v) => setNewGoal({ ...newGoal, accountId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {accounts?.map((a) => (<SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateGoal} disabled={createGoal.isPending}>
                {createGoal.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </GoalFormModal>
        </div>
      </div>

      {waterfall?.stressTest && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 text-yellow-300">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div className="text-sm font-mono">
            <span className="font-bold">Goal Rich but Cash Poor</span> — your unallocated cash (
            <SensitiveValue>{formatCurrency(waterfall.remainingLiquidCash)}</SensitiveValue>) is below your monthly living expenses (
            <SensitiveValue>{formatCurrency(waterfall.avgMonthlyLivingExpenses)}</SensitiveValue>).
          </div>
        </div>
      )}

      {isMobile ? (
        <div>
          <button
            onClick={() => setChartExpanded(!chartExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 glass-1 rounded-xl mb-2"
          >
            <span className="text-sm font-semibold">Goal Projection</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${chartExpanded ? "rotate-180" : ""}`} />
          </button>
          {chartExpanded && (
            <div className="grid grid-cols-1 gap-6">
              {selectedGoalId ? (
                <GoalProjectionChart goalId={selectedGoalId} />
              ) : (
                <Card className="glass-card rounded-xl">
                  <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-[var(--divider-color)]">
                    Select a goal to view projection
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {selectedGoalId ? (
            <GoalProjectionChart goalId={selectedGoalId} />
          ) : (
            <Card className="glass-card glass-animate-in glass-stagger-1 rounded-xl">
              <CardHeader>
                <CardTitle className="text-lg">Goal Projection</CardTitle>
                <CardDescription>Click a goal card to see its 12-month projection</CardDescription>
              </CardHeader>
              <CardContent className="h-[250px] flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-[var(--divider-color)]">
                Select a goal to view projection
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">
          {activeGoals.length > 0 ? `Active Goals (${activeGoals.length})` : "Goals"}
        </h2>
        {isLoadingGoals ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="glass-card rounded-xl">
                <CardContent className="p-6 space-y-4">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isErrorGoals ? (
          <QueryErrorState onRetry={() => refetchGoals()} message="Failed to load goals" />
        ) : goals && goals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal) => {
              const target = Number(goal.targetAmount);
              const current = Number(goal.currentAmount);
              const progress = target > 0 ? (current / target) * 100 : 0;
              const isSelected = selectedGoalId === goal.id;

              return (
                <Card
                  key={goal.id}
                  className={`glass-card rounded-xl cursor-pointer transition-all hover:border-primary/40 ${
                    isSelected ? "border-primary/60 ring-1 ring-primary/30" : ""
                  } ${goal.status === "Achieved" ? "opacity-70" : ""}`}
                  onClick={() => {
                    const newId = isSelected ? null : goal.id;
                    setSelectedGoalId(newId);
                    if (isMobile && newId !== null) setChartExpanded(true);
                  }}
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-2xl shrink-0">{goal.icon || CATEGORY_ICONS[goal.categoryType] || "🎯"}</span>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm leading-tight truncate">{goal.name}</h3>
                          {goal.accountName && (
                            <span className="text-[10px] font-mono text-muted-foreground">{goal.accountName}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border whitespace-nowrap ${
                            goal.status === "Achieved"
                              ? "status-badge-success"
                              : STATUS_COLORS[goal.statusIndicator] || ""
                          }`}
                        >
                          {goal.status === "Achieved" ? "Achieved" : goal.statusIndicator}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 md:h-6 md:w-6 text-muted-foreground hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(goal);
                          }}
                        >
                          <Pencil className="w-4 h-4 md:w-3 md:h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 md:h-6 md:w-6 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGoal(goal.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 md:w-3 md:h-3" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <SensitiveValue className="font-mono text-lg font-bold">{formatCurrency(current)}</SensitiveValue>
                        <span className="font-mono text-xs text-muted-foreground">
                          <Target className="w-3 h-3 inline mr-0.5" />
                          <SensitiveValue>{formatCurrency(target)}</SensitiveValue>
                        </span>
                      </div>
                      <Progress
                        value={Math.min(progress, 100)}
                        className="h-2 bg-secondary"
                      />
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] font-mono text-muted-foreground">{progress.toFixed(1)}%</span>
                        {goal.projectedFinishDate && (
                          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-0.5">
                            <TrendingUp className="w-3 h-3" />
                            Est. {goal.projectedFinishDate}
                          </span>
                        )}
                      </div>
                    </div>

                    {goal.velocity > 0 && (
                      <div className="text-[10px] font-mono text-muted-foreground border-t border-border/30 pt-2">
                        Velocity: <SensitiveValue>{formatCurrency(goal.velocity)}/mo</SensitiveValue>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="glass-card rounded-xl">
            <CardContent className="py-12 text-center text-muted-foreground font-mono text-sm">
              No goals created yet. Click &ldquo;Create Goal&rdquo; to get started.
            </CardContent>
          </Card>
        )}
      </div>

      <GoalFormModal open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditGoal(null); }} title="Edit Goal" isMobile={isMobile}>
        {editGoal && (
          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input value={editGoal.name} onChange={(e) => setEditGoal({ ...editGoal, name: e.target.value })} />
            </div>
            <div>
              <Label>Target Amount (₹)</Label>
              <Input type="number" value={editGoal.targetAmount} onChange={(e) => setEditGoal({ ...editGoal, targetAmount: e.target.value })} />
            </div>
            <div>
              <Label>Current Amount (₹)</Label>
              <Input type="number" value={editGoal.currentAmount} onChange={(e) => setEditGoal({ ...editGoal, currentAmount: e.target.value })} />
            </div>
            <div>
              <Label>Target Date (optional)</Label>
              <DatePicker date={editGoal.targetDate ? new Date(editGoal.targetDate + "T00:00:00") : undefined} onSelect={(d) => setEditGoal({ ...editGoal, targetDate: d ? format(d, "yyyy-MM-dd") : "" })} placeholder="Pick a date" className="w-full" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={editGoal.categoryType} onValueChange={(v) => setEditGoal({ ...editGoal, categoryType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (<SelectItem key={c} value={c}>{CATEGORY_ICONS[c]} {c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Funding Account</Label>
              <Select value={editGoal.accountId} onValueChange={(v) => setEditGoal({ ...editGoal, accountId: v })}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts?.map((a) => (<SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setEditOpen(false); setEditGoal(null); }}>Cancel</Button>
          <Button onClick={handleUpdateGoal} disabled={updateGoal.isPending}>
            {updateGoal.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </GoalFormModal>
    </div>
  );
}

function GoalFormModal({ open, onOpenChange, title, isMobile, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  isMobile: boolean;
  children: React.ReactNode;
}) {
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function GoalProjectionChart({ goalId }: { goalId: number }) {
  const ct = useChartTheme();
  const { isHidden: privacyHidden } = usePrivacy();
  const { data: projection, isLoading, isError, refetch } = useGetGoalProjectionById(
    goalId,
    { query: { queryKey: getGetGoalProjectionByIdQueryKey(goalId) } }
  );

  const hasActual = projection?.some((p) => p.actual != null);
  const hasCurrentPace = projection?.some((p) => p.currentPace != null);
  const hasNeededPace = projection?.some((p) => p.neededPace != null);

  const chartData = projection?.map(p => ({
    month: p.month,
    actual: p.actual ?? null,
    currentPace: p.currentPace ?? null,
    neededPace: p.neededPace ?? null,
    targetAmount: p.targetAmount,
  }));

  return (
    <Card className="glass-card rounded-xl">
      <CardHeader>
        <CardTitle className="text-lg">Goal Projection</CardTitle>
        <CardDescription>
          {hasActual && hasCurrentPace
            ? "Green = actual savings · Blue = projected at current pace · Yellow dashed = needed to hit target"
            : hasActual
              ? "Green = actual savings so far"
              : "No savings data yet — use End Cycle to start tracking"}
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] w-full pt-4">
        {isLoading ? (
          <Skeleton className="w-full h-full" />
        ) : isError ? (
          <QueryErrorState onRetry={() => refetch()} message="Failed to load projection" />
        ) : chartData && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={ct.gridStroke} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: ct.tickFill, fontSize: 11, fontFamily: "var(--font-mono)" }}
                interval={chartData.length > 14 ? 2 : chartData.length > 8 ? 1 : 0}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={({ x, y, payload }: { x: number; y: number; payload: { value: number } }) => (
                  <text
                    x={x}
                    y={y}
                    textAnchor="end"
                    fill={ct.tickFill}
                    fontSize={12}
                    fontFamily="var(--font-mono)"
                    style={privacyHidden ? { filter: "blur(8px)", userSelect: "none" } : undefined}
                  >
                    {payload.value >= 100000 ? `₹${(payload.value / 100000).toFixed(1)}L` : `₹${(payload.value / 1000).toFixed(0)}k`}
                  </text>
                )}
                domain={[0, "auto"]}
              />
              <RechartsTooltip
                contentStyle={{ ...ct.tooltip, ...(privacyHidden ? { filter: "blur(8px)" } : {}) }}
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === "actual" ? "Actual" : name === "currentPace" ? "Current Pace" : "Needed Pace",
                ]}
                labelFormatter={(label) => label}
              />
              <ReferenceLine
                y={chartData[0]?.targetAmount || 0}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                label={({ viewBox }: { viewBox: { x: number; y: number } }) => (
                  <text
                    x={viewBox.x + 5}
                    y={viewBox.y - 5}
                    fill="hsl(var(--muted-foreground))"
                    fontSize={10}
                    fontFamily="var(--font-mono)"
                    style={privacyHidden ? { filter: "blur(8px)", userSelect: "none" } : undefined}
                  >
                    Target: {formatCurrency(chartData[0]?.targetAmount || 0)}
                  </text>
                )}
              />
              {hasActual && (
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="actual"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "hsl(var(--background))", stroke: "hsl(var(--chart-1))", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "hsl(var(--chart-1))", stroke: "hsl(var(--background))" }}
                  connectNulls
                />
              )}
              {hasCurrentPace && (
                <Line
                  type="monotone"
                  dataKey="currentPace"
                  name="currentPace"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  dot={false}
                  connectNulls
                />
              )}
              {hasNeededPace && (
                <Line
                  type="monotone"
                  dataKey="neededPace"
                  name="neededPace"
                  stroke="hsl(var(--chart-4))"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-border/50">
            Not enough data for projection
          </div>
        )}
      </CardContent>
    </Card>
  );
}

