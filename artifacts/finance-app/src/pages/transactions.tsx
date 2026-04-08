import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  useListTransactions,
  getListTransactionsQueryKey,
  useCreateTransaction,
  useUpdateTransaction,
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
import { SensitiveValue } from "@/components/sensitive-value";
import { DatePicker } from "@/components/ui/date-picker";
import { format, subMonths } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Search, Trash2, Pencil, ArrowDownRight, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeftRight, X, Info, ChevronLeft, ChevronRight, Filter, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryBadge } from "@/components/category-badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import TransferModal from "@/components/transfer-modal";
import { useAiParseContext } from "@/lib/ai-parse-context";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

const PAGE_SIZE = 15;

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
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [expandedAdjustmentDates, setExpandedAdjustmentDates] = useState<Set<string>>(new Set());
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
      type: filterType !== "all" ? filterType : undefined,
      accountId: filterAccount !== "all" ? filterAccount : undefined,
      amountMin: amountMin || undefined,
      amountMax: amountMax || undefined,
      ...dateRangeParams,
    };
    return params;
  }, [search, filterCategory, filterType, filterAccount, amountMin, amountMax, dateRangeParams]);

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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterCategory !== "all") count++;
    if (filterType !== "all") count++;
    if (filterAccount !== "all") count++;
    if (amountMin) count++;
    if (amountMax) count++;
    if (dateRange !== "all") count++;
    if (search) count++;
    return count;
  }, [filterCategory, filterType, filterAccount, amountMin, amountMax, dateRange, search]);

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setFilterCategory("all");
    setFilterType("all");
    setFilterAccount("all");
    setAmountMin("");
    setAmountMax("");
    setDateRange("all");
    setCustomFrom(undefined);
    setCustomTo(undefined);
    setCurrentPage(1);
  }, []);

  const createCategory = useCreateCategory();
  const handleAddCategoryFor = (targetForm: ReturnType<typeof useForm<FormValues>>) => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    createCategory.mutate(
      { data: { name: trimmed, type: targetForm.getValues("type") === "Income" ? "Income" : "Expense" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          targetForm.setValue("category", trimmed);
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
  const handleAddCategory = () => handleAddCategoryFor(form);
  const handleEditAddCategory = () => handleAddCategoryFor(editForm);

  const isBalanceAdjustment = (tx: Transaction) =>
    tx.description.toLowerCase().includes("balance adjustment") ||
    tx.category.toLowerCase() === "balance adjustment";

  const sortedTransactions = useMemo(() => {
    if (!transactions) return [];
    let filtered = [...transactions];
    if (!showAdjustments) {
      filtered = filtered.filter((tx) => !isBalanceAdjustment(tx));
    }
    const sorted = filtered.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (sortField === "date") {
        return sortDir === "asc" ? -dateCmp : dateCmp;
      }
      if (dateCmp !== 0) {
        return sortDir === "asc" ? -dateCmp : dateCmp;
      }
      let cmp = 0;
      switch (sortField) {
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
  }, [transactions, sortField, sortDir, showAdjustments]);

  const totalCount = sortedTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedTransactions.slice(start, start + PAGE_SIZE);
  }, [sortedTransactions, currentPage]);

  const showingFrom = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(currentPage * PAGE_SIZE, totalCount);

  const toggleAdjustmentDate = useCallback((date: string) => {
    setExpandedAdjustmentDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }, []);

  const dateGroups = useMemo(() => {
    const groups: { date: string; formattedDate: string; dailySpend: number; transactions: Transaction[] }[] = [];
    const map = new Map<string, Transaction[]>();
    for (const tx of paginatedTransactions) {
      const existing = map.get(tx.date);
      if (existing) {
        existing.push(tx);
      } else {
        const arr = [tx];
        map.set(tx.date, arr);
        groups.push({
          date: tx.date,
          formattedDate: formatDate(tx.date),
          dailySpend: 0,
          transactions: arr,
        });
      }
    }
    for (const group of groups) {
      group.dailySpend = group.transactions
        .filter((tx) => tx.type === "Expense" && !isBalanceAdjustment(tx))
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
    }
    return groups;
  }, [paginatedTransactions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [queryParams, sortField, sortDir]);

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
  const updateTx = useUpdateTransaction();
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

  const editForm = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: "",
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

  const editWatchType = editForm.watch("type");
  const editFilteredCategories = categories?.filter((c) => c.type === editWatchType) ?? [];

  const onTypeChange = (val: "Income" | "Expense") => {
    form.setValue("type", val);
    form.setValue("category", "");
  };

  const onEditTypeChange = (val: "Income" | "Expense") => {
    editForm.setValue("type", val);
    editForm.setValue("category", "");
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey(queryParams) });
    queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMonthlySurplusQueryKey() });
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
          invalidateAll();
        },
        onError: (err) => {
          toast({ title: "Failed to add transaction", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const onEditSubmit = (data: FormValues) => {
    if (!editingTx) return;
    updateTx.mutate(
      {
        id: editingTx.id,
        data: {
          ...data,
          accountId: Number(data.accountId),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Transaction updated" });
          setEditingTx(null);
          invalidateAll();
        },
        onError: (err) => {
          toast({ title: "Failed to update transaction", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const openEdit = (tx: Transaction) => {
    editForm.reset({
      date: tx.date,
      amount: tx.amount,
      description: tx.description,
      type: tx.type as "Income" | "Expense",
      category: tx.category,
      accountId: String(tx.accountId),
    });
    setEditingTx(tx);
  };

  const confirmDelete = () => {
    if (deleteId === null) return;
    deleteTx.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          toast({ title: "Transaction deleted" });
          setDeleteId(null);
          invalidateAll();
        },
        onError: (err) => {
          toast({ title: "Failed to delete transaction", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const handleCategoryClick = (category: string) => {
    setFilterCategory(category);
    setCurrentPage(1);
  };

  const renderMobileCard = (tx: Transaction) => {
    const acct = accounts?.find((a) => a.id === tx.accountId);
    const toAcct = tx.toAccountId ? accounts?.find((a) => a.id === tx.toAccountId) : null;
    const isIncome = tx.type === "Income";
    const isTransfer = tx.type === "Transfer";
    const isAdj = isBalanceAdjustment(tx);

    return (
      <div
        key={tx.id}
        className={`relative rounded-xl glass-1 text-card-foreground shadow overflow-hidden ${
          isAdj
            ? "border-dashed border-muted-foreground/30 opacity-60"
            : isIncome
            ? "border-emerald-500/30"
            : isTransfer
            ? "border-blue-400/30"
            : "border-rose-500/30"
        }`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <CategoryBadge
              category={tx.category}
              type={tx.type as "Income" | "Expense"}
              onClick={() => handleCategoryClick(tx.category)}
            />
            <div className="flex items-center gap-0.5">
              {tx.type !== "Transfer" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0"
                  onClick={() => openEdit(tx)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
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
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <p className={`font-medium text-sm text-foreground truncate ${isAdj ? "italic text-muted-foreground" : ""}`}>
                {tx.description}
              </p>
              {isAdj && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Manual balance adjustment — not an actual transaction</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <span className={`font-mono font-bold text-sm flex items-center gap-1 shrink-0 ${
              isIncome
                ? "text-emerald-500"
                : isTransfer
                ? "text-blue-600 dark:text-blue-400"
                : "text-foreground"
            }`}>
              {isIncome && <ArrowDownRight className="w-3.5 h-3.5" />}
              {isTransfer && <ArrowLeftRight className="w-3.5 h-3.5" />}
              {isIncome ? "+" : ""}<SensitiveValue>{formatCurrency(tx.amount)}</SensitiveValue>
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <span className="text-xs font-mono text-muted-foreground text-right truncate max-w-[50%]">
              {isTransfer && acct && toAcct
                ? `${acct.name} → ${toAcct.name}`
                : acct?.name ?? "—"}
            </span>
          </div>
        </div>
      </div>
    );
  };


  const columns = [
    {
      header: (
        <button onClick={() => toggleSort("description")} className="flex items-center hover:text-foreground transition-colors">
          Description <SortIcon field="description" />
        </button>
      ),
      cardLabel: "Description",
      accessorKey: "description" as const,
      className: "w-[32%] font-medium truncate",
      cell: (tx: Transaction) => (
        <div className="flex items-center gap-1.5">
          <span className={`truncate ${isBalanceAdjustment(tx) ? "italic text-muted-foreground" : ""}`}>
            {tx.description}
          </span>
          {isBalanceAdjustment(tx) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Manual balance adjustment — not an actual transaction</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      ),
    },
    {
      header: (
        <button onClick={() => toggleSort("category")} className="flex items-center hover:text-foreground transition-colors">
          Category <SortIcon field="category" />
        </button>
      ),
      cardLabel: "Category",
      accessorKey: "category" as const,
      className: "w-[8%]",
      cell: (tx: Transaction) => (
        <CategoryBadge
          category={tx.category}
          type={tx.type as "Income" | "Expense"}
          onClick={() => handleCategoryClick(tx.category)}
          compact
        />
      ),
    },
    {
      header: "Account",
      cardLabel: "Account",
      accessorKey: "accountId" as const,
      className: "w-[25%]",
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
      className: "w-[20%] text-right",
      cell: (tx: Transaction) => (
        <div className="flex items-center justify-end gap-1 font-mono font-bold">
          {tx.type === "Income" ? (
            <span className="text-emerald-500 flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3" /> +<SensitiveValue>{formatCurrency(tx.amount)}</SensitiveValue>
            </span>
          ) : tx.type === "Transfer" ? (
            <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <ArrowLeftRight className="w-3 h-3" /> <SensitiveValue>{formatCurrency(tx.amount)}</SensitiveValue>
            </span>
          ) : (
            <span className="text-foreground flex items-center gap-1"><SensitiveValue>{formatCurrency(tx.amount)}</SensitiveValue></span>
          )}
        </div>
      ),
    },
    {
      header: "",
      className: "w-[8%] text-center",
      cardLabel: "Actions",
      cell: (tx: Transaction) => (
        <div className="flex items-center gap-1">
          {tx.type !== "Transfer" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => openEdit(tx)}
              data-testid={`btn-edit-tx-${tx.id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteId(tx.id)}
            data-testid={`btn-delete-tx-${tx.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  const getRowClassName = (tx: Transaction) => {
    if (isBalanceAdjustment(tx)) {
      return "border-l-2 border-l-dashed border-l-muted-foreground/30 bg-muted/10 opacity-75";
    }
    return "";
  };

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

      <div className="glass-1 p-4 md:p-6 flex flex-col gap-4">
        <div className="hidden md:flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setCurrentPage(1); }}>
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
            <Select value={filterType} onValueChange={(v) => { setFilterType(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Expense">Expense</SelectItem>
                <SelectItem value="Income">Income</SelectItem>
                <SelectItem value="Transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAccount} onValueChange={(v) => { setFilterAccount(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts?.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
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
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                placeholder="Min ₹"
                className="w-[100px] h-9 text-xs font-mono"
                value={amountMin}
                onChange={(e) => { setAmountMin(e.target.value); setCurrentPage(1); }}
              />
              <span className="text-muted-foreground text-xs">–</span>
              <Input
                type="number"
                placeholder="Max ₹"
                className="w-[100px] h-9 text-xs font-mono"
                value={amountMax}
                onChange={(e) => { setAmountMax(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <button
              onClick={() => {
                setShowAdjustments((v) => {
                  if (v) setExpandedAdjustmentDates(new Set());
                  return !v;
                });
                setCurrentPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-colors ${
                showAdjustments
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-background/50 text-muted-foreground border-[var(--divider-color)] hover:border-[rgba(var(--glass-overlay-rgb),0.15)]"
              }`}
            >
              {showAdjustments ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showAdjustments ? "Hide" : "Show"} Adjustments
            </button>
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-mono border border-primary/20">
                  <Filter className="w-3 h-3" />
                  Filters ({activeFilterCount})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearAllFilters}
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear All
                </Button>
              </div>
            )}
          </div>
        </div>

        <MobileFilterBar
          search={search}
          setSearch={setSearch}
          filterCategory={filterCategory}
          setFilterCategory={(v) => { setFilterCategory(v); setCurrentPage(1); }}
          filterType={filterType}
          setFilterType={(v) => { setFilterType(v); setCurrentPage(1); }}
          filterAccount={filterAccount}
          setFilterAccount={(v) => { setFilterAccount(v); setCurrentPage(1); }}
          dateRange={dateRange}
          setDateRange={setDateRange}
          customFrom={customFrom}
          setCustomFrom={setCustomFrom}
          customTo={customTo}
          setCustomTo={setCustomTo}
          amountMin={amountMin}
          setAmountMin={(v) => { setAmountMin(v); setCurrentPage(1); }}
          amountMax={amountMax}
          setAmountMax={(v) => { setAmountMax(v); setCurrentPage(1); }}
          sortField={sortField}
          setSortField={(v) => setSortField(v as SortField)}
          sortDir={sortDir}
          setSortDir={setSortDir}
          showAdjustments={showAdjustments}
          setShowAdjustments={(v) => {
            setShowAdjustments(v);
            if (!v) setExpandedAdjustmentDates(new Set());
            setCurrentPage(1);
          }}
          activeFilterCount={activeFilterCount}
          clearAllFilters={clearAllFilters}
          categories={categories}
          accounts={accounts}
        />

        {isLoading ? (
          <div className="space-y-3 mt-4">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : (
          <>
            {paginatedTransactions.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-[var(--divider-color)] rounded-lg glass-2">
                {activeFilterCount > 0 ? (
                  <>
                    <p className="text-muted-foreground font-mono text-sm">No transactions match your filters.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 text-xs"
                      onClick={clearAllFilters}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear All Filters
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground font-mono text-sm">No transactions found.</p>
                    {search && <p className="text-xs text-muted-foreground mt-1">Try adjusting your search query.</p>}
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6">
                  <div className="rounded-md border border-[var(--divider-color)] glass-1 overflow-hidden">
                  <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                      <Table className="table-fixed">
                        <TableHeader className="glass-2 sticky top-0 z-20">
                          <TableRow>
                            {columns.map((col, i) => (
                              <TableHead key={i} className={cn("text-muted-foreground font-mono text-xs uppercase tracking-wider", col.className)}>
                                {col.header}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dateGroups.map((group) => {
                            const adjustments = group.transactions.filter(isBalanceAdjustment);
                            const nonAdjustments = group.transactions.filter((tx) => !isBalanceAdjustment(tx));
                            const hasMultipleAdj = adjustments.length > 1;
                            const isAdjExpanded = expandedAdjustmentDates.has(group.date);
                            const adjTotal = adjustments.reduce((sum, tx) => sum + Number(tx.amount), 0);

                            return (
                              <React.Fragment key={group.date}>
                                <TableRow className="glass-2 hover:bg-[var(--glass-hover)] border-b-0 sticky top-[37px] z-10">
                                  <TableCell colSpan={columns.length} className="py-2 px-4">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold font-mono text-foreground/80 tracking-wide">
                                        {group.formattedDate}
                                      </span>
                                      {group.dailySpend > 0 && (
                                        <SensitiveValue className="text-xs font-mono text-muted-foreground">
                                          — {formatCurrency(group.dailySpend)}
                                        </SensitiveValue>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                                {nonAdjustments.map((tx) => (
                                  <TableRow
                                    key={tx.id}
                                    className={cn("transition-colors hover:bg-[var(--glass-hover)] zebra-row", getRowClassName(tx))}
                                  >
                                    {columns.map((col, colIndex) => (
                                      <TableCell key={colIndex} className={col.className}>
                                        {col.cell ? col.cell(tx) : (col.accessorKey ? String(tx[col.accessorKey] ?? "") : null)}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                                {showAdjustments && adjustments.length > 0 && (
                                  <>
                                    {hasMultipleAdj && !isAdjExpanded ? (
                                      <TableRow
                                        className="transition-colors hover:bg-[var(--glass-hover)] cursor-pointer opacity-60 border-l-2 border-dashed border-l-muted-foreground/30"
                                        onClick={() => toggleAdjustmentDate(group.date)}
                                      >
                                        <TableCell colSpan={columns.length} className="py-2 px-4">
                                          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground italic">
                                            <ChevronDown className="w-3.5 h-3.5" />
                                            <span>{adjustments.length} Balance Adjustments</span>
                                            <SensitiveValue className="ml-auto">{formatCurrency(adjTotal)}</SensitiveValue>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ) : (
                                      <>
                                        {hasMultipleAdj && (
                                          <TableRow
                                            className="transition-colors hover:bg-[var(--glass-hover)] cursor-pointer opacity-60 border-l-2 border-dashed border-l-muted-foreground/30"
                                            onClick={() => toggleAdjustmentDate(group.date)}
                                          >
                                            <TableCell colSpan={columns.length} className="py-1.5 px-4">
                                              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground italic">
                                                <ChevronUp className="w-3.5 h-3.5" />
                                                <span>Collapse {adjustments.length} Balance Adjustments</span>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        )}
                                        {adjustments.map((tx) => (
                                          <TableRow
                                            key={tx.id}
                                            className={cn("transition-colors hover:bg-[var(--glass-hover)] zebra-row", getRowClassName(tx))}
                                          >
                                            {columns.map((col, colIndex) => (
                                              <TableCell key={colIndex} className={col.className}>
                                                {col.cell ? col.cell(tx) : (col.accessorKey ? String(tx[col.accessorKey] ?? "") : null)}
                                              </TableCell>
                                            ))}
                                          </TableRow>
                                        ))}
                                      </>
                                    )}
                                  </>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>

                <div className="md:hidden flex flex-col gap-2">
                  {dateGroups.map((group) => {
                    const adjustments = group.transactions.filter(isBalanceAdjustment);
                    const nonAdjustments = group.transactions.filter((tx) => !isBalanceAdjustment(tx));
                    const hasMultipleAdj = adjustments.length > 1;
                    const isAdjExpanded = expandedAdjustmentDates.has(group.date);

                    return (
                      <div key={group.date}>
                        <div className="sticky top-0 z-10 flex items-center justify-between py-2 px-1 mb-1 glass-2 border-b border-[var(--divider-color)]">
                          <span className="text-xs font-semibold font-mono text-foreground/80">{group.formattedDate}</span>
                          {group.dailySpend > 0 && (
                            <SensitiveValue className="text-xs font-mono text-muted-foreground">— {formatCurrency(group.dailySpend)}</SensitiveValue>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 mb-3">
                          {nonAdjustments.map((tx) => renderMobileCard(tx))}
                          {showAdjustments && adjustments.length > 0 && (
                            <>
                              {hasMultipleAdj && !isAdjExpanded ? (
                                <button
                                  onClick={() => toggleAdjustmentDate(group.date)}
                                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-muted-foreground/30 opacity-60 text-xs font-mono text-muted-foreground italic hover:opacity-80 transition-opacity"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                  <span>{adjustments.length} Balance Adjustments</span>
                                </button>
                              ) : (
                                <>
                                  {hasMultipleAdj && (
                                    <button
                                      onClick={() => toggleAdjustmentDate(group.date)}
                                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-muted-foreground/30 opacity-60 text-xs font-mono text-muted-foreground italic hover:opacity-80 transition-opacity"
                                    >
                                      <ChevronUp className="w-3.5 h-3.5" />
                                      <span>Collapse</span>
                                    </button>
                                  )}
                                  {adjustments.map((tx) => renderMobileCard(tx))}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {totalCount > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[var(--divider-color)]">
                <p className="text-xs font-mono text-muted-foreground">
                  Showing {showingFrom}–{showingTo} of {totalCount} transactions
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        if (totalPages <= 7) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (Math.abs(page - currentPage) <= 1) return true;
                        return false;
                      })
                      .map((page, idx, arr) => {
                        const prev = arr[idx - 1];
                        const showEllipsis = prev !== undefined && page - prev > 1;
                        return (
                          <span key={page} className="flex items-center">
                            {showEllipsis && <span className="px-1 text-muted-foreground text-xs">…</span>}
                            <Button
                              variant={currentPage === page ? "default" : "outline"}
                              size="icon"
                              className="h-8 w-8 text-xs"
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </Button>
                          </span>
                        );
                      })}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
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

      <EditTransactionPanel
        editingTx={editingTx}
        onClose={() => setEditingTx(null)}
        editForm={editForm}
        onEditSubmit={onEditSubmit}
        onEditTypeChange={onEditTypeChange}
        editFilteredCategories={editFilteredCategories}
        accounts={accounts ?? []}
        isAddingCategory={isAddingCategory}
        setIsAddingCategory={setIsAddingCategory}
        newCatName={newCatName}
        setNewCatName={setNewCatName}
        handleAddCategory={handleEditAddCategory}
        createCategory={createCategory}
        updateTx={updateTx}
      />

      <TransferModal
        open={isTransferOpen}
        onOpenChange={setIsTransferOpen}
        initialValues={transferInitialValues}
      />
    </div>
  );
}

function EditTransactionPanel({
  editingTx,
  onClose,
  editForm,
  onEditSubmit,
  onEditTypeChange,
  editFilteredCategories,
  accounts,
  isAddingCategory,
  setIsAddingCategory,
  newCatName,
  setNewCatName,
  handleAddCategory,
  createCategory,
  updateTx,
}: {
  editingTx: Transaction | null;
  onClose: () => void;
  editForm: ReturnType<typeof useForm<FormValues>>;
  onEditSubmit: (data: FormValues) => void;
  onEditTypeChange: (val: "Income" | "Expense") => void;
  editFilteredCategories: Array<{ id: number; name: string }>;
  accounts: Array<{ id: number; name: string }>;
  isAddingCategory: boolean;
  setIsAddingCategory: (v: boolean) => void;
  newCatName: string;
  setNewCatName: (v: string) => void;
  handleAddCategory: () => void;
  createCategory: { isPending: boolean };
  updateTx: { isPending: boolean };
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (isMobile) {
    return (
      <Sheet open={editingTx !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Edit Transaction</SheetTitle>
          </SheetHeader>
          <TransactionFormFields
            form={editForm}
            onSubmit={onEditSubmit}
            onTypeChange={onEditTypeChange}
            filteredCategories={editFilteredCategories}
            accounts={accounts}
            isAddingCategory={isAddingCategory}
            setIsAddingCategory={setIsAddingCategory}
            newCatName={newCatName}
            setNewCatName={setNewCatName}
            handleAddCategory={handleAddCategory}
            createCategory={createCategory}
            createTx={updateTx}
            submitLabel="Update Transaction"
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={editingTx !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
        </DialogHeader>
        <TransactionFormFields
          form={editForm}
          onSubmit={onEditSubmit}
          onTypeChange={onEditTypeChange}
          filteredCategories={editFilteredCategories}
          accounts={accounts}
          isAddingCategory={isAddingCategory}
          setIsAddingCategory={setIsAddingCategory}
          newCatName={newCatName}
          setNewCatName={setNewCatName}
          handleAddCategory={handleAddCategory}
          createCategory={createCategory}
          createTx={updateTx}
          submitLabel="Update Transaction"
        />
      </DialogContent>
    </Dialog>
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
  submitLabel,
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
  submitLabel?: string;
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
            {createTx.isPending ? "Saving..." : (submitLabel || "Save Transaction")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function MobileFilterBar({
  search,
  setSearch,
  filterCategory,
  setFilterCategory,
  filterType,
  setFilterType,
  filterAccount,
  setFilterAccount,
  dateRange,
  setDateRange,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  amountMin,
  setAmountMin,
  amountMax,
  setAmountMax,
  sortField,
  setSortField,
  sortDir,
  setSortDir,
  showAdjustments,
  setShowAdjustments,
  activeFilterCount,
  clearAllFilters,
  categories,
  accounts,
}: {
  search: string;
  setSearch: (v: string) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  filterAccount: string;
  setFilterAccount: (v: string) => void;
  dateRange: string;
  setDateRange: (v: string) => void;
  customFrom: Date | undefined;
  setCustomFrom: (v: Date | undefined) => void;
  customTo: Date | undefined;
  setCustomTo: (v: Date | undefined) => void;
  amountMin: string;
  setAmountMin: (v: string) => void;
  amountMax: string;
  setAmountMax: (v: string) => void;
  sortField: string;
  setSortField: (v: string) => void;
  sortDir: string;
  setSortDir: (v: React.SetStateAction<"asc" | "desc">) => void;
  showAdjustments: boolean;
  setShowAdjustments: (v: boolean) => void;
  activeFilterCount: number;
  clearAllFilters: () => void;
  categories: Array<{ id: number; name: string }> | undefined;
  accounts: Array<{ id: number; name: string }> | undefined;
}) {
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const mobileFilterCount = useMemo(() => {
    let count = 0;
    if (filterCategory !== "all") count++;
    if (filterType !== "all") count++;
    if (filterAccount !== "all") count++;
    if (amountMin) count++;
    if (amountMax) count++;
    if (dateRange !== "all") count++;
    return count;
  }, [filterCategory, filterType, filterAccount, amountMin, amountMax, dateRange]);

  return (
    <div className="md:hidden flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search transactions..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs font-mono relative">
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              Filters
              {mobileFilterCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {mobileFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between">
                <span>Filters</span>
                {mobileFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground h-8"
                    onClick={() => { clearAllFilters(); setFilterSheetOpen(false); }}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear All
                  </Button>
                )}
              </SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-full h-11 text-sm">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full h-11 text-sm">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Expense">Expense</SelectItem>
                    <SelectItem value="Income">Income</SelectItem>
                    <SelectItem value="Transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Account</label>
                <Select value={filterAccount} onValueChange={setFilterAccount}>
                  <SelectTrigger className="w-full h-11 text-sm">
                    <SelectValue placeholder="All Accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts?.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Time Period</label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-full h-11 text-sm">
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
                  <div className="flex gap-2 items-center mt-2">
                    <DatePicker date={customFrom} onSelect={setCustomFrom} placeholder="From" className="flex-1" />
                    <span className="text-muted-foreground text-xs">to</span>
                    <DatePicker date={customTo} onSelect={setCustomTo} placeholder="To" className="flex-1" />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Amount Range</label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    placeholder="Min ₹"
                    className="flex-1 h-11 text-sm font-mono"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input
                    type="number"
                    placeholder="Max ₹"
                    className="flex-1 h-11 text-sm font-mono"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Sort By</label>
                <div className="flex gap-2">
                  <Select value={sortField} onValueChange={setSortField}>
                    <SelectTrigger className="flex-1 h-11 text-sm">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="amount">Amount</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                      <SelectItem value="description">Description</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="h-11 px-4" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
                    {sortDir === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <button
                  onClick={() => setShowAdjustments(!showAdjustments)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono border transition-colors w-full justify-center ${
                    showAdjustments
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-background/50 text-muted-foreground border-[var(--divider-color)]"
                  }`}
                >
                  {showAdjustments ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showAdjustments ? "Hide" : "Show"} Balance Adjustments
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={clearAllFilters}
          >
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
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
