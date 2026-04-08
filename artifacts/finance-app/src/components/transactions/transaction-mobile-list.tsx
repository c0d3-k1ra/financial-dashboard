import type { Transaction } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/constants";
import { SensitiveValue } from "@/components/sensitive-value";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ArrowDownRight, ArrowLeftRight, Info, ChevronDown, ChevronUp } from "lucide-react";
import { CategoryBadge } from "@/components/category-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MobileTransactionListProps {
  dateGroups: Array<{
    date: string;
    formattedDate: string;
    dailySpend: number;
    transactions: Transaction[];
  }>;
  accounts: Array<{ id: number; name: string }> | undefined;
  showAdjustments: boolean;
  expandedAdjustmentDates: Set<string>;
  toggleAdjustmentDate: (date: string) => void;
  openEdit: (tx: Transaction) => void;
  setDeleteId: (id: number) => void;
  handleCategoryClick: (category: string) => void;
  isBalanceAdjustment: (tx: Transaction) => boolean;
}

function MobileCard({
  tx, accounts, openEdit, setDeleteId, handleCategoryClick, isBalanceAdjustment,
}: {
  tx: Transaction;
  accounts: Array<{ id: number; name: string }> | undefined;
  openEdit: (tx: Transaction) => void;
  setDeleteId: (id: number) => void;
  handleCategoryClick: (category: string) => void;
  isBalanceAdjustment: (tx: Transaction) => boolean;
}) {
  const acct = accounts?.find((a) => a.id === tx.accountId);
  const toAcct = tx.toAccountId ? accounts?.find((a) => a.id === tx.toAccountId) : null;
  const isIncome = tx.type === "Income";
  const isTransfer = tx.type === "Transfer";
  const isAdj = isBalanceAdjustment(tx);

  return (
    <div
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
}

export function MobileTransactionList({
  dateGroups, accounts,
  showAdjustments, expandedAdjustmentDates, toggleAdjustmentDate,
  openEdit, setDeleteId, handleCategoryClick, isBalanceAdjustment,
}: MobileTransactionListProps) {
  return (
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
              {nonAdjustments.map((tx) => (
                <MobileCard
                  key={tx.id}
                  tx={tx}
                  accounts={accounts}
                  openEdit={openEdit}
                  setDeleteId={setDeleteId}
                  handleCategoryClick={handleCategoryClick}
                  isBalanceAdjustment={isBalanceAdjustment}
                />
              ))}
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
                      {adjustments.map((tx) => (
                        <MobileCard
                          key={tx.id}
                          tx={tx}
                          accounts={accounts}
                          openEdit={openEdit}
                          setDeleteId={setDeleteId}
                          handleCategoryClick={handleCategoryClick}
                          isBalanceAdjustment={isBalanceAdjustment}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
