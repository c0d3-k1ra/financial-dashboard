import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Search, X, Filter, Eye, EyeOff } from "lucide-react";

interface DesktopFilterBarProps {
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
  showAdjustments: boolean;
  setShowAdjustments: (v: boolean) => void;
  activeFilterCount: number;
  clearAllFilters: () => void;
  categories: Array<{ id: number; name: string }> | undefined;
  accounts: Array<{ id: number; name: string }> | undefined;
  setCurrentPage: (v: number) => void;
  setExpandedAdjustmentDates: (v: Set<string>) => void;
}

export function DesktopFilterBar({
  search, setSearch,
  filterCategory, setFilterCategory,
  filterType, setFilterType,
  filterAccount, setFilterAccount,
  dateRange, setDateRange,
  customFrom, setCustomFrom,
  customTo, setCustomTo,
  amountMin, setAmountMin,
  amountMax, setAmountMax,
  showAdjustments, setShowAdjustments,
  activeFilterCount, clearAllFilters,
  categories, accounts,
  setCurrentPage, setExpandedAdjustmentDates,
}: DesktopFilterBarProps) {
  return (
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
            setShowAdjustments(!showAdjustments);
            if (showAdjustments) setExpandedAdjustmentDates(new Set());
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
  );
}
