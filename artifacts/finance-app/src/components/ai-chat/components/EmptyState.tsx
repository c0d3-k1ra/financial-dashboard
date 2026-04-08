import { Sparkles } from "lucide-react";
import { QUICK_ACTIONS } from "../constants";
import { getGreeting } from "../utils";

interface EmptyStateProps {
  isMobile: boolean;
  isProcessing: boolean;
  onSendMessage: (text: string) => void;
}

export function EmptyState({ isMobile, isProcessing, onSendMessage }: EmptyStateProps) {
  const greeting = getGreeting();
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold">{greeting}</h3>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          I can help you log transactions, check balances, and manage your finances.
        </p>
      </div>

      <div className={`w-full max-w-sm ${isMobile ? "space-y-2" : "grid grid-cols-2 gap-2"}`}>
        {QUICK_ACTIONS.map((action) => {
          const ActionIcon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() => onSendMessage(action.message)}
              disabled={isProcessing}
              className={`flex items-center gap-2.5 text-left transition-all disabled:opacity-50 ${
                isMobile
                  ? "w-full glass-2 rounded-xl px-4 py-3.5 hover:bg-[rgba(var(--glass-overlay-rgb),0.06)] active:scale-[0.98]"
                  : "glass-2 rounded-xl px-3 py-2.5 hover:bg-[rgba(var(--glass-overlay-rgb),0.06)] active:scale-[0.98]"
              } chat-pill-light pill-button-dark`}
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <ActionIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
