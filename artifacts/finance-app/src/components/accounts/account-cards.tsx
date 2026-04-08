import React from "react";
import { formatCurrency, getOrdinalSuffix } from "@/lib/constants";
import { SensitiveValue } from "@/components/sensitive-value";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2, Wallet, CreditCard, Landmark, RefreshCw, Pencil, ChevronDown } from "lucide-react";

interface AccountType {
  id: number;
  name: string;
  type: string;
  currentBalance: string | number;
  creditLimit?: string | number | null;
  sharedLimitGroup?: string | null;
  billingDueDay?: number | null;
  emiAmount?: string | number | null;
  emiDay?: number | null;
  loanTenure?: number | null;
  interestRate?: string | number | null;
  linkedAccountId?: number | null;
  useInSurplus?: boolean;
  originalLoanAmount?: string | number | null;
  loanStartDate?: string | null;
  emisPaid?: number | null;
}

interface AccountCardSectionsProps {
  bankAccounts: AccountType[];
  ccAccounts: AccountType[];
  loanAccounts: AccountType[];
  accounts: AccountType[] | undefined;
  bankOpen: boolean;
  setBankOpen: (v: boolean) => void;
  ccOpen: boolean;
  setCcOpen: (v: boolean) => void;
  loanOpen: boolean;
  setLoanOpen: (v: boolean) => void;
  openEdit: (id: number) => void;
  setReconcileId: (id: number) => void;
  setReconcileBalance: (v: string) => void;
  setDeleteAccountId: (id: number) => void;
}

export function AccountCardSections({
  bankAccounts, ccAccounts, loanAccounts, accounts,
  bankOpen, setBankOpen, ccOpen, setCcOpen, loanOpen, setLoanOpen,
  openEdit, setReconcileId, setReconcileBalance, setDeleteAccountId,
}: AccountCardSectionsProps) {
  return (
    <div className="space-y-4">
      {bankAccounts.length > 0 && (
        <div className="glass-1 overflow-hidden">
          <button
            onClick={() => setBankOpen(!bankOpen)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--glass-hover)] transition-colors border-b border-[var(--divider-color)]"
          >
            <div className="flex items-center gap-2.5">
              <Wallet className="w-5 h-5 text-emerald-500" />
              <span className="font-semibold text-sm">Bank Accounts</span>
              <span className="text-xs text-muted-foreground/60 font-mono">{bankAccounts.length}</span>
            </div>
            <div className="flex items-center gap-3">
              <SensitiveValue className="text-sm font-bold font-mono text-emerald-500">
                {formatCurrency(bankAccounts.reduce((s, a) => s + Number(a.currentBalance), 0))}
              </SensitiveValue>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${bankOpen ? "rotate-180" : ""}`} />
            </div>
          </button>
          {bankOpen && (
            <div className="px-4 pb-4 pt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <TooltipProvider delayDuration={300}>
              {bankAccounts.map((account) => (
                <Card key={account.id} className="glass-2 hover:bg-[var(--glass-hover)] hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-300">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm truncate">{account.name}</p>
                          {account.useInSurplus && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium status-badge-success">Surplus</span>
                          )}
                        </div>
                        <SensitiveValue as="div" className="text-xl font-bold font-mono mt-1 text-emerald-500">{formatCurrency(account.currentBalance)}</SensitiveValue>
                      </div>
                      <div className="flex items-center gap-1 md:gap-4 ml-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-primary" onClick={() => { setReconcileId(account.id); setReconcileBalance(String(account.currentBalance)); }}>
                              <RefreshCw className="w-4 h-4 md:w-3.5 md:h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Sync Balance</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-primary" onClick={() => openEdit(account.id)}>
                              <Pencil className="w-4 h-4 md:w-3.5 md:h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit Account</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteAccountId(account.id)}>
                              <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete Account</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              </TooltipProvider>
            </div>
          )}
        </div>
      )}

      {ccAccounts.length > 0 && (
        <div className="glass-1 overflow-hidden">
          <button
            onClick={() => setCcOpen(!ccOpen)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--glass-hover)] transition-colors border-b border-[var(--divider-color)]"
          >
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-5 h-5 text-destructive" />
              <span className="font-semibold text-sm">Credit Cards</span>
              <span className="text-xs text-muted-foreground/60 font-mono">{ccAccounts.length}</span>
            </div>
            <div className="flex items-center gap-3">
              <SensitiveValue className="text-sm font-bold font-mono text-red-500">
                {formatCurrency(Math.abs(ccAccounts.reduce((s, a) => s + Number(a.currentBalance), 0)))}
              </SensitiveValue>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${ccOpen ? "rotate-180" : ""}`} />
            </div>
          </button>
          {ccOpen && (
            <div className="px-4 pb-4 pt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <TooltipProvider delayDuration={300}>
              {ccAccounts.map((account) => {
                const outstanding = Math.abs(Number(account.currentBalance));
                const limit = account.creditLimit ? Number(account.creditLimit) : null;
                let availableLimit: number | null = null;
                if (account.sharedLimitGroup && limit != null) {
                  const groupTotal = ccAccounts
                    .filter((a) => a.sharedLimitGroup === account.sharedLimitGroup)
                    .reduce((s, a) => s + Math.abs(Number(a.currentBalance)), 0);
                  availableLimit = Math.max(0, limit - groupTotal);
                } else if (limit != null) {
                  availableLimit = Math.max(0, limit - outstanding);
                }
                const usedPct = limit && limit > 0 ? (outstanding / limit) * 100 : 0;
                const strokeColor = usedPct <= 30 ? "hsl(var(--chart-1))" : usedPct <= 50 ? "hsl(var(--chart-4))" : "hsl(var(--chart-3))";
                const radius = 22;
                const circumference = 2 * Math.PI * radius;
                const strokeDash = (Math.min(usedPct, 100) / 100) * circumference;

                return (
                  <Card key={account.id} className="glass-2 hover:bg-[var(--glass-hover)] hover:shadow-md hover:shadow-red-500/5 transition-all duration-300">
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{account.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {account.sharedLimitGroup && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium status-badge-info">{account.sharedLimitGroup}</span>
                            )}
                            {account.billingDueDay && (
                              <span className="text-[10px] text-muted-foreground/60 font-mono">Due {getOrdinalSuffix(account.billingDueDay)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 md:gap-4 ml-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-primary" onClick={() => { setReconcileId(account.id); setReconcileBalance(String(account.currentBalance)); }}>
                                <RefreshCw className="w-4 h-4 md:w-3.5 md:h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Sync Balance</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-primary" onClick={() => openEdit(account.id)}>
                                <Pencil className="w-4 h-4 md:w-3.5 md:h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit Account</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteAccountId(account.id)}>
                                <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Account</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {limit != null && (
                          <div className="relative flex-shrink-0" style={{ width: 56, height: 56 }}>
                            <svg width="56" height="56" viewBox="0 0 56 56">
                              <circle cx="28" cy="28" r={radius} fill="none" stroke="currentColor" strokeWidth="5" className="text-secondary" />
                              <circle cx="28" cy="28" r={radius} fill="none" stroke={strokeColor} strokeWidth="5" strokeDasharray={`${strokeDash} ${circumference}`} strokeLinecap="round" transform="rotate(-90 28 28)" className="transition-all duration-500" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-[10px] font-bold font-mono" style={{ color: strokeColor }}>{Math.round(usedPct)}%</span>
                            </div>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 font-medium">Outstanding</p>
                          <SensitiveValue as="div" className="text-lg font-bold font-mono">{formatCurrency(Math.abs(Number(account.currentBalance)))}</SensitiveValue>
                          {limit != null && (
                            <div className="mt-1.5 space-y-0.5">
                              <div className="flex justify-between text-[11px] font-mono">
                                <span className="text-muted-foreground/60">Available</span>
                                <SensitiveValue className={usedPct <= 30 ? "text-emerald-500" : usedPct <= 50 ? "text-yellow-500" : "text-destructive"}>{formatCurrency(availableLimit ?? 0)}</SensitiveValue>
                              </div>
                              <div className="flex justify-between text-[11px] font-mono">
                                <span className="text-muted-foreground/60">Limit</span>
                                <SensitiveValue className="text-muted-foreground">{formatCurrency(limit)}</SensitiveValue>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              </TooltipProvider>
            </div>
          )}
        </div>
      )}

      {loanAccounts.length > 0 && (
        <div className="glass-1 overflow-hidden">
          <button
            onClick={() => setLoanOpen(!loanOpen)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--glass-hover)] transition-colors border-b border-[var(--divider-color)]"
          >
            <div className="flex items-center gap-2.5">
              <Landmark className="w-5 h-5 text-amber-500" />
              <span className="font-semibold text-sm">Loans</span>
              <span className="text-xs text-muted-foreground/60 font-mono">{loanAccounts.length}</span>
            </div>
            <div className="flex items-center gap-3">
              <SensitiveValue className="text-sm font-bold font-mono text-red-500">
                {formatCurrency(Math.abs(loanAccounts.reduce((s, a) => s + Number(a.currentBalance), 0)))}
              </SensitiveValue>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${loanOpen ? "rotate-180" : ""}`} />
            </div>
          </button>
          {loanOpen && (
            <div className="px-4 pb-4 pt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <TooltipProvider delayDuration={300}>
              {loanAccounts.map((account) => {
                const outstanding = Number(account.currentBalance);
                const emi = account.emiAmount ? Number(account.emiAmount) : null;
                const tenure = account.loanTenure ? Number(account.loanTenure) : null;
                const rate = account.interestRate ? Number(account.interestRate) : null;
                const originalAmount = account.originalLoanAmount ? Number(account.originalLoanAmount) : null;
                const emisPaidCount = Number(account.emisPaid ?? 0);

                const principalPaid = originalAmount ? originalAmount - outstanding : 0;
                const paidPct = originalAmount && originalAmount > 0
                  ? Math.max(0, Math.min(100, (principalPaid / originalAmount) * 100))
                  : 0;

                const totalPayable = emi && tenure ? emi * tenure : null;
                const totalInterest = totalPayable && originalAmount ? totalPayable - originalAmount : null;

                const interestPaidSoFar = emi && originalAmount
                  ? Math.max(0, (emi * emisPaidCount) - principalPaid)
                  : 0;

                const emisRemaining = tenure ? tenure - emisPaidCount : null;

                let estimatedPayoff: string | null = null;
                if (account.loanStartDate && tenure) {
                  const startDate = new Date(account.loanStartDate);
                  startDate.setMonth(startDate.getMonth() + tenure);
                  estimatedPayoff = startDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                } else if (emisRemaining && emisRemaining > 0) {
                  const payoffDate = new Date();
                  payoffDate.setMonth(payoffDate.getMonth() + emisRemaining);
                  estimatedPayoff = payoffDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                }

                return (
                  <Card key={account.id} className="glass-2 hover:bg-[var(--glass-hover)] hover:shadow-md hover:shadow-amber-500/5 transition-all duration-300">
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{account.name}</p>
                          {account.emiDay && (
                            <span className="text-[10px] text-muted-foreground/60 font-mono">EMI on {getOrdinalSuffix(account.emiDay)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 md:gap-4 ml-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-primary" onClick={() => { setReconcileId(account.id); setReconcileBalance(String(account.currentBalance)); }}>
                                <RefreshCw className="w-4 h-4 md:w-3.5 md:h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Sync Balance</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-primary" onClick={() => openEdit(account.id)}>
                                <Pencil className="w-4 h-4 md:w-3.5 md:h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit Account</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-11 w-11 md:h-7 md:w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteAccountId(account.id)}>
                                <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Account</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      {originalAmount && (
                        <p className="text-[10px] text-muted-foreground/60 font-mono mb-0.5">Loan: {formatCurrency(originalAmount)}</p>
                      )}
                      <p className="text-lg font-bold font-mono text-red-500">{formatCurrency(Math.abs(outstanding))}</p>
                      <div className="mt-2 space-y-1">
                        {emi && (
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-muted-foreground/60">EMI</span>
                            <SensitiveValue className="text-muted-foreground">{formatCurrency(emi)}/mo</SensitiveValue>
                          </div>
                        )}
                        {rate != null && rate > 0 && (
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-muted-foreground/60">Rate</span>
                            <span className="text-muted-foreground">{rate}% p.a.</span>
                          </div>
                        )}
                        {originalAmount && principalPaid > 0 && (
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-muted-foreground/60">Principal Paid</span>
                            <span className="text-emerald-500">{formatCurrency(principalPaid)}</span>
                          </div>
                        )}
                        {interestPaidSoFar > 0 && (
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-muted-foreground/60">Interest Paid</span>
                            <span className="text-orange-400">{formatCurrency(interestPaidSoFar)}</span>
                          </div>
                        )}
                        {tenure && (
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-muted-foreground/60">EMIs</span>
                            <span className="text-muted-foreground">{emisPaidCount}/{tenure} paid{emisRemaining != null && emisRemaining > 0 ? `, ${emisRemaining} left` : ""}</span>
                          </div>
                        )}
                        {account.linkedAccountId && (
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-muted-foreground/60">From</span>
                            <span className="text-muted-foreground truncate ml-2">{accounts?.find((a) => a.id === account.linkedAccountId)?.name ?? "—"}</span>
                          </div>
                        )}
                        {estimatedPayoff && (
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-muted-foreground/60">Payoff</span>
                            <span className="text-muted-foreground">{estimatedPayoff}</span>
                          </div>
                        )}
                      </div>
                      {originalAmount && originalAmount > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] font-mono mb-1.5">
                            <span className="text-muted-foreground/50">{Math.round(paidPct)}% principal repaid</span>
                            <span className="font-semibold" style={{ color: paidPct > 60 ? "hsl(var(--chart-1))" : "hsl(var(--chart-4))" }}>{Math.round(paidPct)}%</span>
                          </div>
                          <div className="w-full h-3 bg-secondary rounded-full overflow-hidden flex">
                            {principalPaid > 0 && (
                              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${paidPct}%` }} />
                            )}
                          </div>
                          <div className="flex gap-3 mt-1.5 text-[9px] font-mono text-muted-foreground/60">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />
                              Principal Paid {formatCurrency(principalPaid)}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-sm bg-secondary inline-block" />
                              Outstanding {formatCurrency(outstanding)}
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              </TooltipProvider>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
