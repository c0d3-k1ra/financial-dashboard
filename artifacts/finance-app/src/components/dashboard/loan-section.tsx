import { formatCurrency } from "@/lib/constants";
import { SensitiveValue } from "@/components/sensitive-value";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Landmark } from "lucide-react";

interface LoanAccount {
  id: number;
  name: string;
  currentBalance: string | number;
  emiAmount?: string | number | null;
  emiDay?: number | null;
  loanTenure?: number | null;
  interestRate?: string | number | null;
  originalLoanAmount?: string | number | null;
  loanStartDate?: string | null;
  emisPaid?: number | null;
}

interface LoanSectionProps {
  loanAccounts: LoanAccount[];
  totalLoanOutstanding: string | number;
  totalEmiDue: string | number;
}

export function LoanSection({ loanAccounts, totalLoanOutstanding, totalEmiDue }: LoanSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="glass-card rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Landmark className="w-4 h-4 text-amber-500" /> Loan Outstanding
          </CardTitle>
          <CardDescription>Total loan principal remaining</CardDescription>
        </CardHeader>
        <CardContent>
          <SensitiveValue as="div" className="text-3xl font-bold tabular-nums text-amber-500">
            {formatCurrency(totalLoanOutstanding || 0)}
          </SensitiveValue>
          {Number(totalEmiDue || 0) > 0 && (
            <SensitiveValue as="div" className="text-sm tabular-nums text-muted-foreground mt-2">
              Monthly EMI burden: {formatCurrency(totalEmiDue || 0)}
            </SensitiveValue>
          )}
          {loanAccounts.length > 0 && (
            <div className="mt-4 space-y-3">
              {loanAccounts.map((loan) => {
                const balance = Number(loan.currentBalance ?? 0);
                const emi = Number(loan.emiAmount ?? 0);
                const originalAmount = loan.originalLoanAmount ? Number(loan.originalLoanAmount) : null;
                const emisPaidCount = Number(loan.emisPaid ?? 0);
                const tenure = loan.loanTenure ? Number(loan.loanTenure) : null;

                const principalPaid = originalAmount ? originalAmount - balance : 0;
                const paidPct = originalAmount && originalAmount > 0
                  ? Math.max(0, Math.min(100, (principalPaid / originalAmount) * 100))
                  : 0;

                const interestPaidSoFar = emi && originalAmount
                  ? Math.max(0, (emi * emisPaidCount) - principalPaid)
                  : 0;

                const emisRemaining = tenure ? tenure - emisPaidCount : null;

                let estimatedPayoff: string | null = null;
                if (loan.loanStartDate && tenure) {
                  const startDate = new Date(loan.loanStartDate);
                  startDate.setMonth(startDate.getMonth() + tenure);
                  estimatedPayoff = startDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                } else if (emisRemaining && emisRemaining > 0) {
                  const payoffDate = new Date();
                  payoffDate.setMonth(payoffDate.getMonth() + emisRemaining);
                  estimatedPayoff = payoffDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                }

                return (
                  <div key={loan.id} className="p-3 rounded-md bg-secondary/30 border border-border/50">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-medium">{loan.name}</span>
                      <SensitiveValue className="text-xs tabular-nums text-muted-foreground">
                        {emi > 0 ? `${formatCurrency(emi)}/mo` : "—"}
                      </SensitiveValue>
                    </div>
                    {originalAmount && originalAmount > 0 && (
                      <>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Progress
                            value={paidPct}
                            className="h-1.5 bg-secondary flex-1"
                            indicatorClassName="bg-amber-500"
                          />
                          <span className="text-[10px] tabular-nums text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">
                            {paidPct.toFixed(0)}% paid
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                          <span>Outstanding: {formatCurrency(balance)}</span>
                          <span>Principal Paid: {formatCurrency(principalPaid)}</span>
                          {interestPaidSoFar > 0 && (
                            <span>Interest Paid: {formatCurrency(interestPaidSoFar)}</span>
                          )}
                          {emisRemaining != null && (
                            <span>EMIs: {emisPaidCount}/{tenure}{emisRemaining > 0 ? ` (${emisRemaining} left)` : ""}</span>
                          )}
                        </div>
                        {estimatedPayoff && (
                          <div className="text-xs text-muted-foreground tabular-nums mt-0.5">
                            Payoff: {estimatedPayoff}
                          </div>
                        )}
                      </>
                    )}
                    {!originalAmount && emi > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Set original loan amount for accurate tracking</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Landmark className="w-4 h-4 text-amber-500" /> Upcoming EMI Dues
          </CardTitle>
          <CardDescription>Active loan EMI schedule</CardDescription>
        </CardHeader>
        <CardContent>
          {loanAccounts.length > 0 ? (
            <div className="space-y-3">
              {loanAccounts.map((loan) => (
                <div key={loan.id} className="p-3 rounded-md bg-secondary/30 border border-border/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{loan.name}</p>
                      <SensitiveValue as="div" className="text-lg font-bold tabular-nums mt-0.5">
                        {loan.emiAmount ? formatCurrency(loan.emiAmount) : "—"}/mo
                      </SensitiveValue>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {loan.emiDay && (
                        <span className="text-xs font-mono px-2 py-1 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          {loan.emiDay}th
                        </span>
                      )}
                      {loan.interestRate && (
                        <span className="text-xs tabular-nums text-muted-foreground">@ {loan.interestRate}%</span>
                      )}
                    </div>
                  </div>
                  <SensitiveValue as="div" className="text-xs text-muted-foreground tabular-nums mt-1">
                    Outstanding: {formatCurrency(loan.currentBalance)}
                  </SensitiveValue>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-border/50 p-6 text-center">
              No active loans
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
