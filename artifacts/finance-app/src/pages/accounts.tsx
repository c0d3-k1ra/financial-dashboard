import { useState } from "react";
import {
  useListAccounts,
  getListAccountsQueryKey,
  useCreateAccount,
  useDeleteAccount,
  useReconcileAccount,
  useUpdateAccount,
  useProcessEmis,
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
import { Plus, Trash2, Wallet, CreditCard, TrendingUp, ArrowLeftRight, RefreshCw, Pencil, Landmark } from "lucide-react";
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
  const [deleteAccountId, setDeleteAccountId] = useState<number | null>(null);

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
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Account updated" });
          setEditId(null);
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
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
        },
        onError: (err) => {
          toast({ title: "Reconciliation Failed", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", type: "bank", currentBalance: "0", creditLimit: "", billingDueDay: "", emiAmount: "", emiDay: "", loanTenure: "", interestRate: "", linkedAccountId: "" },
  });

  const watchType = form.watch("type");

  const bankAccounts = accounts?.filter((a) => a.type === "bank") ?? [];
  const ccAccounts = accounts?.filter((a) => a.type === "credit_card") ?? [];
  const loanAccounts = accounts?.filter((a) => a.type === "loan") ?? [];
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
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Account created" });
          setIsDialogOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
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
        },
        onError: (err) => {
          toast({ title: "Failed to process EMIs", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const allAccounts = [...bankAccounts, ...ccAccounts, ...loanAccounts];

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
          <div className="hidden md:block bg-card/50 backdrop-blur rounded-xl border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Name</TableHead>
                  <TableHead className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Type</TableHead>
                  <TableHead className="text-xs font-mono uppercase tracking-wider text-muted-foreground text-right">Balance</TableHead>
                  <TableHead className="text-xs font-mono uppercase tracking-wider text-muted-foreground text-right">Details</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allAccounts.map((account) => (
                  <TableRow key={account.id} className="border-border/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getAccountIcon(account.type)}
                        {account.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-secondary text-secondary-foreground border border-border/50">
                        {getAccountLabel(account.type)}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right font-mono font-bold ${account.type === "bank" ? "text-emerald-500" : account.type === "loan" ? "text-amber-500" : ""}`}>
                      {formatCurrency(account.currentBalance)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground text-xs">
                      {account.type === "credit_card" && account.creditLimit && (
                        <span>Limit: {formatCurrency(account.creditLimit)}</span>
                      )}
                      {account.type === "credit_card" && account.billingDueDay && (
                        <span className="ml-2">Due: {account.billingDueDay}th</span>
                      )}
                      {account.type === "loan" && account.emiAmount && (
                        <span>EMI: {formatCurrency(account.emiAmount)}</span>
                      )}
                      {account.type === "loan" && account.interestRate && (
                        <span className="ml-2">@ {account.interestRate}%</span>
                      )}
                      {account.type === "bank" && "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => { setReconcileId(account.id); setReconcileBalance(String(account.currentBalance)); }}
                          title="Reconcile"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => openEdit(account.id)}
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteAccountId(account.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-4">
            {bankAccounts.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-500" /> Bank Accounts
                </h2>
                <div className="space-y-3">
                  {bankAccounts.map((account) => (
                    <Card key={account.id} className="bg-card/50 backdrop-blur border-border/60">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">{account.name}</p>
                            <p className="text-xl font-bold font-mono mt-0.5 text-emerald-500">
                              {formatCurrency(account.currentBalance)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => { setReconcileId(account.id); setReconcileBalance(String(account.currentBalance)); }}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => openEdit(account.id)}
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteAccountId(account.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {ccAccounts.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-destructive" /> Credit Cards
                </h2>
                <div className="space-y-3">
                  {ccAccounts.map((account) => (
                    <Card key={account.id} className="bg-card/50 backdrop-blur border-border/60">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">{account.name}</p>
                            <p className="text-xl font-bold font-mono mt-0.5">{formatCurrency(account.currentBalance)}</p>
                            {account.creditLimit && (
                              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                                Limit: {formatCurrency(account.creditLimit)}
                              </p>
                            )}
                            {account.billingDueDay && (
                              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                                Due: {account.billingDueDay}th of each month
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => { setReconcileId(account.id); setReconcileBalance(String(account.currentBalance)); }}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => openEdit(account.id)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteAccountId(account.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {loanAccounts.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-amber-500" /> Loans
                </h2>
                <div className="space-y-3">
                  {loanAccounts.map((account) => (
                    <Card key={account.id} className="bg-card/50 backdrop-blur border-border/60">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">{account.name}</p>
                            <p className="text-xl font-bold font-mono mt-0.5 text-amber-500">{formatCurrency(account.currentBalance)}</p>
                            {account.emiAmount && (
                              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                                EMI: {formatCurrency(account.emiAmount)}/mo
                              </p>
                            )}
                            <div className="flex gap-3 mt-0.5 flex-wrap">
                              {account.interestRate && (
                                <p className="text-xs font-mono text-muted-foreground">
                                  Rate: {account.interestRate}%
                                </p>
                              )}
                              {account.emiDay && (
                                <p className="text-xs font-mono text-muted-foreground">
                                  Debit: {account.emiDay}th
                                </p>
                              )}
                              {account.linkedAccountId && (
                                <p className="text-xs font-mono text-muted-foreground">
                                  From: {accounts?.find((a) => a.id === account.linkedAccountId)?.name ?? "—"}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => { setReconcileId(account.id); setReconcileBalance(String(account.currentBalance)); }}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => openEdit(account.id)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteAccountId(account.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
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
