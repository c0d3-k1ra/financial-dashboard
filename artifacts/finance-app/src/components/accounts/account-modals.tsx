import React from "react";
import { formatCurrency } from "@/lib/constants";
import { SensitiveValue } from "@/components/sensitive-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { ResponsiveModal } from "./responsive-modal";

interface AccountType {
  id: number;
  name: string;
  type: string;
  currentBalance: string | number;
  creditLimit?: string | number | null;
  sharedLimitGroup?: string | null;
  billingDueDay?: number | null;
  emiAmount?: string | number | null;
  emiDay?: number | null;
  loanTenure?: number | null;
  interestRate?: string | number | null;
  linkedAccountId?: number | null;
  useInSurplus?: boolean;
  originalLoanAmount?: string | number | null;
  loanStartDate?: string | null;
  emisPaid?: number | null;
}

interface ReconcileModalProps {
  reconcileId: number | null;
  reconcileTarget: AccountType | undefined;
  reconcileCurrentBalance: number;
  reconcileBalance: string;
  setReconcileBalance: (v: string) => void;
  reconcileAdjustment: number;
  handleReconcile: () => void;
  reconcileAccount: { isPending: boolean };
  setReconcileId: (v: number | null) => void;
  isMobile: boolean;
}

export function ReconcileModal({
  reconcileId, reconcileTarget, reconcileCurrentBalance,
  reconcileBalance, setReconcileBalance, reconcileAdjustment,
  handleReconcile, reconcileAccount, setReconcileId, isMobile,
}: ReconcileModalProps) {
  return (
    <ResponsiveModal open={reconcileId !== null} onOpenChange={(open) => { if (!open) { setReconcileId(null); setReconcileBalance(""); } }} title={`Reconcile: ${reconcileTarget?.name ?? ""}`} isMobile={isMobile}>
      <div className="space-y-4 py-2">
        <div className="text-sm font-mono text-muted-foreground">
          Current balance: {formatCurrency(reconcileCurrentBalance)}
        </div>
        <div>
          <Label>Actual Balance (from bank statement)</Label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
            <Input
              type="number"
              step="0.01"
              className="pl-7 font-mono"
              value={reconcileBalance}
              onChange={(e) => setReconcileBalance(e.target.value)}
            />
          </div>
        </div>
        {reconcileBalance && Math.abs(reconcileAdjustment) > 0.01 && (
          <div className={`text-sm font-mono p-2 rounded-md ${reconcileAdjustment >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
            Adjustment: {reconcileAdjustment >= 0 ? "+" : ""}{formatCurrency(reconcileAdjustment)}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => { setReconcileId(null); setReconcileBalance(""); }}>Cancel</Button>
        <Button onClick={handleReconcile} disabled={reconcileAccount.isPending || !reconcileBalance}>
          {reconcileAccount.isPending ? "Reconciling..." : "Reconcile"}
        </Button>
      </DialogFooter>
    </ResponsiveModal>
  );
}

interface EditModalProps {
  editId: number | null;
  editTarget: AccountType | undefined;
  editName: string;
  setEditName: (v: string) => void;
  editCreditLimit: string;
  setEditCreditLimit: (v: string) => void;
  editBillingDueDay: string;
  setEditBillingDueDay: (v: string) => void;
  editSharedLimitGroup: string;
  setEditSharedLimitGroup: (v: string) => void;
  editEmiAmount: string;
  setEditEmiAmount: (v: string) => void;
  editEmiDay: string;
  setEditEmiDay: (v: string) => void;
  editInterestRate: string;
  setEditInterestRate: (v: string) => void;
  editLoanTenure: string;
  setEditLoanTenure: (v: string) => void;
  editOriginalLoanAmount: string;
  setEditOriginalLoanAmount: (v: string) => void;
  editLoanStartDate: string;
  setEditLoanStartDate: (v: string) => void;
  editEmisPaid: string;
  setEditEmisPaid: (v: string) => void;
  editLinkedAccountId: string;
  setEditLinkedAccountId: (v: string) => void;
  editUseInSurplus: boolean;
  setEditUseInSurplus: (v: boolean) => void;
  existingGroups: string[];
  bankAccounts: AccountType[];
  handleEdit: () => void;
  updateAccount: { isPending: boolean };
  setEditId: (v: number | null) => void;
  isMobile: boolean;
}

export function EditModal({
  editId, editTarget,
  editName, setEditName,
  editCreditLimit, setEditCreditLimit,
  editBillingDueDay, setEditBillingDueDay,
  editSharedLimitGroup, setEditSharedLimitGroup,
  editEmiAmount, setEditEmiAmount,
  editEmiDay, setEditEmiDay,
  editInterestRate, setEditInterestRate,
  editLoanTenure, setEditLoanTenure,
  editOriginalLoanAmount, setEditOriginalLoanAmount,
  editLoanStartDate, setEditLoanStartDate,
  editEmisPaid, setEditEmisPaid,
  editLinkedAccountId, setEditLinkedAccountId,
  editUseInSurplus, setEditUseInSurplus,
  existingGroups, bankAccounts,
  handleEdit, updateAccount, setEditId, isMobile,
}: EditModalProps) {
  return (
    <ResponsiveModal open={editId !== null} onOpenChange={(open) => { if (!open) setEditId(null); }} title={`Edit: ${editTarget?.name ?? ""}`} isMobile={isMobile}>
      <div className="space-y-4 py-2">
        <div>
          <Label>Name</Label>
          <Input className="mt-1 font-mono" value={editName} onChange={(e) => setEditName(e.target.value)} />
        </div>
        {editTarget?.type === "credit_card" && (
          <>
            <div>
              <Label>Credit Limit</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2.5 text-muted-foreground">{"\u20B9"}</span>
                <Input type="number" step="0.01" className="pl-7 font-mono" value={editCreditLimit} onChange={(e) => setEditCreditLimit(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Billing Due Day (1-31)</Label>
              <Input type="number" min="1" max="31" step="1" className="mt-1 font-mono" placeholder="e.g. 15" value={editBillingDueDay} onChange={(e) => setEditBillingDueDay(e.target.value)} />
            </div>
            <div>
              <Label>Shared Limit Group</Label>
              <Input
                className="mt-1 font-mono"
                placeholder="Type group name or leave empty"
                list="edit-shared-limit-groups"
                value={editSharedLimitGroup}
                onChange={(e) => setEditSharedLimitGroup(e.target.value)}
              />
              <datalist id="edit-shared-limit-groups">
                {existingGroups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
          </>
        )}
        {editTarget?.type === "loan" && (
          <>
            <div>
              <Label>Original Loan Amount</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2.5 text-muted-foreground">{"\u20B9"}</span>
                <Input type="number" step="0.01" className="pl-7 font-mono" value={editOriginalLoanAmount} onChange={(e) => setEditOriginalLoanAmount(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Monthly EMI</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2.5 text-muted-foreground">{"\u20B9"}</span>
                <Input type="number" step="0.01" className="pl-7 font-mono" value={editEmiAmount} onChange={(e) => setEditEmiAmount(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>EMI Debit Day (1-31)</Label>
              <Input type="number" min="1" max="31" step="1" className="mt-1 font-mono" placeholder="e.g. 5" value={editEmiDay} onChange={(e) => setEditEmiDay(e.target.value)} />
            </div>
            <div>
              <Label>Interest Rate (% p.a.)</Label>
              <Input type="number" step="0.01" className="mt-1 font-mono" placeholder="e.g. 10.5" value={editInterestRate} onChange={(e) => setEditInterestRate(e.target.value)} />
            </div>
            <div>
              <Label>Tenure (months)</Label>
              <Input type="number" min="1" step="1" className="mt-1 font-mono" placeholder="e.g. 36" value={editLoanTenure} onChange={(e) => setEditLoanTenure(e.target.value)} />
            </div>
            <div>
              <Label>Loan Start Date</Label>
              <DatePicker
                date={editLoanStartDate ? new Date(editLoanStartDate + "T00:00:00") : undefined}
                onSelect={(date) => {
                  if (date) {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, "0");
                    const d = String(date.getDate()).padStart(2, "0");
                    setEditLoanStartDate(`${y}-${m}-${d}`);
                  } else {
                    setEditLoanStartDate("");
                  }
                }}
                placeholder="Select start date"
                className="w-full mt-1 font-mono"
              />
            </div>
            <div>
              <Label>EMIs Already Paid</Label>
              <Input type="number" min="0" step="1" className="mt-1 font-mono" placeholder="0" value={editEmisPaid} onChange={(e) => setEditEmisPaid(e.target.value)} />
            </div>
            <div>
              <Label>EMI Debit Account</Label>
              <Select value={editLinkedAccountId} onValueChange={setEditLinkedAccountId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        {editTarget?.type === "bank" && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editUseInSurplus}
              onChange={(e) => setEditUseInSurplus(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
              id="edit-use-in-surplus"
            />
            <Label htmlFor="edit-use-in-surplus" className="text-sm font-normal cursor-pointer">Use in surplus calculation</Label>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
        <Button onClick={handleEdit} disabled={updateAccount.isPending || !editName.trim()}>
          {updateAccount.isPending ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </ResponsiveModal>
  );
}

interface DeleteModalProps {
  deleteAccountId: number | null;
  setDeleteAccountId: (v: number | null) => void;
  confirmDeleteAccount: () => void;
  deleteAccount: { isPending: boolean };
  isMobile: boolean;
}

export function DeleteModal({
  deleteAccountId, setDeleteAccountId,
  confirmDeleteAccount, deleteAccount, isMobile,
}: DeleteModalProps) {
  return (
    <ResponsiveModal open={deleteAccountId !== null} onOpenChange={(open) => { if (!open) setDeleteAccountId(null); }} title="Delete Account" isMobile={isMobile}>
      <p className="text-sm text-muted-foreground py-2">
        Are you sure you want to delete this account? This action cannot be undone.
      </p>
      <DialogFooter>
        <Button variant="ghost" onClick={() => setDeleteAccountId(null)}>Cancel</Button>
        <Button variant="destructive" onClick={confirmDeleteAccount} disabled={deleteAccount.isPending}>
          {deleteAccount.isPending ? "Deleting..." : "Delete"}
        </Button>
      </DialogFooter>
    </ResponsiveModal>
  );
}
