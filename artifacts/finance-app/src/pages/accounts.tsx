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
import { formatCurrency, getApiErrorMessage, getOrdinalSuffix } from "@/lib/constants";
import { SensitiveValue } from "@/components/sensitive-value";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, Wallet, CreditCard, TrendingUp, TrendingDown, ArrowLeftRight, RefreshCw, Pencil, Landmark, ChevronDown } from "lucide-react";
import TransferModal from "@/components/transfer-modal";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();
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

      <Card className="glass-card glass-animate-in glass-stagger-1 rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-2">
            {netWorth >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-destructive" />} Net Worth
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-60" />
            </div>
          ) : (
            <>
              <SensitiveValue as="div" className={`text-4xl font-bold font-mono tracking-tight ${netWorth >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {formatCurrency(netWorth)}
              </SensitiveValue>

              {(totalBank > 0 || totalCcOutstanding > 0 || totalLoanOutstanding > 0) && (() => {
                const totalAbs = totalBank + totalCcOutstanding + totalLoanOutstanding;
                const bankPct = totalAbs > 0 ? (totalBank / totalAbs) * 100 : 0;
                const ccPct = totalAbs > 0 ? (totalCcOutstanding / totalAbs) * 100 : 0;
                const loanPct = totalAbs > 0 ? (totalLoanOutstanding / totalAbs) * 100 : 0;
                return (
                  <div className="mt-3 space-y-2">
                    <div className="w-full h-3 rounded-full overflow-hidden flex bg-secondary/50">
                      {bankPct > 0 && (
                        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${bankPct}%` }} />
                      )}
                      {ccPct > 0 && (
                        <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${ccPct}%` }} />
                      )}
                      {loanPct > 0 && (
                        <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${loanPct}%` }} />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                        <span className="text-muted-foreground">Assets</span>
                        <SensitiveValue className="text-emerald-500 font-semibold">{formatCurrency(totalBank)}</SensitiveValue>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />
                        <span className="text-muted-foreground">CC Debt</span>
                        <SensitiveValue className="text-red-500 font-semibold">{formatCurrency(totalCcOutstanding)}</SensitiveValue>
                      </span>
                      {totalLoanOutstanding > 0 && (
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                          <span className="text-muted-foreground">Loans</span>
                          <SensitiveValue className="text-amber-500 font-semibold">{formatCurrency(totalLoanOutstanding)}</SensitiveValue>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>

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
      ) : allAccounts.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-[var(--divider-color)] rounded-xl glass-1">
          <Wallet className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium text-sm">Add your first bank account to start tracking</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Track balances, credit limits, and loan progress all in one place.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {bankAccounts.length > 0 && (
              <div className="glass-1 overflow-hidden">
                <button
                  onClick={() => setBankOpen(!bankOpen)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--glass-hover)] transition-colors border-b border-[var(--divider-color)]"
                >
                  <div className="flex items-center gap-2.5">
                    <Wallet className="w-5 h-5 text-emerald-500" />
                    <span className="font-semibold text-sm">Bank Accounts</span>
                    <span className="text-xs text-muted-foreground/60 font-mono">{bankAccounts.length}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <SensitiveValue className="text-sm font-bold font-mono text-emerald-500">
                      {formatCurrency(bankAccounts.reduce((s, a) => s + Number(a.currentBalance), 0))}
                    </SensitiveValue>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${bankOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {bankOpen && (
                  <div className="px-4 pb-4 pt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <TooltipProvider delayDuration={300}>
                    {bankAccounts.map((account) => (
                      <Card key={account.id} className="glass-2 hover:bg-[var(--glass-hover)] hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-300">
                        <CardContent className="pt-4 pb-3 px-4">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm truncate">{account.name}</p>
                                {account.useInSurplus && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium status-badge-success">Surplus</span>
                                )}
                              </div>
                              <SensitiveValue as="div" className="text-xl font-bold font-mono mt-1 text-emerald-500">{formatCurrency(account.currentBalance)}</SensitiveValue>
                            </div>
                            <div className="flex items-center gap-1 md:gap-4 ml-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-primary" onClick={() => { setReconcileId(account.id); setReconcileBalance(String(account.currentBalance)); }}>
                                    <RefreshCw className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Sync Balance</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-primary" onClick={() => openEdit(account.id)}>
                                    <Pencil className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Account</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteAccountId(account.id)}>
                                    <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete Account</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    </TooltipProvider>
                  </div>
                )}
              </div>
            )}

            {ccAccounts.length > 0 && (
              <div className="glass-1 overflow-hidden">
                <button
                  onClick={() => setCcOpen(!ccOpen)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--glass-hover)] transition-colors border-b border-[var(--divider-color)]"
                >
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-5 h-5 text-destructive" />
                    <span className="font-semibold text-sm">Credit Cards</span>
                    <span className="text-xs text-muted-foreground/60 font-mono">{ccAccounts.length}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <SensitiveValue className="text-sm font-bold font-mono text-red-500">
                      {formatCurrency(Math.abs(ccAccounts.reduce((s, a) => s + Number(a.currentBalance), 0)))}
                    </SensitiveValue>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${ccOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {ccOpen && (
                  <div className="px-4 pb-4 pt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <TooltipProvider delayDuration={300}>
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
                      const strokeColor = usedPct <= 30 ? "hsl(var(--chart-1))" : usedPct <= 50 ? "hsl(var(--chart-4))" : "hsl(var(--chart-3))";
                      const radius = 22;
                      const circumference = 2 * Math.PI * radius;
                      const strokeDash = (Math.min(usedPct, 100) / 100) * circumference;

                      return (
                        <Card key={account.id} className="glass-2 hover:bg-[var(--glass-hover)] hover:shadow-md hover:shadow-red-500/5 transition-all duration-300">
                          <CardContent className="pt-4 pb-3 px-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm truncate">{account.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {account.sharedLimitGroup && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium status-badge-info">{account.sharedLimitGroup}</span>
                                  )}
                                  {account.billingDueDay && (
                                    <span className="text-[10px] text-muted-foreground/60 font-mono">Due {getOrdinalSuffix(account.billingDueDay)}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 md:gap-4 ml-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-primary" onClick={() => { setReconcileId(account.id); setReconcileBalance(String(account.currentBalance)); }}>
                                      <RefreshCw className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Sync Balance</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-primary" onClick={() => openEdit(account.id)}>
                                      <Pencil className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit Account</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteAccountId(account.id)}>
                                      <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete Account</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              {limit != null && (
                                <div className="relative flex-shrink-0" style={{ width: 56, height: 56 }}>
                                  <svg width="56" height="56" viewBox="0 0 56 56">
                                    <circle cx="28" cy="28" r={radius} fill="none" stroke="currentColor" strokeWidth="5" className="text-secondary" />
                                    <circle cx="28" cy="28" r={radius} fill="none" stroke={strokeColor} strokeWidth="5" strokeDasharray={`${strokeDash} ${circumference}`} strokeLinecap="round" transform="rotate(-90 28 28)" className="transition-all duration-500" />
                                  </svg>
                                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-[10px] font-bold font-mono" style={{ color: strokeColor }}>{Math.round(usedPct)}%</span>
                                  </div>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 font-medium">Outstanding</p>
                                <SensitiveValue as="div" className="text-lg font-bold font-mono">{formatCurrency(Math.abs(Number(account.currentBalance)))}</SensitiveValue>
                                {limit != null && (
                                  <div className="mt-1.5 space-y-0.5">
                                    <div className="flex justify-between text-[11px] font-mono">
                                      <span className="text-muted-foreground/60">Available</span>
                                      <SensitiveValue className={usedPct <= 30 ? "text-emerald-500" : usedPct <= 50 ? "text-yellow-500" : "text-destructive"}>{formatCurrency(availableLimit ?? 0)}</SensitiveValue>
                                    </div>
                                    <div className="flex justify-between text-[11px] font-mono">
                                      <span className="text-muted-foreground/60">Limit</span>
                                      <SensitiveValue className="text-muted-foreground">{formatCurrency(limit)}</SensitiveValue>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    </TooltipProvider>
                  </div>
                )}
              </div>
            )}

            {loanAccounts.length > 0 && (
              <div className="glass-1 overflow-hidden">
                <button
                  onClick={() => setLoanOpen(!loanOpen)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--glass-hover)] transition-colors border-b border-[var(--divider-color)]"
                >
                  <div className="flex items-center gap-2.5">
                    <Landmark className="w-5 h-5 text-amber-500" />
                    <span className="font-semibold text-sm">Loans</span>
                    <span className="text-xs text-muted-foreground/60 font-mono">{loanAccounts.length}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <SensitiveValue className="text-sm font-bold font-mono text-red-500">
                      {formatCurrency(Math.abs(loanAccounts.reduce((s, a) => s + Number(a.currentBalance), 0)))}
                    </SensitiveValue>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${loanOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {loanOpen && (
                  <div className="px-4 pb-4 pt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <TooltipProvider delayDuration={300}>
                    {loanAccounts.map((account) => {
                      const principal = Number(account.currentBalance);
                      const emi = account.emiAmount ? Number(account.emiAmount) : null;
                      const tenure = account.loanTenure ? Number(account.loanTenure) : null;
                      const rate = account.interestRate ? Number(account.interestRate) : null;
                      let paidPct = 0;
                      let totalLoan = 0;
                      if (emi && tenure) {
                        totalLoan = emi * tenure;
                        paidPct = totalLoan > 0 ? Math.max(0, Math.min(100, ((totalLoan - principal) / totalLoan) * 100)) : 0;
                      }
                      const barColor = paidPct > 60 ? "bg-emerald-500" : paidPct > 30 ? "bg-yellow-500" : "bg-amber-500";

                      let monthsRemaining: number | null = null;
                      let estimatedPayoff: string | null = null;
                      if (emi && emi > 0 && principal > 0) {
                        monthsRemaining = Math.ceil(principal / emi);
                        const payoffDate = new Date();
                        payoffDate.setMonth(payoffDate.getMonth() + monthsRemaining);
                        estimatedPayoff = payoffDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                      }

                      let principalPortion = 0;
                      let interestPortion = 0;
                      if (emi && tenure && totalLoan > 0) {
                        const totalPaid = totalLoan - principal;
                        if (rate && rate > 0) {
                          const totalInterest = totalLoan - (totalLoan / (1 + (rate / 100) * (tenure / 12)));
                          const paidRatio = totalPaid / totalLoan;
                          interestPortion = Math.min(totalInterest * paidRatio, totalPaid);
                          principalPortion = totalPaid - interestPortion;
                        } else {
                          principalPortion = totalPaid;
                        }
                      }

                      return (
                        <Card key={account.id} className="glass-2 hover:bg-[var(--glass-hover)] hover:shadow-md hover:shadow-amber-500/5 transition-all duration-300">
                          <CardContent className="pt-4 pb-3 px-4">
                            <div className="flex justify-between items-start mb-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm truncate">{account.name}</p>
                                {account.emiDay && (
                                  <span className="text-[10px] text-muted-foreground/60 font-mono">EMI on {getOrdinalSuffix(account.emiDay)}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 md:gap-4 ml-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-primary" onClick={() => { setReconcileId(account.id); setReconcileBalance(String(account.currentBalance)); }}>
                                      <RefreshCw className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Sync Balance</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-primary" onClick={() => openEdit(account.id)}>
                                      <Pencil className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit Account</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteAccountId(account.id)}>
                                      <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete Account</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                            <SensitiveValue as="div" className="text-lg font-bold font-mono text-red-500">{formatCurrency(Math.abs(principal))}</SensitiveValue>
                            <div className="mt-2 space-y-1">
                              {emi && (
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span className="text-muted-foreground/60">EMI</span>
                                  <SensitiveValue className="text-muted-foreground">{formatCurrency(emi)}/mo</SensitiveValue>
                                </div>
                              )}
                              {rate != null && rate > 0 && (
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span className="text-muted-foreground/60">Rate</span>
                                  <span className="text-muted-foreground">{rate}%</span>
                                </div>
                              )}
                              {account.linkedAccountId && (
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span className="text-muted-foreground/60">From</span>
                                  <span className="text-muted-foreground truncate ml-2">{accounts?.find((a) => a.id === account.linkedAccountId)?.name ?? "—"}</span>
                                </div>
                              )}
                              {monthsRemaining != null && (
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span className="text-muted-foreground/60">Months remaining</span>
                                  <span className="text-muted-foreground">{monthsRemaining}</span>
                                </div>
                              )}
                              {estimatedPayoff && (
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span className="text-muted-foreground/60">Estimated payoff</span>
                                  <span className="text-muted-foreground">{estimatedPayoff}</span>
                                </div>
                              )}
                            </div>
                            {emi && tenure && (
                              <div className="mt-3">
                                <div className="flex justify-between text-[10px] font-mono mb-1.5">
                                  <span className="text-muted-foreground/50">{Math.round(paidPct)}% repaid</span>
                                  <span className="font-semibold" style={{ color: paidPct > 60 ? "hsl(var(--chart-1))" : paidPct > 30 ? "hsl(var(--chart-4))" : "hsl(var(--chart-4))" }}>{Math.round(paidPct)}%</span>
                                </div>
                                <div className="w-full h-3 bg-secondary rounded-full overflow-hidden flex">
                                  {principalPortion > 0 && (
                                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(principalPortion / totalLoan) * 100}%` }} />
                                  )}
                                  {interestPortion > 0 && (
                                    <div className="h-full bg-orange-400 transition-all duration-500" style={{ width: `${(interestPortion / totalLoan) * 100}%` }} />
                                  )}
                                </div>
                                {(principalPortion > 0 || interestPortion > 0) && (
                                  <div className="flex gap-3 mt-1.5 text-[9px] font-mono text-muted-foreground/60">
                                    <span className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />
                                      Principal
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-sm bg-orange-400 inline-block" />
                                      Interest
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                    </TooltipProvider>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <TransferModal open={isTransferOpen} onOpenChange={setIsTransferOpen} />

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
          <Button variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
          <Button onClick={handleEdit} disabled={updateAccount.isPending || !editName.trim()}>
            {updateAccount.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </ResponsiveModal>

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

      <Sheet open={isMobile && isDialogOpen} onOpenChange={setIsDialogOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>New Account</SheetTitle>
          </SheetHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Account Name</FormLabel><FormControl><Input placeholder="e.g. HDFC Savings" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent><SelectItem value="bank">Bank Account</SelectItem><SelectItem value="credit_card">Credit Card</SelectItem><SelectItem value="loan">Loan</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="currentBalance" render={({ field }) => (<FormItem><FormLabel>{watchType === "loan" ? "Outstanding Principal" : "Current Balance"}</FormLabel><FormControl><div className="relative"><span className="absolute left-3 top-2.5 text-muted-foreground">{"\u20B9"}</span><Input type="number" step="0.01" className="pl-7 font-mono" placeholder="0.00" {...field} /></div></FormControl><FormMessage /></FormItem>)} />
              {watchType === "bank" && (
                <FormField control={form.control} name="useInSurplus" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><input type="checkbox" checked={field.value ?? false} onChange={field.onChange} className="h-4 w-4 rounded border-border accent-primary" /></FormControl>
                    <FormLabel className="text-sm font-normal cursor-pointer">Use in surplus calculation</FormLabel>
                  </FormItem>
                )} />
              )}
              {watchType === "credit_card" && (
                <>
                  <FormField control={form.control} name="creditLimit" render={({ field }) => (<FormItem><FormLabel>Credit Limit</FormLabel><FormControl><div className="relative"><span className="absolute left-3 top-2.5 text-muted-foreground">{"\u20B9"}</span><Input type="number" step="0.01" className="pl-7 font-mono" placeholder="0.00" {...field} /></div></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="billingDueDay" render={({ field }) => (<FormItem><FormLabel>Billing Due Day (1-31)</FormLabel><FormControl><Input type="number" min="1" max="31" step="1" className="font-mono" placeholder="e.g. 15" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="sharedLimitGroup" render={({ field }) => (<FormItem><FormLabel>Shared Limit Group</FormLabel><FormControl><div><Input className="font-mono" placeholder="Type group name or leave empty" list="shared-limit-groups-mobile" {...field} /><datalist id="shared-limit-groups-mobile">{existingGroups.map((g) => (<option key={g} value={g} />))}</datalist></div></FormControl><FormMessage /></FormItem>)} />
                </>
              )}
              {watchType === "loan" && (
                <>
                  <FormField control={form.control} name="emiAmount" render={({ field }) => (<FormItem><FormLabel>Monthly EMI</FormLabel><FormControl><div className="relative"><span className="absolute left-3 top-2.5 text-muted-foreground">{"\u20B9"}</span><Input type="number" step="0.01" className="pl-7 font-mono" placeholder="0.00" {...field} /></div></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="emiDay" render={({ field }) => (<FormItem><FormLabel>EMI Debit Day (1-31)</FormLabel><FormControl><Input type="number" min="1" max="31" step="1" className="font-mono" placeholder="e.g. 5" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="interestRate" render={({ field }) => (<FormItem><FormLabel>Interest Rate (%)</FormLabel><FormControl><Input type="number" step="0.01" className="font-mono" placeholder="e.g. 10.5" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="loanTenure" render={({ field }) => (<FormItem><FormLabel>Tenure (months)</FormLabel><FormControl><Input type="number" min="1" step="1" className="font-mono" placeholder="e.g. 36" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="linkedAccountId" render={({ field }) => (<FormItem><FormLabel>EMI Debit Account</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger></FormControl><SelectContent>{bankAccounts.map((a) => (<SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                </>
              )}
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={createAccount.isPending} className="w-full">
                  {createAccount.isPending ? "Creating..." : "Create Account"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ResponsiveModal({ open, onOpenChange, title, isMobile, children }: {
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
