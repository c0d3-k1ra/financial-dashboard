import React from "react";
import type { Transaction } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/constants";
import { SensitiveValue } from "@/components/sensitive-value";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ArrowDownRight, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeftRight, Info, ChevronDown, ChevronUp } from "lucide-react";
import { CategoryBadge } from "@/components/category-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type SortField = "date" | "amount" | "category" | "description";

interface TransactionTableProps {
  dateGroups: Array<{
    date: string;
    formattedDate: string;
    dailySpend: number;
    transactions: Transaction[];
  }>;
  accounts: Array<{ id: number; name: string }> | undefined;
  sortField: SortField;
  sortDir: "asc" | "desc";
  toggleSort: (field: SortField) => void;
  showAdjustments: boolean;
  expandedAdjustmentDates: Set<string>;
  toggleAdjustmentDate: (date: string) => void;
  openEdit: (tx: Transaction) => void;
  setDeleteId: (id: number) => void;
  handleCategoryClick: (category: string) => void;
  isBalanceAdjustment: (tx: Transaction) => boolean;
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: "asc" | "desc" }) {
  if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
  return sortDir === "asc" ? (
    <ArrowUp className="w-3 h-3 ml-1 text-primary" />
  ) : (
    <ArrowDown className="w-3 h-3 ml-1 text-primary" />
  );
}

export function TransactionTable({
  dateGroups, accounts,
  sortField, sortDir, toggleSort,
  showAdjustments, expandedAdjustmentDates, toggleAdjustmentDate,
  openEdit, setDeleteId, handleCategoryClick, isBalanceAdjustment,
}: TransactionTableProps) {
  const columns = [
    {
      header: (
        <button onClick={() => toggleSort("description")} className="flex items-center hover:text-foreground transition-colors">
          Description <SortIcon field="description" sortField={sortField} sortDir={sortDir} />
        </button>
      ),
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
          Category <SortIcon field="category" sortField={sortField} sortDir={sortDir} />
        </button>
      ),
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
          Amount <SortIcon field="amount" sortField={sortField} sortDir={sortDir} />
        </button>
      ),
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
  );
}
