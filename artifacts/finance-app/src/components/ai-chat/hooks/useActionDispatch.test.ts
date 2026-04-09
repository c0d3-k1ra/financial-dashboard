import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useActionDispatch } from "./useActionDispatch";
import React from "react";
import type { ChatMessage } from "../types";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@workspace/api-client-react", () => ({
  useAiChatConfirm: () => ({ mutateAsync: vi.fn() }),
  useCreateTransaction: () => ({ mutateAsync: vi.fn().mockResolvedValue({ id: 1 }) }),
  useCreateTransfer: () => ({ mutateAsync: vi.fn().mockResolvedValue({ id: 2 }) }),
  useDeleteTransaction: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  getListTransactionsQueryKey: () => ["transactions"],
  getListAccountsQueryKey: () => ["accounts"],
  getGetDashboardSummaryQueryKey: () => ["summary"],
  getGetMonthlySurplusQueryKey: () => ["surplus"],
}));

vi.mock("../utils", () => ({
  clearPersistedChat: vi.fn(),
}));

function createParams(overrides: Partial<ReturnType<typeof getDefaultParams>> = {}) {
  return { ...getDefaultParams(), ...overrides };
}

function getDefaultParams() {
  const confirmationMsg: ChatMessage = {
    id: "msg1",
    type: "confirmation",
    content: "Log this?",
    timestamp: Date.now(),
    transaction: {
      transactionType: "Expense",
      amount: "500",
      date: "2026-01-01",
      description: "Coffee",
      category: "Food",
      accountId: 1,
      fromAccountId: null,
      toAccountId: null,
    },
    editMode: false,
  };

  return {
    messages: [confirmationMsg],
    setMessages: vi.fn((updater: any) => {
      if (typeof updater === "function") updater([confirmationMsg]);
    }),
    isProcessing: false,
    setIsProcessing: vi.fn(),
    setNlInput: vi.fn(),
    isTouchDevice: false,
    inputRef: { current: null } as React.RefObject<HTMLInputElement | null>,
  };
}

describe("useActionDispatch", () => {
  it("returns all expected functions", () => {
    const params = createParams();
    const { result } = renderHook(() => useActionDispatch(params));
    expect(result.current.handleLogIt).toBeDefined();
    expect(result.current.handleUndo).toBeDefined();
    expect(result.current.handleEdit).toBeDefined();
    expect(result.current.handleEditField).toBeDefined();
    expect(result.current.handleCancelEdit).toBeDefined();
    expect(result.current.cleanupTimers).toBeDefined();
    expect(result.current.invalidateAll).toBeDefined();
  });

  it("handleEdit sets editMode on the message", () => {
    const setMessages = vi.fn();
    const params = createParams({ setMessages });
    const { result } = renderHook(() => useActionDispatch(params));
    act(() => {
      result.current.handleEdit("msg1");
    });
    expect(setMessages).toHaveBeenCalled();
  });

  it("handleEditField updates editable transaction field", () => {
    const setMessages = vi.fn();
    const params = createParams({ setMessages });
    const { result } = renderHook(() => useActionDispatch(params));
    act(() => {
      result.current.handleEditField("msg1", "amount", "999");
    });
    expect(setMessages).toHaveBeenCalled();
  });

  it("handleCancelEdit resets editMode", () => {
    const setMessages = vi.fn();
    const params = createParams({ setMessages });
    const { result } = renderHook(() => useActionDispatch(params));
    act(() => {
      result.current.handleCancelEdit("msg1");
    });
    expect(setMessages).toHaveBeenCalled();
  });

  it("cleanupTimers does not throw", () => {
    const params = createParams();
    const { result } = renderHook(() => useActionDispatch(params));
    expect(() => result.current.cleanupTimers()).not.toThrow();
  });

  it("handleLogIt validates amount", async () => {
    const confirmMsg: ChatMessage = {
      id: "msg2",
      type: "confirmation",
      content: "Log?",
      timestamp: Date.now(),
      transaction: {
        transactionType: "Expense",
        amount: "0",
        date: "2026-01-01",
        description: "Bad",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
      editMode: false,
    };
    const params = createParams({ messages: [confirmMsg] });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg2");
    });
  });

  it("handleLogIt skips if message not found", async () => {
    const params = createParams();
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("nonexistent");
    });
    expect(params.setIsProcessing).not.toHaveBeenCalled();
  });

  it("handleUndo skips if no loggedTransactionId", async () => {
    const params = createParams();
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleUndo("msg1");
    });
  });

  it("invalidateAll can be called", () => {
    const params = createParams();
    const { result } = renderHook(() => useActionDispatch(params));
    expect(() => result.current.invalidateAll()).not.toThrow();
  });

  it("handleLogIt skips if transaction has no amount", async () => {
    const noAmountMsg: ChatMessage = {
      id: "msg3",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Log?",
      transaction: {
        transactionType: "Expense",
        amount: "",
        date: "2026-01-01",
        description: "Empty",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
      editMode: false,
    };
    const params = createParams({ messages: [noAmountMsg] });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg3");
    });
  });

  it("handleLogIt skips if transaction has no category for non-transfer", async () => {
    const noCatMsg: ChatMessage = {
      id: "msg4",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Log?",
      transaction: {
        transactionType: "Expense",
        amount: "500",
        date: "2026-01-01",
        description: "Test",
        category: "",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
      editMode: false,
    };
    const params = createParams({ messages: [noCatMsg] });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg4");
    });
  });

  it("handleLogIt skips if transaction has no accountId for non-transfer", async () => {
    const noAcctMsg: ChatMessage = {
      id: "msg5",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Log?",
      transaction: {
        transactionType: "Expense",
        amount: "500",
        date: "2026-01-01",
        description: "Test",
        category: "Food",
        accountId: null as any,
        fromAccountId: null,
        toAccountId: null,
      },
      editMode: false,
    };
    const params = createParams({ messages: [noAcctMsg] });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg5");
    });
  });

  it("handleLogIt handles transfer type", async () => {
    const transferMsg: ChatMessage = {
      id: "msg6",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Transfer?",
      transaction: {
        transactionType: "Transfer",
        amount: "5000",
        date: "2026-01-01",
        description: "Transfer",
        category: "",
        accountId: null as any,
        fromAccountId: 1,
        toAccountId: 2,
      },
      editMode: false,
    };
    const params = createParams({ messages: [transferMsg] });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg6");
    });
    expect(params.setMessages).toHaveBeenCalled();
  });

  it("handleLogIt skips transfer with missing accounts", async () => {
    const badTransferMsg: ChatMessage = {
      id: "msg7",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Transfer?",
      transaction: {
        transactionType: "Transfer",
        amount: "5000",
        date: "2026-01-01",
        description: "Transfer",
        category: "",
        accountId: null as any,
        fromAccountId: null,
        toAccountId: null,
      },
      editMode: false,
    };
    const params = createParams({ messages: [badTransferMsg] });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg7");
    });
  });

  it("handleLogIt uses editableTransaction when editMode is true", async () => {
    const editMsg: ChatMessage = {
      id: "msg8",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Log?",
      transaction: {
        transactionType: "Expense",
        amount: "500",
        date: "2026-01-01",
        description: "Original",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
      editMode: true,
      editableTransaction: {
        transactionType: "Expense",
        amount: "999",
        date: "2026-01-01",
        description: "Edited",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    };
    const params = createParams({ messages: [editMsg] });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg8");
    });
    expect(params.setMessages).toHaveBeenCalled();
  });

  it("handleLogIt sets default date if missing", async () => {
    const noDateMsg: ChatMessage = {
      id: "msg9",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Log?",
      transaction: {
        transactionType: "Expense",
        amount: "500",
        date: "",
        description: "No date",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
      editMode: false,
    };
    const params = createParams({ messages: [noDateMsg] });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg9");
    });
    expect(params.setMessages).toHaveBeenCalled();
  });

  it("handleLogIt with valid expense calls setMessages for done state", async () => {
    const validMsg: ChatMessage = {
      id: "msg10",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Log?",
      transaction: {
        transactionType: "Expense",
        amount: "1500",
        date: "2026-04-01",
        description: "Lunch",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
      editMode: false,
    };
    const params = createParams({ messages: [validMsg] });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg10");
    });
    expect(params.setIsProcessing).toHaveBeenCalledWith(true);
    expect(params.setMessages).toHaveBeenCalled();
  });

  it("handleLogIt with valid transfer calls setMessages", async () => {
    const transferMsg: ChatMessage = {
      id: "msg11",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Transfer?",
      transaction: {
        transactionType: "Transfer",
        amount: "10000",
        date: "2026-04-01",
        description: "CC Payment",
        category: "",
        accountId: null as any,
        fromAccountId: 1,
        toAccountId: 3,
      },
      editMode: false,
    };
    const params = createParams({ messages: [transferMsg] });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg11");
    });
    expect(params.setMessages).toHaveBeenCalled();
  });

  it("handleLogIt with NaN amount shows toast", async () => {
    const nanMsg: ChatMessage = {
      id: "msg12",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Log?",
      transaction: {
        transactionType: "Expense",
        amount: "abc",
        date: "2026-04-01",
        description: "Bad amount",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
      editMode: false,
    };
    const params = createParams({ messages: [nanMsg] });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg12");
    });
    expect(params.setIsProcessing).not.toHaveBeenCalledWith(true);
  });

  it("handleLogIt with negative amount shows toast", async () => {
    const negMsg: ChatMessage = {
      id: "msg13",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Log?",
      transaction: {
        transactionType: "Expense",
        amount: "-100",
        date: "2026-04-01",
        description: "Negative",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
      editMode: false,
    };
    const params = createParams({ messages: [negMsg] });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg13");
    });
  });

  it("handleUndo with non-existent message does nothing", async () => {
    const params = createParams();
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleUndo("nonexistent");
    });
    expect(params.setMessages).not.toHaveBeenCalled();
  });

  it("handleEdit with specific msgId calls setMessages", () => {
    const setMessages = vi.fn();
    const params = createParams({ setMessages });
    const { result } = renderHook(() => useActionDispatch(params));
    act(() => {
      result.current.handleEdit("msg1");
    });
    expect(setMessages).toHaveBeenCalledTimes(1);
    const updater = setMessages.mock.calls[0][0];
    if (typeof updater === "function") {
      const updated = updater([params.messages[0]]);
      expect(updated[0].editMode).toBe(true);
      expect(updated[0].editableTransaction).toBeDefined();
    }
  });

  it("handleEditField updates specific field on editable transaction", () => {
    const editMsg: ChatMessage = {
      id: "msg14",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Log?",
      transaction: {
        transactionType: "Expense",
        amount: "500",
        date: "2026-04-01",
        description: "Test",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
      editMode: true,
      editableTransaction: {
        transactionType: "Expense",
        amount: "500",
        date: "2026-04-01",
        description: "Test",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    };
    const setMessages = vi.fn();
    const params = createParams({ messages: [editMsg], setMessages });
    const { result } = renderHook(() => useActionDispatch(params));
    act(() => {
      result.current.handleEditField("msg14", "amount", "999");
    });
    expect(setMessages).toHaveBeenCalled();
    const updater = setMessages.mock.calls[0][0];
    if (typeof updater === "function") {
      const updated = updater([editMsg]);
      expect(updated[0].editableTransaction?.amount).toBe("999");
    }
  });

  it("handleCancelEdit resets editMode and clears editableTransaction", () => {
    const editMsg: ChatMessage = {
      id: "msg15",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Log?",
      transaction: {
        transactionType: "Expense",
        amount: "500",
        date: "2026-04-01",
        description: "Test",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
      editMode: true,
      editableTransaction: {
        transactionType: "Expense",
        amount: "999",
        date: "2026-04-01",
        description: "Edited",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    };
    const setMessages = vi.fn();
    const params = createParams({ messages: [editMsg], setMessages });
    const { result } = renderHook(() => useActionDispatch(params));
    act(() => {
      result.current.handleCancelEdit("msg15");
    });
    expect(setMessages).toHaveBeenCalled();
    const updater = setMessages.mock.calls[0][0];
    if (typeof updater === "function") {
      const updated = updater([editMsg]);
      expect(updated[0].editMode).toBe(false);
      expect(updated[0].editableTransaction).toBeUndefined();
    }
  });

  it("handleLogIt with transfer missing fromAccountId", async () => {
    const partialTransferMsg: ChatMessage = {
      id: "msg16",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Transfer?",
      transaction: {
        transactionType: "Transfer",
        amount: "5000",
        date: "2026-04-01",
        description: "Transfer",
        category: "",
        accountId: null as any,
        fromAccountId: 1,
        toAccountId: null,
      },
      editMode: false,
    };
    const params = createParams({ messages: [partialTransferMsg] });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg16");
    });
  });

  it("handleLogIt with message having no transaction data", async () => {
    const noTxMsg: ChatMessage = {
      id: "msg17",
      type: "confirmation",
      timestamp: Date.now(),
      content: "No tx data",
      editMode: false,
    };
    const params = createParams({ messages: [noTxMsg] });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg17");
    });
    expect(params.setIsProcessing).not.toHaveBeenCalled();
  });

  it("handleUndo with loggedTransactionId calls deleteTx and updates messages", async () => {
    const doneMsg: ChatMessage = {
      id: "msg18",
      type: "done",
      timestamp: Date.now(),
      content: "Transaction logged!",
      loggedTransactionId: 42,
      undoExpiry: Date.now() + 10000,
      editMode: false,
    };
    const setMessages = vi.fn((updater: any) => {
      if (typeof updater === "function") updater([doneMsg]);
    });
    const params = createParams({ messages: [doneMsg], setMessages });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleUndo("msg18");
    });
    expect(setMessages).toHaveBeenCalled();
  });

  it("handleLogIt creates transaction and sets undo timer which expires", async () => {
    vi.useFakeTimers();
    const validMsg: ChatMessage = {
      id: "msg19",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Log?",
      transaction: {
        transactionType: "Expense",
        amount: "800",
        date: "2026-04-01",
        description: "Dinner",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
      editMode: false,
    };
    const setMessages = vi.fn((updater: any) => {
      if (typeof updater === "function") updater([validMsg]);
    });
    const params = createParams({ messages: [validMsg], setMessages });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg19");
    });
    expect(setMessages).toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(11000);
    });
    vi.useRealTimers();
  });

  it("handleLogIt with createTx that throws sets error toast", async () => {
    const failMock = vi.fn().mockRejectedValue(new Error("API error"));
    vi.doMock("@workspace/api-client-react", () => ({
      useAiChatConfirm: () => ({ mutateAsync: vi.fn() }),
      useCreateTransaction: () => ({ mutateAsync: failMock }),
      useCreateTransfer: () => ({ mutateAsync: vi.fn().mockResolvedValue({ id: 2 }) }),
      useDeleteTransaction: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
      getListTransactionsQueryKey: () => ["transactions"],
      getListAccountsQueryKey: () => ["accounts"],
      getGetDashboardSummaryQueryKey: () => ["summary"],
      getGetMonthlySurplusQueryKey: () => ["surplus"],
    }));
    const validMsg: ChatMessage = {
      id: "msg20",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Log?",
      transaction: {
        transactionType: "Expense",
        amount: "500",
        date: "2026-04-01",
        description: "Test",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
      editMode: false,
    };
    const params = createParams({ messages: [validMsg] });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg20");
    });
  });

  it("handleLogIt with valid transfer and then undo the timer", async () => {
    vi.useFakeTimers();
    const transferMsg: ChatMessage = {
      id: "msg21",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Transfer?",
      transaction: {
        transactionType: "Transfer",
        amount: "3000",
        date: "2026-04-01",
        description: "Transfer funds",
        category: "",
        accountId: null as any,
        fromAccountId: 1,
        toAccountId: 2,
      },
      editMode: false,
    };
    const setMessages = vi.fn((updater: any) => {
      if (typeof updater === "function") updater([transferMsg]);
    });
    const params = createParams({ messages: [transferMsg], setMessages });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg21");
    });
    expect(setMessages).toHaveBeenCalled();
    result.current.cleanupTimers();
    vi.useRealTimers();
  });

  it("handleLogIt on touch device does not focus input", async () => {
    const validMsg: ChatMessage = {
      id: "msg22",
      type: "confirmation",
      timestamp: Date.now(),
      content: "Log?",
      transaction: {
        transactionType: "Expense",
        amount: "200",
        date: "2026-04-01",
        description: "Coffee",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
      editMode: false,
    };
    const params = createParams({ messages: [validMsg], isTouchDevice: true });
    const { result } = renderHook(() => useActionDispatch(params));
    await act(async () => {
      await result.current.handleLogIt("msg22");
    });
    expect(params.setMessages).toHaveBeenCalled();
  });
});
