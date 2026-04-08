import { Undo2, Plus } from "lucide-react";
import type { ChatMessage } from "../types";
import { getAccountTypeIcon } from "../constants";

interface Account {
  id: number;
  name: string;
  type: string;
}

interface DoneCardProps {
  msg: ChatMessage;
  accounts: Account[];
  onUndo: (msgId: string) => void;
  onLogAnother: () => void;
}

function getAccountName(id: number | null, accounts: Account[]) {
  if (!id || !accounts) return "Unknown";
  return accounts.find((a) => a.id === id)?.name ?? "Unknown";
}

export function DoneCard({ msg, accounts, onUndo, onLogAnother }: DoneCardProps) {
  const hasUndo = msg.undoExpiry && Date.now() < msg.undoExpiry && msg.loggedTransactionId;
  const originalTx = msg.transaction;

  if (msg.content === "Transaction undone.") {
    return (
      <div className="glass-2 rounded-xl p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
          <Undo2 className="w-4 h-4 text-muted-foreground" />
        </div>
        <span className="text-sm text-muted-foreground">{msg.content}</span>
      </div>
    );
  }

  return (
    <div className="glass-2 rounded-xl overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="ai-checkmark-container w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="ai-checkmark-circle" />
              <path d="M8 12.5l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ai-checkmark-path" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Transaction Logged</p>
            {originalTx && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {originalTx.transactionType === "Income" ? "+" : originalTx.transactionType === "Transfer" ? "" : "−"}₹{isNaN(Number(originalTx.amount)) ? originalTx.amount : Number(originalTx.amount).toLocaleString("en-IN")}
                {originalTx.category ? ` • ${originalTx.category}` : ""}
                {originalTx.accountId ? ` • ${getAccountName(originalTx.accountId, accounts)}` : ""}
              </p>
            )}
          </div>
        </div>

        {hasUndo && (
          <div className="space-y-2">
            <div className="h-0.5 rounded-full bg-muted/30 overflow-hidden">
              <div
                className="h-full bg-amber-500/60 rounded-full"
                style={{
                  animation: `ai-undo-shrink ${Math.max(0, ((msg.undoExpiry || 0) - Date.now()) / 1000)}s linear forwards`,
                }}
              />
            </div>
            <button
              onClick={() => onUndo(msg.id)}
              className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500 transition-colors"
            >
              <Undo2 className="w-3 h-3" />
              Undo
            </button>
          </div>
        )}
      </div>

      <button
        onClick={onLogAnother}
        className="w-full px-4 py-2.5 border-t border-[var(--divider-color)] text-xs text-muted-foreground hover:text-foreground hover:bg-[rgba(var(--glass-overlay-rgb),0.04)] transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="w-3 h-3" />
        Log another
      </button>
    </div>
  );
}
