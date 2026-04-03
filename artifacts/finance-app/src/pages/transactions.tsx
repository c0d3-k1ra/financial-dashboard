import { useState, useMemo, useEffect } from "react";
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
  getGetDashboardSummaryQueryKey,
  getGetMonthlySurplusQueryKey,
} from "@workspace/api-client-react";
import type { Transaction } from "@workspace/api-client-react";

import { formatCurrency, formatDate, getApiErrorMessage } from "@/lib/constants";
import { DatePicker } from "@/components/ui/date-picker";
import { format, subMonths } from "date-fns";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Search, Trash2, ArrowDownRight, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeftRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryBadge } from "@/components/category-badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import TransferModal from "@/components/transfer-modal";
import { useAiParseContext } from "@/lib/ai-parse-context";

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
  const [dateRange, setDateRange] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [newCatName, setNewCatName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferInitialValues, setTransferInitialValues] = useState<{
    fromAccountId?: string;
    toAccountId?: string;
    amount?: string;
    date?: string;
    description?: string;
  } | undefined>(undefined);

  const { parsedResult, consumeResult } = useAiParseContext();

  const dateRangeParams = useMemo(() => {
    if (dateRange === "custom") {
      if (customFrom && customTo) {
        return { cycleStart: format(customFrom, "yyyy-MM-dd"), cycleEnd: format(customTo, "yyyy-MM-dd") };
      }
      return {};
    }
    if (dateRange === "all") return {};
    const months = parseInt(dateRange);
    const now = new Date();
    const start = subMonths(now, months);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { cycleStart: format(start, "yyyy-MM-dd"), cycleEnd: format(endOfMonth, "yyyy-MM-dd") };
  }, [dateRange, customFrom, customTo]);

  const queryParams = useMemo(() => {
    const params: Record<string, string | undefined> = {
      search: search || undefined,
      category: filterCategory !== "all" ? filterCategory : undefined,
      ...dateRangeParams,
    };
    return params;
  }, [search, filterCategory, dateRangeParams]);

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
          toast({ title: "Failed to create category", description: getApiErrorMessage(err), variant: "destructive" });
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

  useEffect(() => {
    if (parsedResult) {
      const result = consumeResult();
      if (!result) return;

      if (result.transactionType === "Transfer") {
        setTransferInitialValues({
          fromAccountId: result.fromAccountId,
          toAccountId: result.toAccountId,
          amount: result.amount,
          date: result.date,
          description: result.description,
        });
        setIsTransferOpen(true);
      } else {
        form.reset({
          date: result.date || new Date().toISOString().split("T")[0],
          amount: result.amount || "",
          description: result.description || "",
          type: result.transactionType || "Expense",
          category: result.category || "",
          accountId: result.accountId || "",
        });
        setIsDialogOpen(true);
      }
    }
  }, [parsedResult]);

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
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMonthlySurplusQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Failed to add transaction", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const confirmDelete = () => {
    if (deleteId === null) return;
    deleteTx.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          toast({ title: "Transaction deleted" });
          setDeleteId(null);
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey(queryParams) });
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMonthlySurplusQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Failed to delete transaction", description: getApiErrorMessage(err), variant: "destructive" });
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
        <CategoryBadge category={tx.category} type={tx.type as "Income" | "Expense"} />
      ),
    },
    {
      header: "Account",
      cardLabel: "Account",
      accessorKey: "accountId" as const,
      cell: (tx: Transaction) => {
        const acct = accounts?.find((a) => a.id === tx.accountId);
        const toAcct = tx.toAccountId ? accounts?.find((a) => a.id === tx.toAccountId) : null;
        if (tx.type === "Transfer" && acct && toAcct) {
          return (
            <span className="text-xs font-mono text-muted-foreground">
              {acct.name} → {toAcct.name}
            </span>
          );
        }
        return <span className="text-xs font-mono text-muted-foreground">{acct?.name ?? "—"}</span>;
      },
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
          onClick={() => setDeleteId(tx.id)}
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

        <TransactionFormWrapper
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          form={form}
          onSubmit={onSubmit}
          onTypeChange={onTypeChange}
          filteredCategories={filteredCategories}
          accounts={accounts ?? []}
          isAddingCategory={isAddingCategory}
          setIsAddingCategory={setIsAddingCategory}
          newCatName={newCatName}
          setNewCatName={setNewCatName}
          handleAddCategory={handleAddCategory}
          createCategory={createCategory}
          createTx={createTx}
        />
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
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Past 1 Month</SelectItem>
              <SelectItem value="3">Past 3 Months</SelectItem>
              <SelectItem value="6">Past 6 Months</SelectItem>
              <SelectItem value="12">Past 12 Months</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {dateRange === "custom" && (
            <div className="flex gap-2 items-center">
              <DatePicker date={customFrom} onSelect={setCustomFrom} placeholder="From" className="w-[140px]" />
              <span className="text-muted-foreground text-xs">to</span>
              <DatePicker date={customTo} onSelect={setCustomTo} placeholder="To" className="w-[140px]" />
            </div>
          )}
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
            renderMobileCard={(tx) => {
              const acct = accounts?.find((a) => a.id === tx.accountId);
              const toAcct = tx.toAccountId ? accounts?.find((a) => a.id === tx.toAccountId) : null;
              const isIncome = tx.type === "Income";
              const isTransfer = tx.type === "Transfer";

              return (
                <div className={`relative rounded-xl border bg-card text-card-foreground shadow overflow-hidden ${
                  isIncome
                    ? "border-emerald-500/30"
                    : isTransfer
                    ? "border-blue-400/30"
                    : "border-rose-500/30"
                }`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <CategoryBadge category={tx.category} type={tx.type as "Income" | "Expense"} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 -mr-1"
                        onClick={() => setDeleteId(tx.id)}
                        data-testid={`btn-delete-tx-${tx.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-sm text-foreground truncate flex-1 min-w-0">{tx.description}</p>
                      <span className={`font-mono font-bold text-sm flex items-center gap-1 shrink-0 ${
                        isIncome
                          ? "text-emerald-500"
                          : isTransfer
                          ? "text-blue-400"
                          : "text-rose-400"
                      }`}>
                        {isIncome && <ArrowDownRight className="w-3.5 h-3.5" />}
                        {isTransfer && <ArrowLeftRight className="w-3.5 h-3.5" />}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <p className="text-xs font-mono text-muted-foreground">{formatDate(tx.date)}</p>
                      <span className="text-xs font-mono text-muted-foreground text-right truncate max-w-[50%]">
                        {isTransfer && acct && toAcct
                          ? `${acct.name} → ${toAcct.name}`
                          : acct?.name ?? "—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }}
            emptyState={
              <div className="text-center py-12 px-4 border border-dashed border-border/50 rounded-lg bg-background/30">
                <p className="text-muted-foreground font-mono text-sm">No transactions found.</p>
                {search && <p className="text-xs text-muted-foreground mt-1">Try adjusting your search query.</p>}
              </div>
            }
          />
        )}
      </div>

      <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete this transaction? This action cannot be undone and will adjust your account balance.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteTx.isPending}>
              {deleteTx.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TransferModal
        open={isTransferOpen}
        onOpenChange={setIsTransferOpen}
        initialValues={transferInitialValues}
      />
    </div>
  );
}

function TransactionFormFields({
  form,
  onSubmit,
  onTypeChange,
  filteredCategories,
  accounts,
  isAddingCategory,
  setIsAddingCategory,
  newCatName,
  setNewCatName,
  handleAddCategory,
  createCategory,
  createTx,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
  onSubmit: (data: FormValues) => void;
  onTypeChange: (val: "Income" | "Expense") => void;
  filteredCategories: Array<{ id: number; name: string }>;
  accounts: Array<{ id: number; name: string }>;
  isAddingCategory: boolean;
  setIsAddingCategory: (v: boolean) => void;
  newCatName: string;
  setNewCatName: (v: string) => void;
  handleAddCategory: () => void;
  createCategory: { isPending: boolean };
  createTx: { isPending: boolean };
}) {
  return (
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
                <DatePicker
                  date={field.value ? new Date(field.value + "T00:00:00") : undefined}
                  onSelect={(d) => field.onChange(d ? format(d, "yyyy-MM-dd") : "")}
                  placeholder="Pick a date"
                  className="w-full"
                />
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
                    className="font-mono text-sm"
                    autoFocus
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
                <Select onValueChange={(val) => { if (val === "__add_new__") { setIsAddingCategory(true); } else { field.onChange(val); } }} value={field.value}>
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
                    <SelectItem value="__add_new__" className="text-primary font-medium border-t border-border/50 mt-1">
                      + Add Category
                    </SelectItem>
                  </SelectContent>
                </Select>
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
                  {accounts.map((a) => (
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

        <div className="pt-4">
          <Button type="submit" disabled={createTx.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
            {createTx.isPending ? "Saving..." : "Save Transaction"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function TransactionFormWrapper(props: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: ReturnType<typeof useForm<FormValues>>;
  onSubmit: (data: FormValues) => void;
  onTypeChange: (val: "Income" | "Expense") => void;
  filteredCategories: Array<{ id: number; name: string }>;
  accounts: Array<{ id: number; name: string }>;
  isAddingCategory: boolean;
  setIsAddingCategory: (v: boolean) => void;
  newCatName: string;
  setNewCatName: (v: string) => void;
  handleAddCategory: () => void;
  createCategory: { isPending: boolean };
  createTx: { isPending: boolean };
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (isMobile) {
    return (
      <Sheet open={props.isOpen} onOpenChange={props.onOpenChange}>
        <SheetTrigger asChild>
          <Button data-testid="btn-new-tx" className="w-full sm:w-auto font-mono text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Log Transaction
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>New Transaction</SheetTitle>
          </SheetHeader>
          <TransactionFormFields {...props} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={props.isOpen} onOpenChange={props.onOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="btn-new-tx" className="w-full sm:w-auto font-mono text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Log Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Transaction</DialogTitle>
        </DialogHeader>
        <TransactionFormFields {...props} />
      </DialogContent>
    </Dialog>
  );
}
