import { useState, useEffect, useCallback } from "react";
import type { ChatMessage, ChatOption, QueryData, TransactionData } from "../types";
import type { AiChatWarning } from "@workspace/api-client-react";
import { loadPersistedChat, persistChat, clearPersistedChat, genId } from "../utils";

export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadPersistedChat());

  useEffect(() => {
    persistChat(messages);
  }, [messages]);

  const addUserMessage = useCallback((content: string): ChatMessage => {
    const msg: ChatMessage = {
      id: genId(),
      type: "user",
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const addAssistantMessage = useCallback((content: string, options?: ChatOption[]) => {
    const dedupedOptions = options
      ? options.filter((opt, i, arr) => arr.findIndex((o) => o.label === opt.label) === i)
      : undefined;
    setMessages((prev) => [
      ...prev,
      {
        id: genId(),
        type: "assistant",
        content,
        timestamp: Date.now(),
        options: dedupedOptions,
      },
    ]);
  }, []);

  const addConfirmationMessage = useCallback((content: string, transaction: TransactionData, warnings?: AiChatWarning[]) => {
    setMessages((prev) => [
      ...prev,
      {
        id: genId(),
        type: "confirmation",
        content,
        timestamp: Date.now(),
        transaction,
        warnings,
      },
    ]);
  }, []);

  const addQueryResultMessage = useCallback((content: string, queryData?: QueryData) => {
    setMessages((prev) => [
      ...prev,
      {
        id: genId(),
        type: "query_result",
        content,
        timestamp: Date.now(),
        queryData,
      },
    ]);
  }, []);

  const addCancelledMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: genId(),
        type: "assistant",
        content,
        timestamp: Date.now(),
      },
    ]);
    clearPersistedChat();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    clearPersistedChat();
  }, []);

  const getConversationHistory = useCallback(() => {
    const lastDoneIdx = messages.reduce((acc, m, i) => (m.type === "done" ? i : acc), -1);
    const relevantMessages = lastDoneIdx >= 0 ? messages.slice(lastDoneIdx + 1) : messages;
    return relevantMessages
      .filter((m) => m.type === "user" || m.type === "assistant" || m.type === "confirmation")
      .map((m) => ({
        role: (m.type === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.type === "confirmation" && m.transaction
          ? m.content + "\n[Transaction data: " + JSON.stringify(m.transaction) + "]"
          : m.content,
      }));
  }, [messages]);

  return {
    messages,
    setMessages,
    addUserMessage,
    addAssistantMessage,
    addConfirmationMessage,
    addQueryResultMessage,
    addCancelledMessage,
    clearMessages,
    getConversationHistory,
  };
}
