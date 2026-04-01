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

const CURRENCY_LOCALE_MAP: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
};

let activeCurrencyCode = "INR";

export function setActiveCurrency(code: string) {
  activeCurrencyCode = code;
}

export function getActiveCurrency(): string {
  return activeCurrencyCode;
}

export const formatCurrency = (amount: number | string) => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const locale = CURRENCY_LOCALE_MAP[activeCurrencyCode] || "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: activeCurrencyCode,
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

  if (err instanceof Error && err.message) {
    const cleaned = err.message.replace(/^HTTP \d{3} [^:]+:\s*/, "");
    if (cleaned.trim()) return cleaned.trim();
  }

  if (typeof err === "string" && err.trim()) return err.trim();

  return "Something went wrong. Please try again.";
}
