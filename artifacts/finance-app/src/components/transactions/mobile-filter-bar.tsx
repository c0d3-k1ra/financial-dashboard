import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Search, X, Filter, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";

export function MobileFilterBar({
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
