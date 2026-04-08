import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryErrorStateProps {
  onRetry: () => void;
  message?: string;
  className?: string;
}

export function QueryErrorState({ onRetry, message = "Failed to load data", className = "" }: QueryErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-8 px-4 ${className}`}>
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="w-5 h-5" />
        <span className="text-sm font-medium">{message}</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="gap-1.5 text-xs"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Retry
      </Button>
    </div>
  );
}
