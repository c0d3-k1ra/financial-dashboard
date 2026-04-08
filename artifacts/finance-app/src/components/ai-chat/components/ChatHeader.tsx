import { Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  isMobile: boolean;
  isProcessing: boolean;
  hasMessages: boolean;
  clearConfirmPending: boolean;
  onClearConversation: () => void;
  onClose: () => void;
}

export function ChatHeader({
  isMobile, isProcessing, hasMessages, clearConfirmPending,
  onClearConversation, onClose,
}: ChatHeaderProps) {
  return (
    <div className={`flex items-center justify-between ${isMobile ? "px-4 pb-2" : "p-3"} border-b border-[var(--divider-color)] ${isProcessing && isMobile ? "ai-header-shimmer" : ""}`}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-medium">AI Assistant</span>
      </div>
      <div className="flex items-center gap-1">
        {hasMessages && (
          <Button
            variant="ghost"
            size="icon"
            className={`${isMobile ? "h-11 w-11" : "h-7 w-7"} ${clearConfirmPending ? "text-red-500" : ""}`}
            onClick={onClearConversation}
            aria-label="Clear conversation"
          >
            {clearConfirmPending ? (
              <span className="text-xs font-medium">Clear?</span>
            ) : (
              <Trash2 className={`${isMobile ? "w-4 h-4" : "w-3.5 h-3.5"}`} />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={isMobile ? "h-11 w-11" : "h-7 w-7"}
          onClick={onClose}
        >
          <X className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
        </Button>
      </div>
    </div>
  );
}
