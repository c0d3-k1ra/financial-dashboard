import { useState, useCallback } from "react";
import {
  useListAccounts,
  getListAccountsQueryKey,
  useCreateAccount,
  useDeleteAccount,
  useReconcileAccount,
  useUpdateAccount,
  useProcessEmis,
  getGetDashboardSummaryQueryKey,
  getGetMonthlySurplusQueryKey,
} from "@workspace/api-client-react";
import { formatCurrency, getApiErrorMessage } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/query-error-state";
import { Plus, Wallet, ArrowLeftRight, Landmark } from "lucide-react";
import TransferModal from "@/components/transfer-modal";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

import { AccountCardSections } from "@/components/accounts/account-cards";
import { ReconcileModal, EditModal, DeleteModal } from "@/components/accounts/account-modals";
import { NetWorthCard } from "@/components/accounts/net-worth-card";
import { AccountCreateFormFields, useAccountForm, type AccountFormValues } from "@/components/accounts/account-form";

export default function Accounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: accounts, isLoading, isError, refetch } = useListAccounts({
    query: { queryKey: getListAccountsQueryKey() },
  });

  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const reconcileAccount = useReconcileAccount();
  const updateAccount = useUpdateAccount();
  const processEmis = useProcessEmis();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [reconcileId, setReconcileId] = useState<number | null>(null);
  const [reconcileBalance, setReconcileBalance] = useState("");
  const [deleteAccountId, setDeleteAccountId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCreditLimit, setEditCreditLimit] = useState("");
  const [editBillingDueDay, setEditBillingDueDay] = useState("");
  const [editSharedLimitGroup, setEditSharedLimitGroup] = useState("");
  const [editUseInSurplus, setEditUseInSurplus] = useState(false);
  const [editEmiAmount, setEditEmiAmount] = useState("");
  const [editEmiDay, setEditEmiDay] = useState("");
  const [editInterestRate, setEditInterestRate] = useState("");
  const [editLoanTenure, setEditLoanTenure] = useState("");
  const [editOriginalLoanAmount, setEditOriginalLoanAmount] = useState("");
  const [editLoanStartDate, setEditLoanStartDate] = useState("");
  const [editEmisPaid, setEditEmisPaid] = useState("");
  const [editLinkedAccountId, setEditLinkedAccountId] = useState("");
  const [bankOpen, setBankOpen] = useState(true);
  const [ccOpen, setCcOpen] = useState(true);
  const [loanOpen, setLoanOpen] = useState(true);

  const reconcileTarget = accounts?.find((a) => a.id === reconcileId);
  const reconcileCurrentBalance = Number(reconcileTarget?.currentBalance ?? 0);
  const reconcileAdjustment = Number(reconcileBalance || 0) - reconcileCurrentBalance;
  const editTarget = accounts?.find((a) => a.id === editId);

  const openEdit = useCallback((id: number) => {
    const account = accounts?.find((a) => a.id === id);
    if (!account) return;
    setEditId(id);
    setEditName(account.name);
    setEditCreditLimit(account.creditLimit ? String(account.creditLimit) : "");
    setEditBillingDueDay(account.billingDueDay ? String(account.billingDueDay) : "");
    setEditSharedLimitGroup(account.sharedLimitGroup ?? "");
    setEditUseInSurplus(account.useInSurplus ?? false);
    setEditEmiAmount(account.emiAmount ? String(account.emiAmount) : "");
    setEditEmiDay(account.emiDay ? String(account.emiDay) : "");
    setEditInterestRate(account.interestRate ? String(account.interestRate) : "");
    setEditLoanTenure(account.loanTenure ? String(account.loanTenure) : "");
    setEditOriginalLoanAmount(account.originalLoanAmount ? String(account.originalLoanAmount) : "");
    setEditLoanStartDate(account.loanStartDate ?? "");
    setEditEmisPaid(account.emisPaid != null ? String(account.emisPaid) : "0");
    setEditLinkedAccountId(account.linkedAccountId ? String(account.linkedAccountId) : "");
  }, [accounts]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMonthlySurplusQueryKey() });
  };

  const handleEdit = () => {
    if (editId === null || !editName.trim()) return;
    updateAccount.mutate(
      {
        id: editId,
        data: {
          name: editName,
          type: editTarget!.type,
          creditLimit: editTarget?.type === "credit_card" ? editCreditLimit || null : undefined,
          billingDueDay: editTarget?.type === "credit_card" && editBillingDueDay ? Number(editBillingDueDay) : undefined,
          sharedLimitGroup: editTarget?.type === "credit_card" ? editSharedLimitGroup || null : undefined,
          useInSurplus: editTarget?.type === "bank" ? editUseInSurplus : undefined,
          emiAmount: editTarget?.type === "loan" ? editEmiAmount || null : undefined,
          emiDay: editTarget?.type === "loan" && editEmiDay ? Number(editEmiDay) : undefined,
          interestRate: editTarget?.type === "loan" ? editInterestRate || null : undefined,
          loanTenure: editTarget?.type === "loan" && editLoanTenure ? Number(editLoanTenure) : undefined,
          originalLoanAmount: editTarget?.type === "loan" ? editOriginalLoanAmount || null : undefined,
          loanStartDate: editTarget?.type === "loan" ? editLoanStartDate || null : undefined,
          emisPaid: editTarget?.type === "loan" && editEmisPaid ? Number(editEmisPaid) : undefined,
          linkedAccountId: editTarget?.type === "loan" && editLinkedAccountId ? Number(editLinkedAccountId) : undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Account updated" });
          setEditId(null);
          invalidateAll();
        },
        onError: (err) => {
          toast({ title: "Failed to update account", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const handleReconcile = () => {
    if (reconcileId === null || !reconcileBalance) return;
    reconcileAccount.mutate(
      { id: reconcileId, data: { actualBalance: reconcileBalance } },
      {
        onSuccess: (res) => {
          toast({
            title: "Account Reconciled",
            description: `Adjusted by ${formatCurrency(res.adjustment)}. New balance: ${formatCurrency(res.newBalance)}`,
          });
          setReconcileId(null);
          setReconcileBalance("");
          invalidateAll();
        },
        onError: (err) => {
          toast({ title: "Reconciliation Failed", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const form = useAccountForm();

  const bankAccounts = accounts?.filter((a) => a.type === "bank") ?? [];
  const ccAccounts = accounts?.filter((a) => a.type === "credit_card") ?? [];
  const loanAccounts = accounts?.filter((a) => a.type === "loan") ?? [];
  const existingGroups = [...new Set(ccAccounts.map((a) => a.sharedLimitGroup).filter((g): g is string => Boolean(g)))];
  const totalBank = bankAccounts.reduce((s, a) => s + Number(a.currentBalance), 0);
  const totalCcOutstanding = ccAccounts.reduce((s, a) => s + Math.abs(Number(a.currentBalance)), 0);
  const totalLoanOutstanding = loanAccounts.reduce((s, a) => s + Math.abs(Number(a.currentBalance)), 0);
  const netWorth = totalBank - totalCcOutstanding - totalLoanOutstanding;

  const onSubmit = (data: AccountFormValues) => {
    createAccount.mutate(
      {
        data: {
          name: data.name,
          type: data.type,
          currentBalance: data.currentBalance || "0",
          creditLimit: data.type === "credit_card" ? data.creditLimit || null : null,
          billingDueDay: data.type === "credit_card" && data.billingDueDay ? Number(data.billingDueDay) : null,
          emiAmount: data.type === "loan" ? data.emiAmount || null : null,
          emiDay: data.type === "loan" && data.emiDay ? Number(data.emiDay) : null,
          loanTenure: data.type === "loan" && data.loanTenure ? Number(data.loanTenure) : null,
          interestRate: data.type === "loan" ? data.interestRate || null : null,
          linkedAccountId: data.type === "loan" && data.linkedAccountId ? Number(data.linkedAccountId) : null,
          useInSurplus: data.type === "bank" ? (data.useInSurplus ?? false) : false,
          sharedLimitGroup: data.type === "credit_card" ? data.sharedLimitGroup || null : null,
          originalLoanAmount: data.type === "loan" ? data.originalLoanAmount || null : null,
          loanStartDate: data.type === "loan" ? data.loanStartDate || null : null,
          emisPaid: data.type === "loan" && data.emisPaid ? Number(data.emisPaid) : null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Account created" });
          setIsDialogOpen(false);
          form.reset();
          invalidateAll();
        },
        onError: (err) => {
          toast({ title: "Failed to create account", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const confirmDeleteAccount = () => {
    if (deleteAccountId === null) return;
    deleteAccount.mutate(
      { id: deleteAccountId },
      {
        onSuccess: () => {
          toast({ title: "Account deleted" });
          setDeleteAccountId(null);
          invalidateAll();
        },
        onError: (err) => {
          toast({ title: "Failed to delete account", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const handleProcessEmis = () => {
    const d = new Date();
    const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    processEmis.mutate(
      { data: { month: currentMonth } },
      {
        onSuccess: (res) => {
          if (res.processed === 0) {
            toast({ title: "No EMIs to process", description: res.message || "All loans are up to date." });
          } else {
            toast({
              title: `${res.processed} EMI(s) processed`,
              description: res.results?.map((r) => `${r.accountName}: ${formatCurrency(r.emiAmount)}`).join(", "),
            });
          }
          invalidateAll();
        },
        onError: (err) => {
          toast({ title: "Failed to process EMIs", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const allAccounts = [...bankAccounts, ...ccAccounts, ...loanAccounts];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Manage Accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your bank accounts, credit cards, and loans.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {loanAccounts.length > 0 && (
            <Button variant="outline" onClick={handleProcessEmis} disabled={processEmis.isPending} className="font-mono text-xs uppercase tracking-wider">
              <Landmark className="w-4 h-4 mr-2" /> {processEmis.isPending ? "Processing..." : "Process EMIs"}
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsTransferOpen(true)} className="font-mono text-xs uppercase tracking-wider">
            <ArrowLeftRight className="w-4 h-4 mr-2" /> Transfer
          </Button>
          <Button className="font-mono text-xs uppercase tracking-wider" onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Account
          </Button>
          <Dialog open={!isMobile && isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>New Account</DialogTitle>
              </DialogHeader>
              <AccountCreateFormFields
                form={form}
                onSubmit={onSubmit}
                isPending={createAccount.isPending}
                bankAccounts={bankAccounts}
                existingGroups={existingGroups}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <NetWorthCard
        netWorth={netWorth}
        totalBank={totalBank}
        totalCcOutstanding={totalCcOutstanding}
        totalLoanOutstanding={totalLoanOutstanding}
        isLoading={isLoading}
        isError={isError}
        refetch={refetch}
      />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((section) => (
            <div key={section} className="glass-1 overflow-hidden">
              <div className="px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="w-5 h-5 rounded" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2].map((card) => (
                  <div key={card} className="glass-2 p-4 space-y-3">
                    <div className="flex justify-between">
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-6 w-24" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="w-7 h-7 rounded" />
                        <Skeleton className="w-7 h-7 rounded" />
                        <Skeleton className="w-7 h-7 rounded" />
                      </div>
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <QueryErrorState onRetry={() => refetch()} message="Failed to load accounts" />
      ) : allAccounts.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-[var(--divider-color)] rounded-xl glass-1">
          <Wallet className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium text-sm">Add your first bank account to start tracking</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Track balances, credit limits, and loan progress all in one place.</p>
        </div>
      ) : (
        <AccountCardSections
          bankAccounts={bankAccounts}
          ccAccounts={ccAccounts}
          loanAccounts={loanAccounts}
          accounts={accounts}
          bankOpen={bankOpen}
          setBankOpen={setBankOpen}
          ccOpen={ccOpen}
          setCcOpen={setCcOpen}
          loanOpen={loanOpen}
          setLoanOpen={setLoanOpen}
          openEdit={openEdit}
          setReconcileId={setReconcileId}
          setReconcileBalance={setReconcileBalance}
          setDeleteAccountId={setDeleteAccountId}
        />
      )}

      <TransferModal open={isTransferOpen} onOpenChange={setIsTransferOpen} />

      <ReconcileModal
        reconcileId={reconcileId}
        reconcileTarget={reconcileTarget}
        reconcileCurrentBalance={reconcileCurrentBalance}
        reconcileBalance={reconcileBalance}
        setReconcileBalance={setReconcileBalance}
        reconcileAdjustment={reconcileAdjustment}
        handleReconcile={handleReconcile}
        reconcileAccount={reconcileAccount}
        setReconcileId={setReconcileId}
        isMobile={isMobile}
      />

      <EditModal
        editId={editId}
        editTarget={editTarget}
        editName={editName}
        setEditName={setEditName}
        editCreditLimit={editCreditLimit}
        setEditCreditLimit={setEditCreditLimit}
        editBillingDueDay={editBillingDueDay}
        setEditBillingDueDay={setEditBillingDueDay}
        editSharedLimitGroup={editSharedLimitGroup}
        setEditSharedLimitGroup={setEditSharedLimitGroup}
        editEmiAmount={editEmiAmount}
        setEditEmiAmount={setEditEmiAmount}
        editEmiDay={editEmiDay}
        setEditEmiDay={setEditEmiDay}
        editInterestRate={editInterestRate}
        setEditInterestRate={setEditInterestRate}
        editLoanTenure={editLoanTenure}
        setEditLoanTenure={setEditLoanTenure}
        editOriginalLoanAmount={editOriginalLoanAmount}
        setEditOriginalLoanAmount={setEditOriginalLoanAmount}
        editLoanStartDate={editLoanStartDate}
        setEditLoanStartDate={setEditLoanStartDate}
        editEmisPaid={editEmisPaid}
        setEditEmisPaid={setEditEmisPaid}
        editLinkedAccountId={editLinkedAccountId}
        setEditLinkedAccountId={setEditLinkedAccountId}
        editUseInSurplus={editUseInSurplus}
        setEditUseInSurplus={setEditUseInSurplus}
        existingGroups={existingGroups}
        bankAccounts={bankAccounts}
        handleEdit={handleEdit}
        updateAccount={updateAccount}
        setEditId={setEditId}
        isMobile={isMobile}
      />

      <DeleteModal
        deleteAccountId={deleteAccountId}
        setDeleteAccountId={setDeleteAccountId}
        confirmDeleteAccount={confirmDeleteAccount}
        deleteAccount={deleteAccount}
        isMobile={isMobile}
      />

      <Sheet open={isMobile && isDialogOpen} onOpenChange={setIsDialogOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>New Account</SheetTitle>
          </SheetHeader>
          <AccountCreateFormFields
            form={form}
            onSubmit={onSubmit}
            isPending={createAccount.isPending}
            bankAccounts={bankAccounts}
            existingGroups={existingGroups}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
