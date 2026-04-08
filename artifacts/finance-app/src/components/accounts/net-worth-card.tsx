import { formatCurrency } from "@/lib/constants";
import { SensitiveValue } from "@/components/sensitive-value";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/query-error-state";
import { TrendingUp, TrendingDown } from "lucide-react";

interface NetWorthCardProps {
  netWorth: number;
  totalBank: number;
  totalCcOutstanding: number;
  totalLoanOutstanding: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function NetWorthCard({ netWorth, totalBank, totalCcOutstanding, totalLoanOutstanding, isLoading, isError, refetch }: NetWorthCardProps) {
  return (
    <Card className="glass-card glass-animate-in glass-stagger-1 rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-2">
          {netWorth >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-destructive" />} Net Worth
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-60" />
          </div>
        ) : isError ? (
          <QueryErrorState onRetry={() => refetch()} message="Failed to load accounts" />
        ) : (
          <>
            <SensitiveValue as="div" className={`text-4xl font-bold font-mono tracking-tight ${netWorth >= 0 ? "text-emerald-500" : "text-destructive"}`}>
              {formatCurrency(netWorth)}
            </SensitiveValue>

            {(totalBank > 0 || totalCcOutstanding > 0 || totalLoanOutstanding > 0) && (() => {
              const totalAbs = totalBank + totalCcOutstanding + totalLoanOutstanding;
              const bankPct = totalAbs > 0 ? (totalBank / totalAbs) * 100 : 0;
              const ccPct = totalAbs > 0 ? (totalCcOutstanding / totalAbs) * 100 : 0;
              const loanPct = totalAbs > 0 ? (totalLoanOutstanding / totalAbs) * 100 : 0;
              return (
                <div className="mt-3 space-y-2">
                  <div className="w-full h-3 rounded-full overflow-hidden flex bg-secondary/50">
                    {bankPct > 0 && (
                      <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${bankPct}%` }} />
                    )}
                    {ccPct > 0 && (
                      <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${ccPct}%` }} />
                    )}
                    {loanPct > 0 && (
                      <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${loanPct}%` }} />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                      <span className="text-muted-foreground">Assets</span>
                      <SensitiveValue className="text-emerald-500 font-semibold">{formatCurrency(totalBank)}</SensitiveValue>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />
                      <span className="text-muted-foreground">CC Debt</span>
                      <SensitiveValue className="text-red-500 font-semibold">{formatCurrency(totalCcOutstanding)}</SensitiveValue>
                    </span>
                    {totalLoanOutstanding > 0 && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                        <span className="text-muted-foreground">Loans</span>
                        <SensitiveValue className="text-amber-500 font-semibold">{formatCurrency(totalLoanOutstanding)}</SensitiveValue>
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </CardContent>
    </Card>
  );
}
