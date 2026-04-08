import { useRef, useEffect } from "react";
import type { ChatMessage, ChatOption, TransactionData } from "../types";
import { getRelativeTime } from "../utils";
import { ConfirmationCard } from "./ConfirmationCard";
import { QueryResultCard } from "./QueryResultCard";
import { DoneCard } from "./DoneCard";
import { EmptyState } from "./EmptyState";
import { TypingIndicator } from "./TypingIndicator";

interface Account {
  id: number;
  name: string;
  type: string;
}

interface Category {
  name: string;
  type: string;
}

interface ChatMessageListProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  isMobile: boolean;
  accounts: Account[];
  categories: Category[];
  onSendMessage: (text: string) => void;
  onOptionClick: (option: ChatOption) => void;
  onLogIt: (msgId: string) => void;
  onEdit: (msgId: string) => void;
  onEditField: (msgId: string, field: keyof TransactionData, value: string | number | null) => void;
  onCancelEdit: (msgId: string) => void;
  onUndo: (msgId: string) => void;
}

export function ChatMessageList({
  messages, isProcessing, isMobile, accounts, categories,
  onSendMessage, onOptionClick, onLogIt, onEdit, onEditField, onCancelEdit, onUndo,
}: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
      {messages.length === 0 && (
        <EmptyState
          isMobile={isMobile}
          isProcessing={isProcessing}
          onSendMessage={onSendMessage}
        />
      )}

      {messages.map((msg, idx) => {
        const showTimestamp = msg.timestamp && (
          idx === 0 ||
          !messages[idx - 1]?.timestamp ||
          msg.timestamp - (messages[idx - 1]?.timestamp || 0) > 120000
        );

        return (
          <div key={msg.id}>
            {showTimestamp && msg.timestamp && (
              <div className="flex justify-center my-2">
                <span className="text-[10px] text-muted-foreground/50 font-medium">{getRelativeTime(msg.timestamp)}</span>
              </div>
            )}

            {msg.type === "user" && (
              <div className="flex justify-end ai-message-enter">
                <div className="dark:bg-amber-600/20 dark:border-amber-600/30 bg-blue-500 border border-transparent dark:text-inherit text-white rounded-lg rounded-br-sm px-3 py-2 max-w-[85%] shadow-sm dark:border-0 bubble-user-dark">
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            )}

            {msg.type === "query_result" && (
              <div className="flex justify-start ai-message-enter">
                <div className="max-w-[95%] w-full space-y-2">
                  <div className="glass-1 rounded-lg rounded-bl-sm px-3 py-2 bubble-ai-dark">
                    <p className="text-sm">{msg.content}</p>
                  </div>
                  {msg.queryData && <QueryResultCard msg={msg} />}
                </div>
              </div>
            )}

            {msg.type === "done" && (
              <div className="flex justify-start ai-message-enter">
                <div className="max-w-[95%] w-full">
                  <DoneCard
                    msg={msg}
                    accounts={accounts}
                    onUndo={onUndo}
                    onLogAnother={() => onSendMessage("I want to log another transaction")}
                  />
                </div>
              </div>
            )}

            {msg.type === "confirmation" && (
              <div className="flex justify-start ai-message-enter">
                <div className="max-w-[95%] w-full space-y-2">
                  <div className="glass-1 rounded-lg rounded-bl-sm px-3 py-2 bubble-ai-dark">
                    <p className="text-sm">{msg.content}</p>
                  </div>
                  {msg.transaction && (
                    <ConfirmationCard
                      msg={msg}
                      accounts={accounts}
                      categories={categories}
                      isProcessing={isProcessing}
                      isMobile={isMobile}
                      onLogIt={onLogIt}
                      onEdit={onEdit}
                      onEditField={onEditField}
                      onCancelEdit={onCancelEdit}
                    />
                  )}
                </div>
              </div>
            )}

            {msg.type === "assistant" && (
              <div className="flex justify-start ai-message-enter">
                <div className="max-w-[85%] space-y-2">
                  <div className="glass-1 rounded-lg rounded-bl-sm px-3 py-2 bubble-ai-dark">
                    <p className="text-sm">{msg.content}</p>
                  </div>
                  {msg.options && msg.options.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {msg.options.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => onOptionClick(opt)}
                          disabled={isProcessing}
                          className="chat-pill-light px-3 py-1.5 text-xs rounded-full border dark:border-amber-500/30 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-300 transition-colors disabled:opacity-50 backdrop-blur-sm font-medium pill-button-dark"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {isProcessing && <TypingIndicator />}

      <div ref={messagesEndRef} />
    </div>
  );
}
