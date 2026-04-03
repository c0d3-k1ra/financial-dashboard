import { getCategoryIcon } from "@/lib/category-icons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CategoryBadgeProps {
  category: string;
  type?: "Income" | "Expense";
  className?: string;
  onClick?: () => void;
  compact?: boolean;
}

interface LightBadgeColor {
  bg: string;
  border: string;
  text: string;
}

const LIGHT_CATEGORY_COLORS: Record<string, LightBadgeColor> = {
  food: { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)", text: "#c2410c" },
  drinks: { bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.3)", text: "#7e22ce" },
  transportation: { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)", text: "#1d4ed8" },
  shopping: { bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.3)", text: "#be185d" },
  subscriptions: { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.3)", text: "#4338ca" },
  medical: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", text: "#b91c1c" },
  insurance: { bg: "rgba(14,165,233,0.12)", border: "rgba(14,165,233,0.3)", text: "#0369a1" },
  emi: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", text: "#b45309" },
  "emi (pl)": { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", text: "#b45309" },
  sip: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#047857" },
  "sip (investment)": { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#047857" },
  home: { bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.3)", text: "#6d28d9" },
  travel: { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)", text: "#1d4ed8" },
  entertainment: { bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.3)", text: "#be185d" },
  utilities: { bg: "rgba(14,165,233,0.12)", border: "rgba(14,165,233,0.3)", text: "#0369a1" },
  personal: { bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.3)", text: "#7e22ce" },
  grooming: { bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.3)", text: "#7e22ce" },
  fitness: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#047857" },
  education: { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.3)", text: "#4338ca" },
  gifts: { bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.3)", text: "#be185d" },
  salary: { bg: "rgba(22,163,74,0.1)", border: "rgba(22,163,74,0.25)", text: "#15803d" },
  freelance: { bg: "rgba(22,163,74,0.1)", border: "rgba(22,163,74,0.25)", text: "#15803d" },
};

const LIGHT_INCOME_DEFAULT: LightBadgeColor = { bg: "rgba(22,163,74,0.1)", border: "rgba(22,163,74,0.25)", text: "#15803d" };
const LIGHT_EXPENSE_DEFAULT: LightBadgeColor = { bg: "rgba(15,23,42,0.06)", border: "rgba(15,23,42,0.12)", text: "rgba(15,23,42,0.7)" };

function getLightColor(category: string, isIncome: boolean): LightBadgeColor {
  const key = category.toLowerCase();
  if (LIGHT_CATEGORY_COLORS[key]) return LIGHT_CATEGORY_COLORS[key];
  return isIncome ? LIGHT_INCOME_DEFAULT : LIGHT_EXPENSE_DEFAULT;
}

export function CategoryBadge({ category, type, className = "", onClick, compact = false }: CategoryBadgeProps) {
  const Icon = getCategoryIcon(category);
  const isIncome = type === "Income";
  const lightColor = getLightColor(category, isIncome);

  if (compact) {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onClick}
              aria-label={category}
              className={`inline-flex items-center justify-center w-7 h-7 rounded-md backdrop-blur-sm ${
                isIncome
                  ? "bg-emerald-500/15 dark:text-emerald-400 text-emerald-700"
                  : "bg-rose-500/15 dark:text-rose-300 text-rose-700"
              } ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""} ${className}`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{category}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <span
      onClick={onClick}
      style={{
        ["--light-badge-bg" as string]: lightColor.bg,
        ["--light-badge-border" as string]: lightColor.border,
        ["--light-badge-text" as string]: lightColor.text,
      }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border backdrop-blur-sm
        dark:bg-emerald-500/15 dark:border-emerald-500/25
        ${isIncome
          ? "dark:text-emerald-400"
          : "dark:text-rose-300 dark:bg-rose-500/15 dark:border-rose-500/25"
        }
        category-badge-light
        ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {category}
    </span>
  );
}
