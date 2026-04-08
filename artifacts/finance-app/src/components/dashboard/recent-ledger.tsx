import { formatCurrency } from "@/lib/constants";
import { getCategoryIcon } from "@/lib/category-icons";
import { SensitiveValue } from "@/components/sensitive-value";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/query-error-state";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

interface RecentLedgerProps {
  groupedTxs: Array<{
    date: string;
    label: string;
    txs: Array<{
      id: number;
      description: string;
      category: string;
      type: string;
      amount: string | number;
    }>;
  }>;
  isLoadingTxs: boolean;
  isErrorTxs: boolean;
  refetchTxs: () => void;
}

export function RecentLedger({ groupedTxs, isLoadingTxs, isErrorTxs, refetchTxs }: RecentLedgerProps) {
  return (
    <Card className="glass-card rounded-xl flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Recent Ledger</CardTitle>
        <Link href="/transactions" className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors">
          View All <ArrowRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoadingTxs ? (
          <div className="space-y-4 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isErrorTxs ? (
          <QueryErrorState onRetry={() => refetchTxs()} message="Failed to load recent transactions" />
        ) : groupedTxs.length > 0 ? (
          <div className="pt-2 space-y-1">
            {groupedTxs.map((group) => (
              <div key={group.date}>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground py-1.5 border-b border-border/30 mb-1.5">
                  {group.label}
                </div>
                {group.txs.map((tx) => {
                  const Icon = getCategoryIcon(tx.category);
                  return (
                    <div key={tx.id} className="flex justify-between items-center pb-2.5 mb-2.5 border-b border-border/20 last:border-0 last:pb-0 last:mb-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          tx.type === "Income" ? "bg-emerald-500/10" : "bg-rose-500/10"
                        }`}>
                          <Icon className={`w-4 h-4 ${tx.type === "Income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium line-clamp-1">{tx.description}</span>
                          <span className="text-xs text-muted-foreground font-mono truncate max-w-[100px]">{tx.category}</span>
                        </div>
                      </div>
                      <SensitiveValue className={`tabular-nums text-sm font-bold ${tx.type === "Income" ? "text-emerald-500" : "text-foreground"}`}>
                        {tx.type === "Income" ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </SensitiveValue>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-border/50 p-6 text-center">
            No recent transactions
          </div>
        )}
      </CardContent>
    </Card>
  );
}
