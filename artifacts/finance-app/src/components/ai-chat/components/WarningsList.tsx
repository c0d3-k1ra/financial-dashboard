import { AlertTriangle, TrendingUp, Copy } from "lucide-react";
import type { AiChatWarning } from "@workspace/api-client-react";

interface WarningsListProps {
  warnings: AiChatWarning[];
}

export function WarningsList({ warnings }: WarningsListProps) {
  return (
    <div className="space-y-2 mt-2">
      {warnings.map((warning, i) => {
        let borderColor = "border-l-amber-500";
        let icon = <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />;

        if (warning.type === "anomaly") {
          borderColor = "border-l-orange-500";
          icon = <TrendingUp className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />;
          return (
            <div key={i} className={`glass-2 rounded-lg p-3 border-l-[3px] ${borderColor}`}>
              <div className="flex items-start gap-2.5">
                {icon}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-300">
                    Unusual Amount
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {warning.anomalyType === "merchant"
                      ? `${warning.ratio}x your typical spend here (avg ₹${warning.averageAmount?.toLocaleString()})`
                      : `${warning.ratio}x the average for this category (avg ₹${warning.averageAmount?.toLocaleString()})`}
                  </p>
                  {warning.typicalAmount && (
                    <p className="text-xs text-muted-foreground/70">
                      You usually spend around ₹{warning.typicalAmount.toLocaleString()} here
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        }

        if (warning.type === "budget") {
          borderColor = "border-l-red-500";
          const pct = warning.budgetAmount
            ? Math.round((warning.afterTransaction! / warning.budgetAmount) * 100)
            : 0;
          return (
            <div key={i} className={`glass-2 rounded-lg p-3 border-l-[3px] ${borderColor}`}>
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-red-700 dark:text-red-300">
                    {warning.isOverBudget ? "Budget Exceeded" : "Budget Warning"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {warning.isOverBudget
                      ? `${warning.categoryName} budget already exceeded`
                      : `This will push ${warning.categoryName} to ${pct}% of budget`}
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    ₹{warning.spentSoFar?.toLocaleString()} + ₹{(warning.afterTransaction! - warning.spentSoFar!).toLocaleString()} = ₹{warning.afterTransaction?.toLocaleString()} / ₹{warning.budgetAmount?.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          );
        }

        if (warning.type === "duplicate") {
          borderColor = "border-l-yellow-500";
          return (
            <div key={i} className={`glass-2 rounded-lg p-3 border-l-[3px] ${borderColor}`}>
              <div className="flex items-start gap-2.5">
                <Copy className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                    Possible Duplicate
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ₹{Number(warning.existingAmount).toLocaleString()} — &ldquo;{warning.existingDescription}&rdquo; on {warning.existingDate}
                  </p>
                </div>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
