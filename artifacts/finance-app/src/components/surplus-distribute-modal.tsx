import { useState } from "react";
import { useGetMonthlySurplus } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogHeader,
  DialogTitle,
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

export default function SurplusDistributeModal({
  goals,
  accounts,
  month,
  onDistribute,
  isPending,
}: {
  goals: Array<{ id: number; name: string; targetAmount: string; currentAmount: string; accountId?: number | null }>;
  accounts: Array<{ id: number; name: string; currentBalance: string }>;
  month: string;
  onDistribute: (data: { month: string; sourceAccountId: number; allocations: Array<{ goalId: number; amount: string }> }) => void;
  isPending: boolean;
}) {
  const [sourceAccountId, setSourceAccountId] = useState<string>("");
  const [amounts, setAmounts] = useState<Record<number, string>>({});

  const { data: surplusData } = useGetMonthlySurplus({ month });
  const monthlySurplus = surplusData ? Number(surplusData.surplus) : 0;

  const sourceAccount = accounts.find((a) => a.id === Number(sourceAccountId));
  const sourceBalance = sourceAccount ? Number(sourceAccount.currentBalance) : 0;
  const totalAllocated = Object.values(amounts).reduce((s, v) => s + (Number(v) || 0), 0);
  const exceedsSurplus = monthlySurplus > 0 && totalAllocated > monthlySurplus;
  const exceedsBalance = totalAllocated > sourceBalance;

  const handleSubmit = () => {
    if (!sourceAccountId) return;
    const allocations = Object.entries(amounts)
      .filter(([, v]) => Number(v) > 0)
      .map(([goalId, amount]) => ({ goalId: Number(goalId), amount }));

    if (allocations.length === 0) return;
    onDistribute({ month, sourceAccountId: Number(sourceAccountId), allocations });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Distribute Surplus — {month}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="p-3 rounded-lg glass-2 font-mono text-xs space-y-1">
          <div className="flex justify-between">
            <span className="font-bold">Available Surplus:</span>
            <span className={monthlySurplus <= 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}>
              {surplusData ? formatCurrency(surplusData.surplus) : "—"}
            </span>
          </div>
        </div>

        {monthlySurplus <= 0 && surplusData && (
          <div className="text-xs font-mono text-destructive p-2 rounded bg-destructive/10 border border-destructive/30">
            No surplus available this month. Distribution requires positive surplus.
          </div>
        )}

        <div>
          <Label>Source Account</Label>
          <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Select source account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.name} ({formatCurrency(a.currentBalance)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {sourceAccountId && (
          <div className="text-xs font-mono text-muted-foreground">
            Account Balance: {formatCurrency(sourceBalance)}
          </div>
        )}

        <div className="space-y-3 max-h-60 overflow-y-auto">
          {goals.map((goal) => {
            const remaining = Number(goal.targetAmount) - Number(goal.currentAmount);
            const needsTransfer = goal.accountId && goal.accountId !== Number(sourceAccountId);

            return (
              <div key={goal.id} className="flex items-center gap-3 p-2 rounded-lg glass-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{goal.name}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    Remaining: {formatCurrency(Math.max(0, remaining))}
                    {needsTransfer && <span className="ml-1 text-yellow-400">⚡ auto-transfer</span>}
                  </div>
                </div>
                <Input
                  type="number"
                  className="w-28 text-right font-mono text-sm"
                  placeholder="0"
                  value={amounts[goal.id] || ""}
                  onChange={(e) => setAmounts({ ...amounts, [goal.id]: e.target.value })}
                />
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center p-3 rounded-lg glass-2 font-mono text-sm">
          <span>Total: {formatCurrency(totalAllocated)}</span>
          <div className="flex flex-col items-end gap-0.5">
            {exceedsBalance && (
              <span className="text-destructive text-xs">Exceeds account balance!</span>
            )}
            {exceedsSurplus && !exceedsBalance && (
              <span className="text-destructive text-xs">Exceeds monthly surplus!</span>
            )}
          </div>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button
          onClick={handleSubmit}
          disabled={isPending || !sourceAccountId || totalAllocated === 0 || exceedsBalance || exceedsSurplus || monthlySurplus <= 0}
        >
          {isPending ? "Distributing..." : "Distribute"}
        </Button>
      </DialogFooter>
    </>
  );
}
