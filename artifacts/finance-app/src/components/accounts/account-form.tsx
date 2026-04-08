import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DatePicker } from "@/components/ui/date-picker";
import { formatCurrency } from "@/lib/constants";
import { calculateEmi, calculateEmisPaid, calculateOutstandingPrincipal } from "./loan-calculations";

export const accountFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["bank", "credit_card", "loan"]),
  currentBalance: z.string().optional(),
  creditLimit: z.string().optional(),
  billingDueDay: z.string().optional(),
  emiAmount: z.string().optional(),
  emiDay: z.string().optional(),
  loanTenure: z.string().optional(),
  interestRate: z.string().optional(),
  linkedAccountId: z.string().optional(),
  useInSurplus: z.boolean().optional(),
  sharedLimitGroup: z.string().optional(),
  originalLoanAmount: z.string().optional(),
  loanStartDate: z.string().optional(),
  emisPaid: z.string().optional(),
}).refine((data) => {
  if (data.type === "loan") {
    return !!data.originalLoanAmount && Number(data.originalLoanAmount) > 0;
  }
  return true;
}, { message: "Original loan amount is required for loan accounts", path: ["originalLoanAmount"] });

export type AccountFormValues = z.infer<typeof accountFormSchema>;

interface AccountCreateFormProps {
  onSubmit: (data: AccountFormValues) => void;
  isPending: boolean;
  bankAccounts: Array<{ id: number; name: string }>;
  existingGroups: string[];
  form: ReturnType<typeof useForm<AccountFormValues>>;
}

export function useAccountForm() {
  return useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: { name: "", type: "bank", currentBalance: "0", creditLimit: "", billingDueDay: "", emiAmount: "", emiDay: "", loanTenure: "", interestRate: "", linkedAccountId: "", useInSurplus: false, sharedLimitGroup: "", originalLoanAmount: "", loanStartDate: "", emisPaid: "0" },
  });
}

export function useAutoCalcLoan(form: ReturnType<typeof useForm<AccountFormValues>>) {
  const watchType = form.watch("type");
  const watchOriginalAmount = form.watch("originalLoanAmount");
  const watchInterestRate = form.watch("interestRate");
  const watchTenure = form.watch("loanTenure");
  const watchLoanStartDate = form.watch("loanStartDate");
  const watchEmiDay = form.watch("emiDay");

  useEffect(() => {
    if (watchType !== "loan") return;
    const principal = Number(watchOriginalAmount) || 0;
    const rate = Number(watchInterestRate) || 0;
    const tenure = Number(watchTenure) || 0;
    const startDate = watchLoanStartDate || "";
    const emiDay = Number(watchEmiDay) || 0;

    if (principal > 0 && tenure > 0) {
      const emi = calculateEmi(principal, rate, tenure);
      form.setValue("emiAmount", String(emi));

      if (startDate && emiDay > 0) {
        const paid = calculateEmisPaid(startDate, emiDay);
        form.setValue("emisPaid", String(paid));
        const outstanding = calculateOutstandingPrincipal(principal, rate, tenure, paid);
        form.setValue("currentBalance", String(outstanding));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- form is stable from useForm; including it causes infinite re-renders
  }, [watchType, watchOriginalAmount, watchInterestRate, watchTenure, watchLoanStartDate, watchEmiDay]);

  return { watchType, watchOriginalAmount, watchTenure };
}

export function AccountCreateFormFields({ onSubmit, isPending, bankAccounts, existingGroups, form }: AccountCreateFormProps) {
  const { watchType, watchOriginalAmount, watchTenure } = useAutoCalcLoan(form);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Account Name</FormLabel><FormControl><Input placeholder="e.g. HDFC Savings" {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent><SelectItem value="bank">Bank Account</SelectItem><SelectItem value="credit_card">Credit Card</SelectItem><SelectItem value="loan">Loan</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
        {watchType !== "loan" && <FormField control={form.control} name="currentBalance" render={({ field }) => (<FormItem><FormLabel>Current Balance</FormLabel><FormControl><div className="relative"><span className="absolute left-3 top-2.5 text-muted-foreground">{"\u20B9"}</span><Input type="number" step="0.01" className="pl-7 font-mono" placeholder="0.00" {...field} /></div></FormControl><FormMessage /></FormItem>)} />}
        {watchType === "bank" && (
          <FormField control={form.control} name="useInSurplus" render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl><input type="checkbox" checked={field.value ?? false} onChange={field.onChange} className="h-4 w-4 rounded border-border accent-primary" /></FormControl>
              <FormLabel className="text-sm font-normal cursor-pointer">Use in surplus calculation</FormLabel>
            </FormItem>
          )} />
        )}
        {watchType === "credit_card" && (
          <>
            <FormField control={form.control} name="creditLimit" render={({ field }) => (<FormItem><FormLabel>Credit Limit</FormLabel><FormControl><div className="relative"><span className="absolute left-3 top-2.5 text-muted-foreground">{"\u20B9"}</span><Input type="number" step="0.01" className="pl-7 font-mono" placeholder="0.00" {...field} /></div></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="billingDueDay" render={({ field }) => (<FormItem><FormLabel>Billing Due Day (1-31)</FormLabel><FormControl><Input type="number" min="1" max="31" step="1" className="font-mono" placeholder="e.g. 15" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="sharedLimitGroup" render={({ field }) => (<FormItem><FormLabel>Shared Limit Group</FormLabel><FormControl><div><Input className="font-mono" placeholder="Type group name or leave empty" list="shared-limit-groups" {...field} /><datalist id="shared-limit-groups">{existingGroups.map((g) => (<option key={g} value={g} />))}</datalist></div></FormControl><FormMessage /></FormItem>)} />
          </>
        )}
        {watchType === "loan" && (
          <>
            <FormField control={form.control} name="originalLoanAmount" render={({ field }) => (<FormItem><FormLabel>Original Loan Amount</FormLabel><FormControl><div className="relative"><span className="absolute left-3 top-2.5 text-muted-foreground">{"\u20B9"}</span><Input type="number" step="0.01" className="pl-7 font-mono" placeholder="e.g. 2000000" {...field} /></div></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="interestRate" render={({ field }) => (<FormItem><FormLabel>Interest Rate (% p.a.)</FormLabel><FormControl><Input type="number" step="0.01" className="font-mono" placeholder="e.g. 10.5" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="loanTenure" render={({ field }) => (<FormItem><FormLabel>Tenure (months)</FormLabel><FormControl><Input type="number" min="1" step="1" className="font-mono" placeholder="e.g. 36" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="loanStartDate" render={({ field }) => (<FormItem><FormLabel>Loan Start Date</FormLabel><FormControl><DatePicker date={field.value ? new Date(field.value + "T00:00:00") : undefined} onSelect={(date) => { if (date) { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, "0"); const d = String(date.getDate()).padStart(2, "0"); field.onChange(`${y}-${m}-${d}`); } else { field.onChange(""); } }} placeholder="Select start date" className="w-full font-mono" /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="emiDay" render={({ field }) => (<FormItem><FormLabel>EMI Debit Day (1-31)</FormLabel><FormControl><Input type="number" min="1" max="31" step="1" className="font-mono" placeholder="e.g. 5" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="linkedAccountId" render={({ field }) => (<FormItem><FormLabel>EMI Debit Account</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger></FormControl><SelectContent>{bankAccounts.map((a) => (<SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
            {Number(watchOriginalAmount) > 0 && Number(watchTenure) > 0 && (
              <div className="rounded-lg border border-[var(--divider-color)] bg-[var(--glass-bg)] p-4 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Auto-Calculated</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-muted-foreground/60">Monthly EMI</p>
                    <p className="text-sm font-bold font-mono text-primary">{formatCurrency(Number(form.getValues("emiAmount")) || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground/60">EMIs Paid</p>
                    <p className="text-sm font-bold font-mono">{form.getValues("emisPaid") || "0"} / {watchTenure}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[11px] text-muted-foreground/60">Outstanding Principal</p>
                    <p className="text-sm font-bold font-mono text-amber-500">{formatCurrency(Number(form.getValues("currentBalance")) || 0)}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <DialogFooter className="pt-4">
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Creating..." : "Create Account"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
