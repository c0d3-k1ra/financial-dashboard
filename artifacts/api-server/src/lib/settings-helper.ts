import { eq } from "drizzle-orm";
import { db, appSettingsTable } from "@workspace/db";

export async function getAppSettings(): Promise<{ billingCycleDay: number; currencyCode: string }> {
  const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, 1));
  if (rows.length === 0) {
    return { billingCycleDay: 25, currencyCode: "INR" };
  }
  return {
    billingCycleDay: rows[0].billingCycleDay,
    currencyCode: rows[0].currencyCode,
  };
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  KRW: "₩",
  RUB: "₽",
  TRY: "₺",
  THB: "฿",
  BRL: "R$",
  ZAR: "R",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
  HKD: "HK$",
  NZD: "NZ$",
  CHF: "CHF",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  MXN: "MX$",
  AED: "د.إ",
  SAR: "﷼",
  PHP: "₱",
  MYR: "RM",
  IDR: "Rp",
  VND: "₫",
  BDT: "৳",
  PKR: "₨",
  LKR: "₨",
  NPR: "₨",
};

export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode;
}

export function formatCurrency(amount: number | string, currencyCode: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${getCurrencySymbol(currencyCode)}0.00`;
  const formatted = num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${getCurrencySymbol(currencyCode)}${formatted}`;
}
