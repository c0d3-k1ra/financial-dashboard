import { Loader2, Send, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputBarProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  nlInput: string;
  setNlInput: (value: string) => void;
  isProcessing: boolean;
  isListening: boolean;
  speechSupported: boolean;
  isMobile: boolean;
  isTouchDevice: boolean;
  hasCompletedMessages: boolean;
  onSend: (text: string) => void;
  onStartListening: () => void;
  onStopListening: () => void;
}

export function ChatInputBar({
  inputRef, nlInput, setNlInput, isProcessing, isListening,
  speechSupported, isMobile, isTouchDevice, hasCompletedMessages,
  onSend, onStartListening, onStopListening,
}: ChatInputBarProps) {
  return (
    <>
      {isListening && (
        <div className="px-3 pb-1">
          <div className="ai-recording-bar h-1 rounded-full bg-red-500/30 overflow-hidden">
            <div className="h-full bg-red-500 rounded-full ai-recording-pulse-bar" />
          </div>
        </div>
      )}

      <div className="p-3 border-t border-[var(--divider-color)]" style={isMobile ? { paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 8px)" } : undefined}>
        <div className="flex gap-2 items-end">
          <Input
            ref={inputRef}
            placeholder={hasCompletedMessages
              ? "Log another or ask a question..."
              : 'e.g. "Spent 450 at Starbucks"'
            }
            className={`flex-1 bg-background/50 border-amber-500/30 focus-visible:ring-amber-500/30 ${isMobile ? "h-12 text-base" : "h-9 text-sm"}`}
            style={isMobile ? { fontSize: "16px" } : undefined}
            value={nlInput}
            onChange={(e) => setNlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSend(nlInput);
              }
            }}
            onFocus={() => {
              if (isTouchDevice) {
                setTimeout(() => inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 300);
              }
            }}
            disabled={isProcessing}
          />
          {speechSupported && (
            <Button
              type="button"
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              onClick={() => isListening ? onStopListening() : onStartListening()}
              disabled={isProcessing}
              className={`shrink-0 ${isMobile ? "h-12 w-12" : "h-9 w-9"} ${isListening ? "animate-pulse" : ""}`}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
            >
              <Mic className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
            </Button>
          )}
          <Button
            onClick={() => onSend(nlInput)}
            disabled={isProcessing || !nlInput.trim()}
            className={`shrink-0 bg-amber-600 hover:bg-amber-700 text-white ${isMobile ? "h-12 w-12" : "h-9 w-9"}`}
            size="icon"
          >
            {isProcessing ? (
              <Loader2 className={`${isMobile ? "w-5 h-5" : "w-4 h-4"} animate-spin`} />
            ) : (
              <Send className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
