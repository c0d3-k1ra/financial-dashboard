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
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
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
import { Plus, Target, AlertTriangle, TrendingUp, Trash2, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const CATEGORY_OPTIONS = ["Emergency", "Debt", "Travel", "Purchase", "General"];
const CATEGORY_ICONS: Record<string, string> = {
  Emergency: "🛡️",
  Debt: "💳",
  Travel: "✈️",
  Purchase: "🛍️",
  General: "🎯",
};

const STATUS_COLORS: Record<string, string> = {
  "On Track": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "At Risk": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Behind": "bg-red-500/20 text-red-400 border-red-500/30",
  "Not Started": "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  "Achieved": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export default function Goals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);

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

  const { data: goals, isLoading: isLoadingGoals } = useListGoals();
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
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="font-mono text-xs uppercase tracking-wider">
                <Plus className="w-4 h-4 mr-2" /> Create Goal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Goal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Name</Label>
                  <Input
                    placeholder="e.g., Vacation Fund"
                    value={newGoal.name}
                    onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Target Amount (₹)</Label>
                  <Input
                    type="number"
                    placeholder="50000"
                    value={newGoal.targetAmount}
                    onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Target Date (optional)</Label>
                  <DatePicker
                    date={newGoal.targetDate ? new Date(newGoal.targetDate + "T00:00:00") : undefined}
                    onSelect={(d) => setNewGoal({ ...newGoal, targetDate: d ? format(d, "yyyy-MM-dd") : "" })}
                    placeholder="Pick a date"
                    className="w-full"
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={newGoal.categoryType} onValueChange={(v) => setNewGoal({ ...newGoal, categoryType: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_ICONS[c]} {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Funding Account</Label>
                  <Select value={newGoal.accountId} onValueChange={(v) => setNewGoal({ ...newGoal, accountId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button onClick={handleCreateGoal} disabled={createGoal.isPending}>
                  {createGoal.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
      </div>

      {waterfall?.stressTest && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 text-yellow-300">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div className="text-sm font-mono">
            <span className="font-bold">Goal Rich but Cash Poor</span> — your unallocated cash (
            {formatCurrency(waterfall.remainingLiquidCash)}) is below your monthly living expenses (
            {formatCurrency(waterfall.avgMonthlyLivingExpenses)}).
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {selectedGoalId ? (
          <GoalProjectionChart goalId={selectedGoalId} />
        ) : (
          <Card className="bg-card/50 backdrop-blur border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Goal Projection</CardTitle>
              <CardDescription>Click a goal card to see its 12-month projection</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-border/50">
              Select a goal to view projection
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">
          {activeGoals.length > 0 ? `Active Goals (${activeGoals.length})` : "Goals"}
        </h2>
        {isLoadingGoals ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-card/50">
                <CardContent className="p-6 space-y-4">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
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
                  className={`bg-card/50 backdrop-blur border-border/60 cursor-pointer transition-all hover:border-primary/40 ${
                    isSelected ? "border-primary/60 ring-1 ring-primary/30" : ""
                  } ${goal.status === "Achieved" ? "opacity-70" : ""}`}
                  onClick={() => setSelectedGoalId(isSelected ? null : goal.id)}
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
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : STATUS_COLORS[goal.statusIndicator] || ""
                          }`}
                        >
                          {goal.status === "Achieved" ? "Achieved" : goal.statusIndicator}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(goal);
                          }}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGoal(goal.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <span className="font-mono text-lg font-bold">{formatCurrency(current)}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          <Target className="w-3 h-3 inline mr-0.5" />
                          {formatCurrency(target)}
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
                        Velocity: {formatCurrency(goal.velocity)}/mo
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-card/50 backdrop-blur border-border/60">
            <CardContent className="py-12 text-center text-muted-foreground font-mono text-sm">
              No goals created yet. Click "Create Goal" to get started.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditGoal(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>
          {editGoal && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Name</Label>
                <Input
                  value={editGoal.name}
                  onChange={(e) => setEditGoal({ ...editGoal, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Target Amount (₹)</Label>
                <Input
                  type="number"
                  value={editGoal.targetAmount}
                  onChange={(e) => setEditGoal({ ...editGoal, targetAmount: e.target.value })}
                />
              </div>
              <div>
                <Label>Current Amount (₹)</Label>
                <Input
                  type="number"
                  value={editGoal.currentAmount}
                  onChange={(e) => setEditGoal({ ...editGoal, currentAmount: e.target.value })}
                />
              </div>
              <div>
                <Label>Target Date (optional)</Label>
                <DatePicker
                  date={editGoal.targetDate ? new Date(editGoal.targetDate + "T00:00:00") : undefined}
                  onSelect={(d) => setEditGoal({ ...editGoal, targetDate: d ? format(d, "yyyy-MM-dd") : "" })}
                  placeholder="Pick a date"
                  className="w-full"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={editGoal.categoryType} onValueChange={(v) => setEditGoal({ ...editGoal, categoryType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_ICONS[c]} {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Funding Account</Label>
                <Select value={editGoal.accountId} onValueChange={(v) => setEditGoal({ ...editGoal, accountId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={handleUpdateGoal} disabled={updateGoal.isPending}>
              {updateGoal.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GoalProjectionChart({ goalId }: { goalId: number }) {
  const { data: projection, isLoading } = useGetGoalProjectionById(
    goalId,
    { query: { queryKey: getGetGoalProjectionByIdQueryKey(goalId) } }
  );

  const hasVelocity = projection?.some(
    (p, i) => i > 0 && Number(p.projectedBalance) !== Number(projection[0].projectedBalance)
  );
  const hasNeeded = projection?.some((p) => p.neededBalance != null);

  return (
    <Card className="bg-card/50 backdrop-blur border-border/60">
      <CardHeader>
        <CardTitle className="text-lg">Goal Projection</CardTitle>
        <CardDescription>
          {hasVelocity
            ? "Solid line = projected growth based on your avg monthly savings from past distributions"
            : hasNeeded
              ? "No distributions yet — dashed line shows monthly savings needed to hit target date"
              : "No distributions yet — use End Cycle to start tracking your savings pace"}
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] w-full pt-4">
        {isLoading ? (
          <Skeleton className="w-full h-full" />
        ) : projection && projection.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projection.map(p => ({
              month: p.month,
              projectedBalance: Number(p.projectedBalance),
              neededBalance: p.neededBalance != null ? Number(p.neededBalance) : null,
              targetAmount: Number(p.targetAmount),
            }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                tickFormatter={(val) => `₹${val / 1000}k`}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <ReferenceLine
                y={Number(projection[0]?.targetAmount || 0)}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                label={{
                  position: "top",
                  value: "Target",
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                }}
              />
              <Line
                type="monotone"
                dataKey="projectedBalance"
                name="Current Pace"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ r: 4, fill: "hsl(var(--background))", stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))" }}
              />
              {hasNeeded && (
                <Line
                  type="monotone"
                  dataKey="neededBalance"
                  name="Needed Pace"
                  stroke="hsl(var(--chart-4, 43 74% 66%))"
                  strokeWidth={2}
                  strokeDasharray="6 3"
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

