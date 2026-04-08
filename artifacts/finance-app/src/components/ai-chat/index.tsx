import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useAiChat,
  useListCategories,
  useListAccounts,
  getListAccountsQueryKey,
} from "@workspace/api-client-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatMessages } from "./hooks/useChatMessages";
import { useVoiceRecognition } from "./hooks/useVoiceRecognition";
import { useActionDispatch } from "./hooks/useActionDispatch";
import { useIsMobileTouch, useVisualViewportHeight } from "./utils";
import { CHAT_MIN_HEIGHT } from "./constants";
import type { ChatOption, TransactionData, QueryData } from "./types";
import type { AiChatWarning } from "@workspace/api-client-react";
import { ChatHeader } from "./components/ChatHeader";
import { ChatMessageList } from "./components/ChatMessageList";
import { ChatInputBar } from "./components/ChatInputBar";

export function AiParseBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [nlInput, setNlInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [clearConfirmPending, setClearConfirmPending] = useState(false);
  const clearConfirmTimer = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTouchDevice = useIsMobileTouch();
  const isMobile = useIsMobile();
  const visualViewportHeight = useVisualViewportHeight();

  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  const aiChat = useAiChat();

  const { data: categories } = useListCategories(
    {},
    { query: { queryKey: ["/api/categories"] } }
  );

  const { data: accounts } = useListAccounts({
    query: { queryKey: getListAccountsQueryKey() },
  });

  const {
    messages, setMessages,
    addUserMessage, addAssistantMessage, addConfirmationMessage,
    addQueryResultMessage, addCancelledMessage, clearMessages,
    getConversationHistory,
  } = useChatMessages();

  const handleTranscript = useCallback((transcript: string) => {
    setNlInput((prev) => (prev ? prev + " " + transcript : transcript));
  }, []);

  const { isListening, speechSupported, startListening, stopListening } =
    useVoiceRecognition(handleTranscript);

  const {
    handleLogIt, handleUndo, handleEdit, handleEditField, handleCancelEdit,
    cleanupTimers,
  } = useActionDispatch({
    messages, setMessages, isProcessing, setIsProcessing,
    setNlInput, isTouchDevice, inputRef,
  });

  useEffect(() => {
    if (!isOpen) {
      stopListening(true);
      setNlInput("");
      setClearConfirmPending(false);
      if (clearConfirmTimer.current) {
        clearTimeout(clearConfirmTimer.current);
        clearConfirmTimer.current = null;
      }
    }
  }, [isOpen, stopListening]);

  useEffect(() => {
    return () => {
      stopListening(true);
      cleanupTimers();
      if (clearConfirmTimer.current) {
        clearTimeout(clearConfirmTimer.current);
        clearConfirmTimer.current = null;
      }
    };
  }, [stopListening, cleanupTimers]);

  useEffect(() => {
    if (isOpen && inputRef.current && !isTouchDevice) {
      inputRef.current.focus();
    }
  }, [isOpen, isTouchDevice]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return;

    stopListening(true);
    const trimmed = text.trim();

    addUserMessage(trimmed);
    setNlInput("");
    setIsProcessing(true);

    const history = getConversationHistory();
    history.push({ role: "user", content: trimmed });

    try {
      const result = await aiChat.mutateAsync({
        data: {
          messages: history,
          categories: (categories ?? []).map((c) => ({ name: c.name, type: c.type })),
          accounts: (accounts ?? []).map((a) => ({ id: a.id, name: a.name, type: a.type })),
        },
      });

      if (result.type === "cancelled") {
        addCancelledMessage(result.reply);
      } else if (result.type === "query_result") {
        addQueryResultMessage(result.reply, result.queryData as QueryData | undefined);
      } else if (result.type === "confirmation" && result.transaction) {
        addConfirmationMessage(
          result.reply,
          result.transaction as TransactionData,
          result.warnings as AiChatWarning[] | undefined,
        );
      } else {
        addAssistantMessage(result.reply, result.options as ChatOption[] | undefined);
      }
    } catch {
      addAssistantMessage("Sorry, I had trouble processing that. Please try again.");
    } finally {
      setIsProcessing(false);
      if (!isTouchDevice) setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isProcessing, isTouchDevice, stopListening, getConversationHistory, aiChat, categories, accounts, addUserMessage, addCancelledMessage, addQueryResultMessage, addConfirmationMessage, addAssistantMessage]);

  const handleOptionClick = (option: ChatOption) => {
    sendMessage(option.value || option.label);
  };

  const handleClearConversation = () => {
    if (clearConfirmPending) {
      clearMessages();
      setClearConfirmPending(false);
      if (clearConfirmTimer.current) {
        clearTimeout(clearConfirmTimer.current);
        clearConfirmTimer.current = null;
      }
    } else {
      setClearConfirmPending(true);
      if (clearConfirmTimer.current) clearTimeout(clearConfirmTimer.current);
      clearConfirmTimer.current = setTimeout(() => {
        setClearConfirmPending(false);
        clearConfirmTimer.current = null;
      }, 3000);
    }
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = 0;
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) {
      dragCurrentY.current = delta;
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${delta}px)`;
        sheetRef.current.style.transition = "none";
      }
    }
  }, [isMobile]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || dragStartY.current === null) return;
    const sheetHeight = sheetRef.current?.offsetHeight || window.innerHeight;
    const threshold = sheetHeight * 0.3;
    if (dragCurrentY.current > threshold) {
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(100%)`;
        sheetRef.current.style.transition = "transform 0.3s ease-out";
      }
      setTimeout(() => setIsOpen(false), 300);
    } else {
      if (sheetRef.current) {
        sheetRef.current.style.transform = "translateY(0)";
        sheetRef.current.style.transition = "transform 0.3s ease-out";
      }
    }
    dragStartY.current = null;
    dragCurrentY.current = 0;
  }, [isMobile]);

  useEffect(() => {
    if (isOpen && sheetRef.current) {
      sheetRef.current.style.transform = "translateY(0)";
      sheetRef.current.style.transition = "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)";
    }
  }, [isOpen]);

  const headerBar = (
    <ChatHeader
      isMobile={isMobile}
      isProcessing={isProcessing}
      hasMessages={messages.length > 0}
      clearConfirmPending={clearConfirmPending}
      onClearConversation={handleClearConversation}
      onClose={() => setIsOpen(false)}
    />
  );

  const chatContent = (
    <>
      <ChatMessageList
        messages={messages}
        isProcessing={isProcessing}
        isMobile={isMobile}
        accounts={accounts ?? []}
        categories={(categories ?? []).map(c => ({ name: c.name, type: c.type }))}
        onSendMessage={sendMessage}
        onOptionClick={handleOptionClick}
        onLogIt={handleLogIt}
        onEdit={handleEdit}
        onEditField={handleEditField}
        onCancelEdit={handleCancelEdit}
        onUndo={handleUndo}
      />
      <ChatInputBar
        inputRef={inputRef}
        nlInput={nlInput}
        setNlInput={setNlInput}
        isProcessing={isProcessing}
        isListening={isListening}
        speechSupported={speechSupported}
        isMobile={isMobile}
        isTouchDevice={isTouchDevice}
        hasCompletedMessages={messages.some((m) => m.type === "done")}
        onSend={sendMessage}
        onStartListening={startListening}
        onStopListening={() => stopListening()}
      />
    </>
  );

  if (isMobile) {
    return (
      <>
        {isOpen && (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <div
              ref={sheetRef}
              className="absolute bottom-0 left-0 right-0 glass-3 chat-panel-light chat-panel-dark rounded-t-2xl shadow-2xl flex flex-col"
              style={{
                height: visualViewportHeight
                  ? `${Math.min(visualViewportHeight * 0.95, visualViewportHeight - 20)}px`
                  : "85dvh",
                transform: "translateY(100%)",
                transition: "height 0.15s ease-out",
              }}
            >
              <div
                className="flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              {headerBar}
              {chatContent}
            </div>
          </div>
        )}

        <div className="fixed z-40 right-4" style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}>
          <Button
            onClick={() => setIsOpen(!isOpen)}
            className="h-14 w-14 rounded-full bg-amber-600 hover:bg-amber-700 text-white shadow-lg hover:shadow-xl transition-all"
            size="icon"
            data-testid="ai-parse-bubble"
          >
            <Sparkles className="w-6 h-6" />
          </Button>
        </div>
      </>
    );
  }

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 md:bottom-8 md:right-8" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {isOpen && (
        <div className="w-[calc(100vw-3rem)] max-w-md chat-panel-enter">
          <div className="glass-3 chat-panel-light chat-panel-dark rounded-xl shadow-2xl flex flex-col" style={{
            height: visualViewportHeight && isTouchDevice
              ? `${Math.max(CHAT_MIN_HEIGHT, Math.min(visualViewportHeight - 100, 500))}px`
              : "50vh",
            maxHeight: "500px",
            transition: "height 0.15s ease-out",
          }}>
            {headerBar}
            {chatContent}
          </div>
        </div>
      )}

      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="h-14 w-14 rounded-full bg-amber-600 hover:bg-amber-700 text-white shadow-lg hover:shadow-xl transition-all"
        size="icon"
        data-testid="ai-parse-bubble"
      >
        <Sparkles className="w-6 h-6" />
      </Button>
    </div>
  );
}
