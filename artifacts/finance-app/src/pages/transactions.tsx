import { useState, useMemo } from "react";
import {
  useListTransactions,
  getListTransactionsQueryKey,
  useCreateTransaction,
  useDeleteTransaction,
  useListCategories,
  getListCategoriesQueryKey,
  useCreateCategory,
  useListAccounts,
  getListAccountsQueryKey,
  useListBillingCycles,
  getListBillingCyclesQueryKey,
} from "@workspace/api-client-react";
import type { Transaction } from "@workspace/api-client-react";

import { formatCurrency, formatDate } from "@/lib/constants";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Search, Trash2, ArrowDownRight, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeftRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  amount: z.string().min(1, "Amount is required"),
  description: z.string().min(1, "Description is required"),
  type: z.enum(["Income", "Expense"]),
  category: z.string().min(1, "Category is required"),
  accountId: z.string().min(1, "Account is required"),
});

type FormValues = z.infer<typeof formSchema>;

type SortField = "date" | "amount" | "category" | "description";
type SortDir = "asc" | "desc";

export default function Transactions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedCycle, setSelectedCycle] = useState<string>("all");
  const [newCatName, setNewCatName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const { data: billingCycles } = useListBillingCycles({
    query: { queryKey: getListBillingCyclesQueryKey() },
  });

  const selectedCycleData = useMemo(() => {
    if (selectedCycle === "all" || !billingCycles) return null;
    const idx = parseInt(selectedCycle);
    return billingCycles[idx] || null;
  }, [selectedCycle, billingCycles]);

  const queryParams = useMemo(() => {
    const params: Record<string, string | undefined> = {
      search: search || undefined,
    };
    if (selectedCycleData) {
      params.cycleStart = selectedCycleData.startDate;
      params.cycleEnd = selectedCycleData.endDate;
    }
    return params;
  }, [search, selectedCycleData]);

  const { data: transactions, isLoading } = useListTransactions(queryParams, {
    query: { enabled: true, queryKey: getListTransactionsQueryKey(queryParams) },
  });

  const { data: categories } = useListCategories(
    {},
    { query: { queryKey: ["/api/categories"] } }
  );

  const { data: accounts } = useListAccounts({
    query: { queryKey: getListAccountsQueryKey() },
  });

  const createCategory = useCreateCategory();
  const handleAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    createCategory.mutate(
      { data: { name: trimmed, type: form.getValues("type") === "Income" ? "Income" : "Expense" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          form.setValue("category", trimmed);
          setNewCatName("");
          setIsAddingCategory(false);
          toast({ title: "Category created" });
        },
        onError: (err) => {
          toast({ title: "Failed to create category", description: String(err), variant: "destructive" });
        },
      }
    );
  };

  const sortedTransactions = useMemo(() => {
    if (!transactions) return [];
    const sorted = [...transactions].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date":
          cmp = a.date.localeCompare(b.date);
          break;
        case "amount":
          cmp = Number(a.amount) - Number(b.amount);
          break;
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
        case "description":
          cmp = a.description.localeCompare(b.description);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [transactions, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 ml-1 text-primary" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 text-primary" />
    );
  };

  const createTx = useCreateTransaction();
  const deleteTx = useDeleteTransaction();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      amount: "",
      description: "",
      type: "Expense",
      category: "",
      accountId: "",
    },
  });

  const watchType = form.watch("type");
  const filteredCategories = categories?.filter((c) => c.type === watchType) ?? [];

  const onTypeChange = (val: "Income" | "Expense") => {
    form.setValue("type", val);
    form.setValue("category", "");
  };

  const onSubmit = (data: FormValues) => {
    createTx.mutate(
      {
        data: {
          ...data,
          accountId: Number(data.accountId),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Transaction added successfully" });
          setIsDialogOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey(queryParams) });
          queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Failed to add transaction", description: String(err), variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this transaction?")) return;
    deleteTx.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Transaction deleted" });
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey(queryParams) });
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        },
      }
    );
  };

  const columns = [
    {
      header: (
        <button onClick={() => toggleSort("date")} className="flex items-center hover:text-foreground transition-colors">
          Date <SortIcon field="date" />
        </button>
      ),
      cardLabel: "Date",
      accessorKey: "date" as const,
      cell: (tx: Transaction) => <span className="font-mono">{formatDate(tx.date)}</span>,
    },
    {
      header: (
        <button onClick={() => toggleSort("description")} className="flex items-center hover:text-foreground transition-colors">
          Description <SortIcon field="description" />
        </button>
      ),
      cardLabel: "Description",
      accessorKey: "description" as const,
      className: "font-medium max-w-[200px] truncate",
    },
    {
      header: (
        <button onClick={() => toggleSort("category")} className="flex items-center hover:text-foreground transition-colors">
          Category <SortIcon field="category" />
        </button>
      ),
      cardLabel: "Category",
      accessorKey: "category" as const,
      cell: (tx: Transaction) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-secondary text-secondary-foreground border border-border/50">
          {tx.category}
        </span>
      ),
    },
    {
      header: (
        <button onClick={() => toggleSort("amount")} className="flex items-center justify-end w-full hover:text-foreground transition-colors">
          Amount <SortIcon field="amount" />
        </button>
      ),
      cardLabel: "Amount",
      accessorKey: "amount" as const,
      className: "text-right",
      cell: (tx: Transaction) => (
        <div className="flex items-center justify-end gap-1 font-mono font-bold">
          {tx.type === "Income" ? (
            <span className="text-emerald-500 flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3" /> {formatCurrency(tx.amount)}
            </span>
          ) : tx.type === "Transfer" ? (
            <span className="text-blue-400 flex items-center gap-1">
              <ArrowLeftRight className="w-3 h-3" /> {formatCurrency(tx.amount)}
            </span>
          ) : (
            <span className="text-foreground flex items-center gap-1">{formatCurrency(tx.amount)}</span>
          )}
        </div>
      ),
    },
    {
      header: "",
      className: "w-10 text-center",
      cardLabel: "Action",
      cell: (tx: Transaction) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => handleDelete(tx.id)}
          data-testid={`btn-delete-tx-${tx.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Ledger</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and manage your daily cash flow.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-new-tx" className="w-full sm:w-auto font-mono text-xs uppercase tracking-wider">
              <Plus className="w-4 h-4 mr-2" /> Log Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>New Transaction</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={(val: string) => onTypeChange(val as "Income" | "Expense")} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Expense">Expense</SelectItem>
                            <SelectItem value="Income">Income</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="What was this for?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      {isAddingCategory ? (
                        <div className="flex gap-2">
                          <Input
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            placeholder="New category name"
                            className="font-mono"
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); } }}
                          />
                          <Button type="button" size="sm" onClick={handleAddCategory} disabled={createCategory.isPending}>
                            {createCategory.isPending ? "..." : "Add"}
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => { setIsAddingCategory(false); setNewCatName(""); }}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {filteredCategories.map((c) => (
                                <SelectItem key={c.id} value={c.name}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-primary" onClick={() => setIsAddingCategory(true)}>
                            + Add Category
                          </Button>
                        </>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(accounts ?? []).map((a) => (
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

                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={createTx.isPending} className="w-full">
                    {createTx.isPending ? "Saving..." : "Save Transaction"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card/50 backdrop-blur rounded-xl border border-border/60 p-4 md:p-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              className="pl-9 bg-background/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={selectedCycle} onValueChange={setSelectedCycle}>
            <SelectTrigger className="w-full sm:w-[220px] h-9 text-xs">
              <SelectValue placeholder="Billing Cycle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Transactions</SelectItem>
              {billingCycles?.map((cycle, idx) => (
                <SelectItem key={idx} value={String(idx)}>
                  {cycle.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2 md:hidden">
            <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="description">Description</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 px-3" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
              {sortDir === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 mt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <ResponsiveTable
            data={sortedTransactions}
            columns={columns}
            keyExtractor={(tx) => tx.id}
            emptyState={
              <div className="text-center py-12 px-4 border border-dashed border-border/50 rounded-lg bg-background/30">
                <p className="text-muted-foreground font-mono text-sm">No transactions found.</p>
                {search && <p className="text-xs text-muted-foreground mt-1">Try adjusting your search query.</p>}
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
