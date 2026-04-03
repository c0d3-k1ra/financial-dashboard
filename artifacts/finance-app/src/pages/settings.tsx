import { useState, useMemo } from "react";
import {
  useListCategories,
  useCreateCategory,
  useDeleteCategory,
  useRenameCategory,
  useGetSettings,
  useUpdateSettings,
  useResetData,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage, setActiveCurrency } from "@/lib/constants";
import { Plus, Trash2, Tag, Pencil, Check, X, Calendar, DollarSign, AlertTriangle, Search, CheckCircle2, Palette } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { getCategoryIcon } from "@/lib/category-icons";

const CYCLE_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);
const CURRENCIES = [
  { code: "INR", label: "INR - Indian Rupee" },
  { code: "USD", label: "USD - US Dollar" },
  { code: "EUR", label: "EUR - Euro" },
  { code: "GBP", label: "GBP - British Pound" },
];

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<string>("Expense");
  const [deleteCatId, setDeleteCatId] = useState<number | null>(null);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingType, setEditingType] = useState<string>("Expense");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [billingSaved, setBillingSaved] = useState(false);
  const [currencySaved, setCurrencySaved] = useState(false);
  const { themeId, setThemeId, themes } = useTheme();

  const { data: categories, isLoading } = useListCategories(
    {},
    { query: { queryKey: ["/api/categories"] } }
  );

  const { data: settings, isLoading: settingsLoading } = useGetSettings({
    query: { queryKey: ["/api/settings"] },
  });

  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const renameCategory = useRenameCategory();
  const updateSettings = useUpdateSettings();
  const resetData = useResetData();

  const allCategories = categories ?? [];

  const expenseCategories = useMemo(() => {
    const filtered = allCategories.filter((c) => c.type === "Expense");
    if (!searchQuery.trim()) return filtered;
    return filtered.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allCategories, searchQuery]);

  const incomeCategories = useMemo(() => {
    const filtered = allCategories.filter((c) => c.type === "Income");
    if (!searchQuery.trim()) return filtered;
    return filtered.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allCategories, searchQuery]);

  const duplicateError = useMemo(() => {
    const trimmed = newCategoryName.trim().toLowerCase();
    if (!trimmed) return "";
    const exists = allCategories.some((c) => c.name.toLowerCase() === trimmed);
    return exists ? `"${newCategoryName.trim()}" already exists` : "";
  }, [newCategoryName, allCategories]);

  const handleAdd = () => {
    if (!newCategoryName.trim()) {
      toast({ title: "Category name is required", variant: "destructive" });
      return;
    }
    if (duplicateError) {
      toast({ title: duplicateError, variant: "destructive" });
      return;
    }

    createCategory.mutate(
      { data: { name: newCategoryName.trim(), type: newCategoryType } },
      {
        onSuccess: () => {
          toast({ title: "Category added" });
          setNewCategoryName("");
          queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
        },
        onError: (err) => {
          toast({ title: "Failed to add category", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const confirmDeleteCategory = () => {
    if (deleteCatId === null) return;
    deleteCategory.mutate(
      { id: deleteCatId },
      {
        onSuccess: () => {
          toast({ title: "Category deleted" });
          setDeleteCatId(null);
          queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
        },
        onError: (err) => {
          toast({ title: "Failed to delete category", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const startEditing = (cat: { id: number; name: string; type: string }) => {
    setEditingCatId(cat.id);
    setEditingName(cat.name);
    setEditingType(cat.type);
  };

  const cancelEditing = () => {
    setEditingCatId(null);
    setEditingName("");
    setEditingType("Expense");
  };

  const saveRename = () => {
    if (editingCatId === null || !editingName.trim()) return;

    renameCategory.mutate(
      { id: editingCatId, data: { name: editingName.trim() } },
      {
        onSuccess: () => {
          toast({ title: "Category renamed" });
          cancelEditing();
          queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
        },
        onError: (err) => {
          toast({ title: "Failed to rename category", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const handleBillingCycleDayChange = (value: string) => {
    const day = parseInt(value);
    updateSettings.mutate(
      { data: { billingCycleDay: day } },
      {
        onSuccess: () => {
          setBillingSaved(true);
          setTimeout(() => setBillingSaved(false), 2000);
          queryClient.invalidateQueries();
        },
        onError: (err) => {
          toast({ title: "Failed to update billing cycle", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const handleCurrencyChange = (value: string) => {
    updateSettings.mutate(
      { data: { currencyCode: value } },
      {
        onSuccess: () => {
          setActiveCurrency(value);
          setCurrencySaved(true);
          setTimeout(() => setCurrencySaved(false), 2000);
          queryClient.invalidateQueries();
        },
        onError: (err) => {
          toast({ title: "Failed to update currency", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const handleResetData = () => {
    resetData.mutate(
      {},
      {
        onSuccess: () => {
          toast({ title: "All data has been reset" });
          setShowResetDialog(false);
          setResetConfirmText("");
          queryClient.invalidateQueries();
        },
        onError: (err) => {
          toast({ title: "Failed to reset data", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const totalExpense = expenseCategories.length;
  const totalIncome = incomeCategories.length;

  const renderCategoryRow = (cat: { id: number; name: string; type: string }) => {
    const Icon = getCategoryIcon(cat.name);
    const isEditing = editingCatId === cat.id;

    return (
      <div
        key={cat.id}
        className="flex items-center justify-between p-3 rounded-lg glass-2 hover:bg-white/[0.06] transition-colors group"
      >
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1 mr-3">
            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              className="h-8 text-sm flex-1 max-w-[200px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") cancelEditing();
              }}
            />
            <Select value={editingType} onValueChange={setEditingType} disabled>
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Expense">Expense</SelectItem>
                <SelectItem value="Income">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <span className="text-sm font-medium inline-flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            {cat.name}
          </span>
        )}
        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                onClick={saveRename}
                disabled={renameCategory.isPending}
              >
                <Check className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                onClick={cancelEditing}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                onClick={() => startEditing(cat)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteCatId(cat.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your categories, billing cycle, currency, and data.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-card glass-animate-in glass-stagger-1 rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5" /> Billing Cycle
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-center flex-1">
            {settingsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Set the day of the month when your billing cycle starts. This affects how transactions are grouped across the app.
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium whitespace-nowrap">Start day:</span>
                  <Select
                    value={String(settings?.billingCycleDay ?? 25)}
                    onValueChange={handleBillingCycleDayChange}
                    disabled={updateSettings.isPending}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CYCLE_DAYS.map((day) => (
                        <SelectItem key={day} value={String(day)}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {billingSaved && (
                    <span className="inline-flex items-center gap-1 text-emerald-500 text-xs font-medium animate-in fade-in duration-300">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card glass-animate-in glass-stagger-2 rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="w-5 h-5" /> Currency
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-center flex-1">
            {settingsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Choose the currency used to display amounts throughout the app.
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium whitespace-nowrap">Currency:</span>
                  <Select
                    value={settings?.currencyCode ?? "INR"}
                    onValueChange={handleCurrencyChange}
                    disabled={updateSettings.isPending}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {currencySaved && (
                    <span className="inline-flex items-center gap-1 text-emerald-500 text-xs font-medium animate-in fade-in duration-300">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card glass-animate-in glass-stagger-3 rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="w-5 h-5" /> Theme
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-center flex-1">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Choose the visual theme for the app.
              </p>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium whitespace-nowrap">Theme:</span>
                <Select value={themeId} onValueChange={setThemeId}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {themes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Tag className="w-5 h-5" /> Category Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-[3] relative">
              <Input
                placeholder="New category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className={`${duplicateError ? "border-destructive/60 focus-visible:ring-destructive/40" : ""}`}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              {duplicateError && (
                <p className="text-destructive text-xs mt-1 absolute -bottom-5 left-0">{duplicateError}</p>
              )}
            </div>
            <Select value={newCategoryType} onValueChange={setNewCategoryType}>
              <SelectTrigger className="w-full sm:w-[130px] flex-[1]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Expense">Expense</SelectItem>
                <SelectItem value="Income">Income</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleAdd}
              disabled={createCategory.isPending || !!duplicateError}
              className="font-mono text-xs uppercase tracking-wider flex-[1]"
            >
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>

          {duplicateError && <div className="h-1" />}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Expense Categories ({totalExpense})
                </h3>
                <div className="space-y-1.5">
                  {expenseCategories.map(renderCategoryRow)}
                  {expenseCategories.length === 0 && (
                    <p className="text-muted-foreground text-sm font-mono py-4 text-center">
                      {searchQuery ? "No matching expense categories." : "No expense categories."}
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-white/[0.06]" />

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Income Categories ({totalIncome})
                </h3>
                <div className="space-y-1.5">
                  {incomeCategories.map(renderCategoryRow)}
                  {incomeCategories.length === 0 && (
                    <p className="text-muted-foreground text-sm font-mono py-4 text-center">
                      {searchQuery ? "No matching income categories." : "No income categories."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card rounded-xl border-destructive/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" /> Data Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Reset all transactions, goals, allocations, and account balances. Categories and settings will be preserved.
            </p>
            <Button
              variant="destructive"
              onClick={() => setShowResetDialog(true)}
              className="font-mono text-xs uppercase tracking-wider"
            >
              Reset All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteCatId !== null} onOpenChange={(open) => { if (!open) setDeleteCatId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete this category? This action cannot be undone.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDeleteCategory} disabled={deleteCategory.isPending}>
              {deleteCategory.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetDialog} onOpenChange={(open) => { if (!open) { setShowResetDialog(false); setResetConfirmText(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Reset All Data
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              This will permanently delete all transactions, goals, surplus allocations, budget goals, and monthly configs. Account balances will be reset to zero. Categories and settings will be preserved.
            </p>
            <p className="text-sm font-medium">
              Type <span className="font-mono text-destructive">RESET</span> to confirm:
            </p>
            <Input
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="Type RESET to confirm"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleResetData}
              disabled={resetConfirmText !== "RESET" || resetData.isPending}
            >
              {resetData.isPending ? "Resetting..." : "Reset All Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
