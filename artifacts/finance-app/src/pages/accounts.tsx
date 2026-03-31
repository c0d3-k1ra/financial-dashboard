import { useState } from "react";
import {
  useListAccounts,
  getListAccountsQueryKey,
  useCreateAccount,
  useDeleteAccount,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Wallet, CreditCard, TrendingUp, ArrowLeftRight } from "lucide-react";
import TransferModal from "@/components/transfer-modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["bank", "credit_card"]),
  currentBalance: z.string().optional(),
  creditLimit: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function Accounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  const { data: accounts, isLoading } = useListAccounts({
    query: { queryKey: getListAccountsQueryKey() },
  });

  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", type: "bank", currentBalance: "0", creditLimit: "" },
  });

  const watchType = form.watch("type");

  const bankAccounts = accounts?.filter((a) => a.type === "bank") ?? [];
  const ccAccounts = accounts?.filter((a) => a.type === "credit_card") ?? [];
  const totalBank = bankAccounts.reduce((s, a) => s + Number(a.currentBalance), 0);
  const totalCcOutstanding = ccAccounts.reduce((s, a) => s + Math.abs(Number(a.currentBalance)), 0);
  const netWorth = totalBank - totalCcOutstanding;

  const onSubmit = (data: FormValues) => {
    createAccount.mutate(
      {
        data: {
          name: data.name,
          type: data.type,
          currentBalance: data.currentBalance || "0",
          creditLimit: data.type === "credit_card" ? data.creditLimit || null : null,
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
          toast({ title: "Failed to create account", description: String(err), variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this account? This cannot be undone.")) return;
    deleteAccount.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Account deleted" });
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        },
      }
    );
  };

  const allAccounts = [...bankAccounts, ...ccAccounts];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Manage Accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your bank accounts and credit cards.</p>
        </div>
        <div className="flex gap-2">
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
                        <FormLabel>Current Balance</FormLabel>
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
          <div className="flex gap-6 mt-2 text-sm font-mono text-muted-foreground">
            <span>Banks: {formatCurrency(totalBank)}</span>
            <span>CC Outstanding: {formatCurrency(totalCcOutstanding)}</span>
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
                  <TableHead className="text-xs font-mono uppercase tracking-wider text-muted-foreground text-right">Credit Limit</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allAccounts.map((account) => (
                  <TableRow key={account.id} className="border-border/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {account.type === "bank" ? (
                          <Wallet className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <CreditCard className="w-4 h-4 text-destructive" />
                        )}
                        {account.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-secondary text-secondary-foreground border border-border/50">
                        {account.type === "bank" ? "Bank" : "Credit Card"}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right font-mono font-bold ${account.type === "bank" ? "text-emerald-500" : ""}`}>
                      {formatCurrency(account.currentBalance)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {account.creditLimit ? formatCurrency(account.creditLimit) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(account.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(account.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(account.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
    </div>
  );
}
