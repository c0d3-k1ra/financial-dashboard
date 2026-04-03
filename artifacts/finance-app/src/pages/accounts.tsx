import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Wallet, CreditCard, TrendingUp, ArrowLeftRight, RefreshCw, Pencil, Landmark, ChevronDown } from "lucide-react";
import TransferModal from "@/components/transfer-modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["bank", "credit_card", "loan"]),
  currentBalance: z.string().optional(),
  creditLimit: z.string().optional(),
  billingDueDay: z.string().optional(),
  emiAmount: z.string().optional(),
  emiDay: z.string().optional(),
  loanTenure: z.string().optional(),
  interestRate: z.string().optional(),
  linkedAccountId: z.string().optional(),
  useInSurplus: z.boolean().optional(),
  sharedLimitGroup: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function Accounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [reconcileId, setReconcileId] = useState<number | null>(null);
  const [reconcileBalance, setReconcileBalance] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCreditLimit, setEditCreditLimit] = useState("");
  const [editBillingDueDay, setEditBillingDueDay] = useState("");
  const [editEmiAmount, setEditEmiAmount] = useState("");
  const [editEmiDay, setEditEmiDay] = useState("");
  const [editLoanTenure, setEditLoanTenure] = useState("");
  const [editInterestRate, setEditInterestRate] = useState("");
  const [editLinkedAccountId, setEditLinkedAccountId] = useState("");
  const [editUseInSurplus, setEditUseInSurplus] = useState(false);
  const [editSharedLimitGroup, setEditSharedLimitGroup] = useState("");
  const [deleteAccountId, setDeleteAccountId] = useState<number | null>(null);
  const [bankOpen, setBankOpen] = useState(true);
  const [ccOpen, setCcOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);

  const { data: accounts, isLoading } = useListAccounts({
    query: { queryKey: getListAccountsQueryKey() },
  });

  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const reconcileAccount = useReconcileAccount();
  const updateAccount = useUpdateAccount();
  const processEmis = useProcessEmis();

  const reconcileTarget = accounts?.find((a) => a.id === reconcileId);
  const reconcileCurrentBalance = reconcileTarget ? Number(reconcileTarget.currentBalance) : 0;
  const reconcileAdjustment = reconcileBalance ? Number(reconcileBalance) - reconcileCurrentBalance : 0;

  const editTarget = accounts?.find((a) => a.id === editId);

  const openEdit = (id: number) => {
    const acct = accounts?.find((a) => a.id === id);
    if (!acct) return;
    setEditId(id);
    setEditName(acct.name);
    setEditCreditLimit(acct.creditLimit ? String(acct.creditLimit) : "");
    setEditBillingDueDay(acct.billingDueDay ? String(acct.billingDueDay) : "");
    setEditEmiAmount(acct.emiAmount ? String(acct.emiAmount) : "");
    setEditEmiDay(acct.emiDay ? String(acct.emiDay) : "");
    setEditLoanTenure(acct.loanTenure ? String(acct.loanTenure) : "");
    setEditInterestRate(acct.interestRate ? String(acct.interestRate) : "");
    setEditLinkedAccountId(acct.linkedAccountId ? String(acct.linkedAccountId) : "");
    setEditUseInSurplus(acct.useInSurplus ?? false);
    setEditSharedLimitGroup(acct.sharedLimitGroup ?? "");
  };

  const handleEdit = () => {
    if (!editId || !editTarget) return;
    updateAccount.mutate(
      {
        id: editId,
        data: {
          name: editName,
          type: editTarget.type,
          currentBalance: String(editTarget.currentBalance),
          creditLimit: editTarget.type === "credit_card" ? editCreditLimit || null : null,
          billingDueDay: editTarget.type === "credit_card" && editBillingDueDay ? Number(editBillingDueDay) : null,
          emiAmount: editTarget.type === "loan" ? editEmiAmount || null : null,
          emiDay: editTarget.type === "loan" && editEmiDay ? Number(editEmiDay) : null,
          loanTenure: editTarget.type === "loan" && editLoanTenure ? Number(editLoanTenure) : null,
          interestRate: editTarget.type === "loan" ? editInterestRate || null : null,
          linkedAccountId: editTarget.type === "loan" && editLinkedAccountId ? Number(editLinkedAccountId) : null,
          useInSurplus: editTarget.type === "bank" ? editUseInSurplus : false,
          sharedLimitGroup: editTarget.type === "credit_card" ? editSharedLimitGroup || null : null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Account updated" });
          setEditId(null);
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMonthlySurplusQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Failed to update account", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const handleReconcile = () => {
    if (!reconcileId || !reconcileBalance) return;
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
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMonthlySurplusQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Reconciliation Failed", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", type: "bank", currentBalance: "0", creditLimit: "", billingDueDay: "", emiAmount: "", emiDay: "", loanTenure: "", interestRate: "", linkedAccountId: "", useInSurplus: false, sharedLimitGroup: "" },
  });

  const watchType = form.watch("type");

  const bankAccounts = accounts?.filter((a) => a.type === "bank") ?? [];
  const ccAccounts = accounts?.filter((a) => a.type === "credit_card") ?? [];
  const loanAccounts = accounts?.filter((a) => a.type === "loan") ?? [];
  const existingGroups = [...new Set(ccAccounts.map((a) => a.sharedLimitGroup).filter(Boolean))] as string[];
  const totalBank = bankAccounts.reduce((s, a) => s + Number(a.currentBalance), 0);
  const totalCcOutstanding = ccAccounts.reduce((s, a) => s + Math.abs(Number(a.currentBalance)), 0);
  const totalLoanOutstanding = loanAccounts.reduce((s, a) => s + Math.abs(Number(a.currentBalance)), 0);
  const netWorth = totalBank - totalCcOutstanding - totalLoanOutstanding;

  const onSubmit = (data: FormValues) => {
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
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Account created" });
          setIsDialogOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMonthlySurplusQueryKey() });
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
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMonthlySurplusQueryKey() });
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
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMonthlySurplusQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Failed to process EMIs", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const allAccounts = [...bankAccounts, ...ccAccounts, ...loanAccounts];
  const nonCcAccounts = [...bankAccounts, ...loanAccounts];

  const getAccountIcon = (type: string) => {
    if (type === "bank") return <Wallet className="w-4 h-4 text-emerald-500" />;
    if (type === "credit_card") return <CreditCard className="w-4 h-4 text-destructive" />;
    return <Landmark className="w-4 h-4 text-amber-500" />;
  };

  const getAccountLabel = (type: string) => {
    if (type === "bank") return "Bank";
    if (type === "credit_card") return "Credit Card";
    return "Loan";
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Manage Accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your bank accounts, credit cards, and loans.</p>
        </div>
        <div className="flex gap-2">
          {loanAccounts.length > 0 && (
            <Button variant="outline" onClick={handleProcessEmis} disabled={processEmis.isPending} className="font-mono text-xs uppercase tracking-wider">
              <Landmark className="w-4 h-4 mr-2" /> {processEmis.isPending ? "Processing..." : "Process EMIs"}
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsTransferOpen(true)} className="font-mono text-xs uppercase tracking-wider">
            <ArrowLeftRight className="w-4 h-4 mr-2" /> Transfer
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono text-xs uppercase tracking-wider">
                <Plus className="w-4 h-4 mr-2" /> Add Account
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>New Account</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. HDFC Savings" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="bank">Bank Account</SelectItem>
                            <SelectItem value="credit_card">Credit Card</SelectItem>
                            <SelectItem value="loan">Loan</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currentBalance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{watchType === "loan" ? "Outstanding Principal" : "Current Balance"}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">{"\u20B9"}</span>
                            <Input type="number" step="0.01" className="pl-7 font-mono" placeholder="0.00" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {watchType === "bank" && (
                    <FormField
                      control={form.control}
                      name="useInSurplus"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value ?? false}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-border accent-primary"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal cursor-pointer">Use in surplus calculation</FormLabel>
                        </FormItem>
                      )}
                    />
                  )}
                  {watchType === "credit_card" && (
                    <>
                      <FormField
                        control={form.control}
                        name="creditLimit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Credit Limit</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground">{"\u20B9"}</span>
                                <Input type="number" step="0.01" className="pl-7 font-mono" placeholder="0.00" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="billingDueDay"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Billing Due Day (1-31)</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" max="31" step="1" className="font-mono" placeholder="e.g. 15" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sharedLimitGroup"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Shared Limit Group</FormLabel>
                            <FormControl>
                              <div>
                                <Input
                                  className="font-mono"
                                  placeholder="Type group name or leave empty"
                                  list="shared-limit-groups"
                                  {...field}
                                />
                                <datalist id="shared-limit-groups">
                                  {existingGroups.map((g) => (
                                    <option key={g} value={g} />
                                  ))}
                                </datalist>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                  {watchType === "loan" && (
                    <>
                      <FormField
                        control={form.control}
                        name="emiAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monthly EMI</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground">{"\u20B9"}</span>
                                <Input type="number" step="0.01" className="pl-7 font-mono" placeholder="0.00" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="emiDay"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>EMI Debit Day (1-31)</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" max="31" step="1" className="font-mono" placeholder="e.g. 5" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="interestRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Interest Rate (%)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" className="font-mono" placeholder="e.g. 10.5" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="loanTenure"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tenure (months)</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" step="1" className="font-mono" placeholder="e.g. 36" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="linkedAccountId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>EMI Debit Account</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select bank account" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {bankAccounts.map((a) => (
                                  <SelectItem key={a.id} value={String(a.id)}>
                                    {a.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                  <DialogFooter className="pt-4">
                    <Button type="submit" disabled={createAccount.isPending} className="w-full">
                      {createAccount.isPending ? "Creating..." : "Create Account"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Net Worth
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-40" />
          ) : (
            <div className={`text-4xl font-bold font-mono tracking-tight ${netWorth >= 0 ? "text-emerald-500" : "text-destructive"}`}>
              {formatCurrency(netWorth)}
            </div>
          )}
          <div className="flex flex-wrap gap-4 mt-2 text-sm font-mono text-muted-foreground">
            <span>Banks: {formatCurrency(totalBank)}</span>
            <span>CC Outstanding: {formatCurrency(totalCcOutstanding)}</span>
            {totalLoanOutstanding > 0 && <span>Loans: {formatCurrency(totalLoanOutstanding)}</span>}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : allAccounts.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-border/50 rounded-lg bg-background/30">
          <p className="text-muted-foreground font-mono text-sm">No accounts yet. Add one to get started.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {bankAccounts.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-card/50 backdrop-blur overflow-hidden">
                <button
                  onClick={() => setBankOpen(!bankOpen)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Wallet className="w-5 h-5 text-emerald-500" />
                    <span className="font-semibold text-sm">Bank Accounts</span>
                    <span className="text-xs text-muted-foreground/60 font-mono">{bankAccounts.length}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold font-mono text-emerald-500">
                      {formatCurrency(bankAccounts.reduce((s, a) => s + Number(a.currentBalance), 0))}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${bankOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {bankOpen && (
                  <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {bankAccounts.map((account) => (
                      <Card key={account.id} className="bg-background/40 border-border/40 hover:border-border/70 transition-colors">
                        <CardContent className="pt-4 pb-3 px-4">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm truncate">{account.name}</p>
                                {account.useInSurplus && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">Surplus</span>
                                )}
                              </div>
                              <p className="text-xl font-bold font-mono mt-1 text-emerald-500">{formatCurrency(account.currentBalance)}</p>
                            </div>
                            <div className="flex items-center gap-0.5 ml-2">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => { setReconcileId(account.id); setReconcileBalance(String(account.currentBalance)); }}>
                                <RefreshCw className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openEdit(account.id)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteAccountId(account.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {ccAccounts.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-card/50 backdrop-blur overflow-hidden">
                <button
                  onClick={() => setCcOpen(!ccOpen)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-5 h-5 text-destructive" />
                    <span className="font-semibold text-sm">Credit Cards</span>
                    <span className="text-xs text-muted-foreground/60 font-mono">{ccAccounts.length}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold font-mono">
                      {formatCurrency(ccAccounts.reduce((s, a) => s + Number(a.currentBalance), 0))}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${ccOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {ccOpen && (
                  <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {ccAccounts.map((account) => {
                      const outstanding = Math.abs(Number(account.currentBalance));
                      const limit = account.creditLimit ? Number(account.creditLimit) : null;
                      let availableLimit: number | null = null;
                      if (account.sharedLimitGroup && limit != null) {
                        const groupTotal = ccAccounts
                          .filter((a) => a.sharedLimitGroup === account.sharedLimitGroup)
                          .reduce((s, a) => s + Math.abs(Number(a.currentBalance)), 0);
                        availableLimit = Math.max(0, limit - groupTotal);
                      } else if (limit != null) {
                        availableLimit = Math.max(0, limit - outstanding);
                      }
                      const usedPct = limit && limit > 0 ? (outstanding / limit) * 100 : 0;
                      const strokeColor = usedPct < 50 ? "#10b981" : usedPct < 80 ? "#eab308" : "#ef4444";
                      const radius = 36;
                      const circumference = 2 * Math.PI * radius;
                      const strokeDash = (Math.min(usedPct, 100) / 100) * circumference;

                      return (
                        <Card key={account.id} className="bg-background/40 border-border/40 hover:border-border/70 transition-colors">
                          <CardContent className="pt-4 pb-3 px-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm truncate">{account.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {account.sharedLimitGroup && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">{account.sharedLimitGroup}</span>
                                  )}
                                  {account.billingDueDay && (
                                    <span className="text-[10px] text-muted-foreground/60 font-mono">Due {account.billingDueDay}th</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5 ml-2">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => { setReconcileId(account.id); setReconcileBalance(String(account.currentBalance)); }}>
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openEdit(account.id)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteAccountId(account.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              {limit != null && (
                                <div className="relative flex-shrink-0">
                                  <svg width="80" height="80" viewBox="0 0 88 88">
                                    <circle cx="44" cy="44" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-secondary" />
                                    <circle cx="44" cy="44" r={radius} fill="none" stroke={strokeColor} strokeWidth="6" strokeDasharray={`${strokeDash} ${circumference}`} strokeLinecap="round" transform="rotate(-90 44 44)" className="transition-all duration-500" />
                                  </svg>
                                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-xs font-bold font-mono" style={{ color: strokeColor }}>{Math.round(usedPct)}%</span>
                                    <span className="text-[9px] text-muted-foreground/60">used</span>
                                  </div>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 font-medium">Outstanding</p>
                                <p className="text-lg font-bold font-mono">{formatCurrency(account.currentBalance)}</p>
                                {limit != null && (
                                  <div className="mt-1.5 space-y-0.5">
                                    <div className="flex justify-between text-[11px] font-mono">
                                      <span className="text-muted-foreground/60">Available</span>
                                      <span className={usedPct < 50 ? "text-emerald-500" : usedPct < 80 ? "text-yellow-500" : "text-destructive"}>{formatCurrency(availableLimit ?? 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] font-mono">
                                      <span className="text-muted-foreground/60">Limit</span>
                                      <span className="text-muted-foreground">{formatCurrency(limit)}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {loanAccounts.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-card/50 backdrop-blur overflow-hidden">
                <button
                  onClick={() => setLoanOpen(!loanOpen)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Landmark className="w-5 h-5 text-amber-500" />
                    <span className="font-semibold text-sm">Loans</span>
                    <span className="text-xs text-muted-foreground/60 font-mono">{loanAccounts.length}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold font-mono text-amber-500">
                      {formatCurrency(loanAccounts.reduce((s, a) => s + Number(a.currentBalance), 0))}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${loanOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {loanOpen && (
                  <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {loanAccounts.map((account) => {
                      const principal = Number(account.currentBalance);
                      const emi = account.emiAmount ? Number(account.emiAmount) : null;
                      const tenure = account.loanTenure ? Number(account.loanTenure) : null;
                      let paidPct = 0;
                      if (emi && tenure) {
                        const totalLoan = emi * tenure;
                        paidPct = totalLoan > 0 ? Math.max(0, Math.min(100, ((totalLoan - principal) / totalLoan) * 100)) : 0;
                      }
                      const barColor = paidPct > 60 ? "bg-emerald-500" : paidPct > 30 ? "bg-yellow-500" : "bg-amber-500";

                      return (
                        <Card key={account.id} className="bg-background/40 border-border/40 hover:border-border/70 transition-colors">
                          <CardContent className="pt-4 pb-3 px-4">
                            <div className="flex justify-between items-start mb-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm truncate">{account.name}</p>
                                {account.emiDay && (
                                  <span className="text-[10px] text-muted-foreground/60 font-mono">EMI on {account.emiDay}th</span>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 ml-2">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => { setReconcileId(account.id); setReconcileBalance(String(account.currentBalance)); }}>
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openEdit(account.id)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteAccountId(account.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-lg font-bold font-mono text-amber-500">{formatCurrency(account.currentBalance)}</p>
                            <div className="mt-2 space-y-1">
                              {emi && (
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span className="text-muted-foreground/60">EMI</span>
                                  <span className="text-muted-foreground">{formatCurrency(emi)}/mo</span>
                                </div>
                              )}
                              {account.interestRate && (
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span className="text-muted-foreground/60">Rate</span>
                                  <span className="text-muted-foreground">{account.interestRate}%</span>
                                </div>
                              )}
                              {account.linkedAccountId && (
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span className="text-muted-foreground/60">From</span>
                                  <span className="text-muted-foreground truncate ml-2">{accounts?.find((a) => a.id === account.linkedAccountId)?.name ?? "—"}</span>
                                </div>
                              )}
                            </div>
                            {emi && tenure && (
                              <div className="mt-2.5">
                                <div className="flex justify-between text-[10px] font-mono mb-1">
                                  <span className="text-muted-foreground/50">{Math.round(paidPct)}% repaid</span>
                                </div>
                                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${paidPct}%` }} />
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <TransferModal open={isTransferOpen} onOpenChange={setIsTransferOpen} />

      <Dialog open={reconcileId !== null} onOpenChange={(open) => { if (!open) { setReconcileId(null); setReconcileBalance(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reconcile: {reconcileTarget?.name}</DialogTitle>
          </DialogHeader>
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
              <div className={`text-sm font-mono p-2 rounded-md ${reconcileAdjustment >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                Adjustment: {reconcileAdjustment >= 0 ? "+" : ""}{formatCurrency(reconcileAdjustment)}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={handleReconcile} disabled={reconcileAccount.isPending || !reconcileBalance}>
              {reconcileAccount.isPending ? "Reconciling..." : "Reconcile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editId !== null} onOpenChange={(open) => { if (!open) setEditId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit: {editTarget?.name}</DialogTitle>
          </DialogHeader>
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
                  <Label>Interest Rate (%)</Label>
                  <Input type="number" step="0.01" className="mt-1 font-mono" placeholder="e.g. 10.5" value={editInterestRate} onChange={(e) => setEditInterestRate(e.target.value)} />
                </div>
                <div>
                  <Label>Tenure (months)</Label>
                  <Input type="number" min="1" step="1" className="mt-1 font-mono" placeholder="e.g. 36" value={editLoanTenure} onChange={(e) => setEditLoanTenure(e.target.value)} />
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
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={handleEdit} disabled={updateAccount.isPending || !editName.trim()}>
              {updateAccount.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteAccountId !== null} onOpenChange={(open) => { if (!open) setDeleteAccountId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete this account? This action cannot be undone.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDeleteAccount} disabled={deleteAccount.isPending}>
              {deleteAccount.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
