import { getCategoryIcon } from "@/lib/category-icons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CategoryBadgeProps {
  category: string;
  type?: "Income" | "Expense";
  className?: string;
  onClick?: () => void;
  compact?: boolean;
}

export function CategoryBadge({ category, type, className = "", onClick, compact = false }: CategoryBadgeProps) {
  const Icon = getCategoryIcon(category);
  const isIncome = type === "Income";

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
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-rose-500/15 text-rose-300"
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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border backdrop-blur-sm ${
        isIncome
          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
          : "bg-rose-500/15 text-rose-300 border-rose-500/25"
      } ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {category}
    </span>
  );
}
