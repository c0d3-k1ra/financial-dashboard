import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatMessages } from "./useChatMessages";

describe("useChatMessages", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initializes with empty messages", () => {
    const { result } = renderHook(() => useChatMessages());
    expect(result.current.messages).toEqual([]);
  });

  it("addUserMessage adds a user message", () => {
    const { result } = renderHook(() => useChatMessages());
    act(() => {
      result.current.addUserMessage("Hello");
    });
    expect(result.current.messages.length).toBe(1);
    expect(result.current.messages[0].type).toBe("user");
    expect(result.current.messages[0].content).toBe("Hello");
  });

  it("addAssistantMessage adds an assistant message", () => {
    const { result } = renderHook(() => useChatMessages());
    act(() => {
      result.current.addAssistantMessage("I understand");
    });
    expect(result.current.messages.length).toBe(1);
    expect(result.current.messages[0].type).toBe("assistant");
  });

  it("addAssistantMessage with options", () => {
    const { result } = renderHook(() => useChatMessages());
    act(() => {
      result.current.addAssistantMessage("Choose:", [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ]);
    });
    expect(result.current.messages[0].options?.length).toBe(2);
  });

  it("addAssistantMessage deduplicates options", () => {
    const { result } = renderHook(() => useChatMessages());
    act(() => {
      result.current.addAssistantMessage("Choose:", [
        { label: "A", value: "a" },
        { label: "A", value: "a2" },
        { label: "B", value: "b" },
      ]);
    });
    expect(result.current.messages[0].options?.length).toBe(2);
  });

  it("addConfirmationMessage adds a confirmation message", () => {
    const { result } = renderHook(() => useChatMessages());
    const tx = {
      transactionType: "Expense" as const,
      amount: "450",
      date: "2026-04-05",
      description: "Starbucks",
      category: "Food",
      accountId: 1,
      fromAccountId: null,
      toAccountId: null,
    };
    act(() => {
      result.current.addConfirmationMessage("Please confirm", tx);
    });
    expect(result.current.messages[0].type).toBe("confirmation");
    expect(result.current.messages[0].transaction).toBeDefined();
  });

  it("addConfirmationMessage with warnings", () => {
    const { result } = renderHook(() => useChatMessages());
    const tx = {
      transactionType: "Expense" as const,
      amount: "450",
      date: "2026-04-05",
      description: "test",
      category: "Food",
      accountId: 1,
      fromAccountId: null,
      toAccountId: null,
    };
    act(() => {
      result.current.addConfirmationMessage("Confirm", tx, [
        { type: "duplicate", existingAmount: "450", existingDescription: "test", existingDate: "2026-04-04" },
      ]);
    });
    expect(result.current.messages[0].warnings?.length).toBe(1);
  });

  it("addQueryResultMessage adds a query result", () => {
    const { result } = renderHook(() => useChatMessages());
    act(() => {
      result.current.addQueryResultMessage("Results:", {
        queryType: "spend",
        title: "Spending",
        items: [{ label: "Food", value: "₹5000" }],
      });
    });
    expect(result.current.messages[0].type).toBe("query_result");
    expect(result.current.messages[0].queryData?.title).toBe("Spending");
  });

  it("addCancelledMessage adds assistant message and clears storage", () => {
    const { result } = renderHook(() => useChatMessages());
    act(() => {
      result.current.addUserMessage("test");
    });
    act(() => {
      result.current.addCancelledMessage("Cancelled");
    });
    expect(result.current.messages.length).toBe(2);
    expect(result.current.messages[1].type).toBe("assistant");
  });

  it("clearMessages removes all messages", () => {
    const { result } = renderHook(() => useChatMessages());
    act(() => {
      result.current.addUserMessage("test1");
      result.current.addUserMessage("test2");
    });
    act(() => {
      result.current.clearMessages();
    });
    expect(result.current.messages.length).toBe(0);
  });

  it("getConversationHistory returns formatted history", () => {
    const { result } = renderHook(() => useChatMessages());
    act(() => {
      result.current.addUserMessage("Hello");
      result.current.addAssistantMessage("Hi there");
    });
    const history = result.current.getConversationHistory();
    expect(history.length).toBe(2);
    expect(history[0].role).toBe("user");
    expect(history[1].role).toBe("assistant");
  });

  it("getConversationHistory excludes messages before last done", () => {
    const { result } = renderHook(() => useChatMessages());
    act(() => {
      result.current.addUserMessage("old message");
    });
    act(() => {
      result.current.setMessages(prev => [
        ...prev,
        { id: "done1", type: "done", content: "Logged", timestamp: Date.now() },
      ]);
    });
    act(() => {
      result.current.addUserMessage("new message");
    });
    const history = result.current.getConversationHistory();
    expect(history.length).toBe(1);
    expect(history[0].content).toBe("new message");
  });

  it("getConversationHistory includes confirmation content with tx data", () => {
    const { result } = renderHook(() => useChatMessages());
    act(() => {
      result.current.addConfirmationMessage("Confirm?", {
        transactionType: "Expense",
        amount: "100",
        date: "2026-04-05",
        description: "test",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      });
    });
    const history = result.current.getConversationHistory();
    expect(history[0].content).toContain("[Transaction data:");
  });
});
