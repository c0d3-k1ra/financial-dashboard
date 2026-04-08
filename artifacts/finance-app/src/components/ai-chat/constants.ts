import {
  Receipt, Wallet, ArrowLeftRight, Search, Landmark, TrendingUp,
  ArrowDownLeft, ArrowUpRight, CreditCard,
  type LucideIcon,
} from "lucide-react";

export const CHAT_STORAGE_KEY = "ai-chat-state";
export const CHAT_IDLE_TIMEOUT = 30 * 60 * 1000;
export const CHAT_MIN_HEIGHT = 200;

export const QUICK_ACTIONS: { label: string; icon: LucideIcon; message: string }[] = [
  { label: "Log an expense", icon: Receipt, message: "I want to log an expense" },
  { label: "Record salary", icon: Wallet, message: "Record my salary" },
  { label: "Transfer money", icon: ArrowLeftRight, message: "Transfer money between accounts" },
  { label: "What did I spend today?", icon: Search, message: "What did I spend today?" },
  { label: "Check my balances", icon: Landmark, message: "Show my balance" },
  { label: "Monthly summary", icon: TrendingUp, message: "Monthly summary" },
];

export const TYPE_CONFIG: Record<string, { icon: LucideIcon; colorClass: string; bgClass: string }> = {
  Expense: { icon: ArrowDownLeft, colorClass: "text-red-500 dark:text-red-400", bgClass: "bg-red-500/10 border-red-500/20" },
  Income: { icon: ArrowUpRight, colorClass: "text-emerald-500 dark:text-emerald-400", bgClass: "bg-emerald-500/10 border-emerald-500/20" },
  Transfer: { icon: ArrowLeftRight, colorClass: "text-blue-500 dark:text-blue-400", bgClass: "bg-blue-500/10 border-blue-500/20" },
};

export function getAccountTypeIcon(type: string): LucideIcon {
  const t = type.toLowerCase();
  if (t.includes("credit")) return CreditCard;
  if (t.includes("bank") || t.includes("savings")) return Landmark;
  if (t.includes("cash") || t.includes("wallet")) return Wallet;
  return Landmark;
}
