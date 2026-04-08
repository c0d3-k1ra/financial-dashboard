import { useState, useEffect } from "react";
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

import { getApiErrorMessage } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/query-error-state";
import TransferModal from "@/components/transfer-modal";
import { useAiParseContext } from "@/lib/ai-parse-context";

import { formSchema, type FormValues, EditTransactionPanel, TransactionFormWrapper } from "@/components/transactions/transaction-form";
import { MobileFilterBar } from "@/components/transactions/mobile-filter-bar";
import { DesktopFilterBar } from "@/components/transactions/desktop-filter-bar";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { MobileTransactionList } from "@/components/transactions/transaction-mobile-list";
import { PaginationBar } from "@/components/transactions/pagination-bar";
import { DeleteTransactionDialog } from "@/components/transactions/delete-dialog";
import { useTransactionFilters, useSortedPaginatedTransactions, isBalanceAdjustment, type SortField } from "@/components/transactions/use-transaction-filters";

export default function Transactions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const filters = useTransactionFilters();
  const {
    search, setSearch, sortField, setSortField, sortDir, setSortDir,
    dateRange, setDateRange, customFrom, setCustomFrom, customTo, setCustomTo,
    filterCategory, setFilterCategory, filterAccount, setFilterAccount,
    filterType, setFilterType, amountMin, setAmountMin, amountMax, setAmountMax,
    currentPage, setCurrentPage, showAdjustments, setShowAdjustments,
    expandedAdjustmentDates, setExpandedAdjustmentDates,
    queryParams, activeFilterCount,
    clearAllFilters, toggleSort, toggleAdjustmentDate, handleCategoryClick,
  } = filters;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [transferInitialValues, setTransferInitialValues] = useState<{
    fromAccountId?: string;
    toAccountId?: string;
    amount?: string;
    date?: string;
    description?: string;
  } | undefined>(undefined);

  const { parsedResult, consumeResult } = useAiParseContext();

  const { data: transactions, isLoading, isError, refetch } = useListTransactions(queryParams, {
    query: { enabled: true, queryKey: getListTransactionsQueryKey(queryParams) },
  });

  const { data: categories } = useListCategories({}, { query: { queryKey: ["/api/categories"] } });
  const { data: accounts } = useListAccounts({ query: { queryKey: getListAccountsQueryKey() } });

  const { dateGroups, totalCount, totalPages, showingFrom, showingTo, paginatedTransactions } =
    useSortedPaginatedTransactions(transactions, sortField, sortDir, showAdjustments, currentPage);

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

  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { date: new Date().toISOString().split("T")[0], amount: "", description: "", type: "Expense", category: "", accountId: "" },
  });

  const editForm = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { date: "", amount: "", description: "", type: "Expense", category: "", accountId: "" },
  });

  const handleAddCategory = () => handleAddCategoryFor(form);
  const handleEditAddCategory = () => handleAddCategoryFor(editForm);

  useEffect(() => {
    if (parsedResult) {
      const result = consumeResult();
      if (!result) return;
      if (result.transactionType === "Transfer") {
        setTransferInitialValues({ fromAccountId: result.fromAccountId, toAccountId: result.toAccountId, amount: result.amount, date: result.date, description: result.description });
        setIsTransferOpen(true);
      } else {
        form.reset({ date: result.date || new Date().toISOString().split("T")[0], amount: result.amount || "", description: result.description || "", type: result.transactionType || "Expense", category: result.category || "", accountId: result.accountId || "" });
        setIsDialogOpen(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- consumeResult and form are stable; including them causes infinite re-renders
  }, [parsedResult]);

  const watchType = form.watch("type");
  const filteredCategories = categories?.filter((c) => c.type === watchType) ?? [];
  const editWatchType = editForm.watch("type");
  const editFilteredCategories = categories?.filter((c) => c.type === editWatchType) ?? [];

  const onTypeChange = (val: "Income" | "Expense") => { form.setValue("type", val); form.setValue("category", ""); };
  const onEditTypeChange = (val: "Income" | "Expense") => { editForm.setValue("type", val); editForm.setValue("category", ""); };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey(queryParams) });
    queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMonthlySurplusQueryKey() });
  };

  const onSubmit = (data: FormValues) => {
    createTx.mutate(
      { data: { ...data, accountId: Number(data.accountId) } },
      {
        onSuccess: () => { toast({ title: "Transaction added successfully" }); setIsDialogOpen(false); form.reset(); invalidateAll(); },
        onError: (err) => { toast({ title: "Failed to add transaction", description: getApiErrorMessage(err), variant: "destructive" }); },
      }
    );
  };

  const onEditSubmit = (data: FormValues) => {
    if (!editingTx) return;
    updateTx.mutate(
      { id: editingTx.id, data: { ...data, accountId: Number(data.accountId) } },
      {
        onSuccess: () => { toast({ title: "Transaction updated" }); setEditingTx(null); invalidateAll(); },
        onError: (err) => { toast({ title: "Failed to update transaction", description: getApiErrorMessage(err), variant: "destructive" }); },
      }
    );
  };

  const openEdit = (tx: Transaction) => {
    editForm.reset({ date: tx.date, amount: tx.amount, description: tx.description, type: tx.type as "Income" | "Expense", category: tx.category, accountId: String(tx.accountId) });
    setEditingTx(tx);
  };

  const confirmDelete = () => {
    if (deleteId === null) return;
    deleteTx.mutate(
      { id: deleteId },
      {
        onSuccess: () => { toast({ title: "Transaction deleted" }); setDeleteId(null); invalidateAll(); },
        onError: (err) => { toast({ title: "Failed to delete transaction", description: getApiErrorMessage(err), variant: "destructive" }); },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Ledger</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and manage your daily cash flow.</p>
        </div>

        <TransactionFormWrapper
          isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} form={form} onSubmit={onSubmit}
          onTypeChange={onTypeChange} filteredCategories={filteredCategories} accounts={accounts ?? []}
          isAddingCategory={isAddingCategory} setIsAddingCategory={setIsAddingCategory}
          newCatName={newCatName} setNewCatName={setNewCatName} handleAddCategory={handleAddCategory}
          createCategory={createCategory} createTx={createTx}
        />
      </div>

      <div className="glass-1 p-4 md:p-6 flex flex-col gap-4">
        <DesktopFilterBar
          search={search} setSearch={setSearch} filterCategory={filterCategory} setFilterCategory={setFilterCategory}
          filterType={filterType} setFilterType={setFilterType} filterAccount={filterAccount} setFilterAccount={setFilterAccount}
          dateRange={dateRange} setDateRange={setDateRange} customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo} setCustomTo={setCustomTo} amountMin={amountMin} setAmountMin={setAmountMin}
          amountMax={amountMax} setAmountMax={setAmountMax} showAdjustments={showAdjustments} setShowAdjustments={setShowAdjustments}
          activeFilterCount={activeFilterCount} clearAllFilters={clearAllFilters} categories={categories} accounts={accounts}
          setCurrentPage={setCurrentPage} setExpandedAdjustmentDates={setExpandedAdjustmentDates}
        />

        <MobileFilterBar
          search={search} setSearch={setSearch} filterCategory={filterCategory}
          setFilterCategory={(v) => { setFilterCategory(v); setCurrentPage(1); }}
          filterType={filterType} setFilterType={(v) => { setFilterType(v); setCurrentPage(1); }}
          filterAccount={filterAccount} setFilterAccount={(v) => { setFilterAccount(v); setCurrentPage(1); }}
          dateRange={dateRange} setDateRange={setDateRange} customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo} setCustomTo={setCustomTo}
          amountMin={amountMin} setAmountMin={(v) => { setAmountMin(v); setCurrentPage(1); }}
          amountMax={amountMax} setAmountMax={(v) => { setAmountMax(v); setCurrentPage(1); }}
          sortField={sortField} setSortField={(v) => setSortField(v as SortField)} sortDir={sortDir} setSortDir={setSortDir}
          showAdjustments={showAdjustments} setShowAdjustments={(v) => { setShowAdjustments(v); if (!v) setExpandedAdjustmentDates(new Set()); setCurrentPage(1); }}
          activeFilterCount={activeFilterCount} clearAllFilters={clearAllFilters} categories={categories} accounts={accounts}
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
        ) : isError ? (
          <QueryErrorState onRetry={() => refetch()} message="Failed to load transactions" className="mt-4" />
        ) : (
          <>
            {paginatedTransactions.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-[var(--divider-color)] rounded-lg glass-2">
                {activeFilterCount > 0 ? (
                  <>
                    <p className="text-muted-foreground font-mono text-sm">No transactions match your filters.</p>
                    <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={clearAllFilters}>
                      <X className="w-3 h-3 mr-1" /> Clear All Filters
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
                <TransactionTable
                  dateGroups={dateGroups} accounts={accounts} sortField={sortField} sortDir={sortDir}
                  toggleSort={toggleSort} showAdjustments={showAdjustments} expandedAdjustmentDates={expandedAdjustmentDates}
                  toggleAdjustmentDate={toggleAdjustmentDate} openEdit={openEdit} setDeleteId={setDeleteId}
                  handleCategoryClick={handleCategoryClick} isBalanceAdjustment={isBalanceAdjustment}
                />
                <MobileTransactionList
                  dateGroups={dateGroups} accounts={accounts} showAdjustments={showAdjustments}
                  expandedAdjustmentDates={expandedAdjustmentDates} toggleAdjustmentDate={toggleAdjustmentDate}
                  openEdit={openEdit} setDeleteId={setDeleteId} handleCategoryClick={handleCategoryClick}
                  isBalanceAdjustment={isBalanceAdjustment}
                />
              </>
            )}
            <PaginationBar currentPage={currentPage} totalPages={totalPages} totalCount={totalCount}
              showingFrom={showingFrom} showingTo={showingTo} setCurrentPage={setCurrentPage} />
          </>
        )}
      </div>

      <DeleteTransactionDialog deleteId={deleteId} setDeleteId={setDeleteId} confirmDelete={confirmDelete} isPending={deleteTx.isPending} />

      <EditTransactionPanel
        editingTx={editingTx} onClose={() => setEditingTx(null)} editForm={editForm} onEditSubmit={onEditSubmit}
        onEditTypeChange={onEditTypeChange} editFilteredCategories={editFilteredCategories} accounts={accounts ?? []}
        isAddingCategory={isAddingCategory} setIsAddingCategory={setIsAddingCategory} newCatName={newCatName}
        setNewCatName={setNewCatName} handleAddCategory={handleEditAddCategory} createCategory={createCategory} updateTx={updateTx}
      />

      <TransferModal open={isTransferOpen} onOpenChange={setIsTransferOpen} initialValues={transferInitialValues} />
    </div>
  );
}
