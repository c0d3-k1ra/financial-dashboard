import { getCategoryIcon } from "@/lib/category-icons";

interface CategoryBadgeProps {
  category: string;
  type?: "Income" | "Expense";
  className?: string;
  onClick?: () => void;
}

export function CategoryBadge({ category, type, className = "", onClick }: CategoryBadgeProps) {
  const Icon = getCategoryIcon(category);
  const isIncome = type === "Income";

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border ${
        isIncome
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-rose-500/10 text-rose-300 border-rose-500/20"
      } ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {category}
    </span>
  );
}
