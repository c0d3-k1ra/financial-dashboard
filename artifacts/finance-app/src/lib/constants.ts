export const EXPENSE_CATEGORIES = [
  "EMI (PL)",
  "Father",
  "Credit Card (CC)",
  "Living Expenses",
  "SIP (Investment)",
  "Travel Fund",
  "Term Insurance",
  "Health Insurance",
  "Food",
  "Gifts",
  "Home",
  "Transportation",
  "Personal",
  "Utilities",
  "Medical",
  "Other (Tax)"
] as const;

export const INCOME_CATEGORIES = [
  "Paycheck (Salary)",
  "Bonus",
  "Interest",
  "Other"
] as const;

export const formatCurrency = (amount: number | string) => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num || 0);
};

export const formatDate = (dateStr: string) => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(dateStr));
};

export function getApiErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const data = (err as Record<string, unknown>).data;
    if (data && typeof data === "object") {
      const d = data as Record<string, unknown>;
      if (typeof d.error === "string" && d.error.trim()) return d.error.trim();
      if (typeof d.message === "string" && d.message.trim()) return d.message.trim();
    }
  }

  if (err instanceof Error) {
    const match = err.message.match(/^HTTP \d{3} [^:]+:\s*(.+)$/);
    if (match) return match[1];
  }

  return "Something went wrong. Please try again.";
}
