import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DoneCard } from "./DoneCard";
import type { ChatMessage } from "../types";

const mockAccounts = [
  { id: 1, name: "HDFC Savings", type: "bank" },
  { id: 2, name: "SBI Savings", type: "bank" },
];

function makeDoneMsg(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "done1",
    type: "done",
    content: "Transaction logged!",
    timestamp: Date.now(),
    transaction: {
      transactionType: "Expense",
      amount: "450",
      date: "2026-04-05",
      description: "Starbucks",
      category: "Food",
      accountId: 1,
      fromAccountId: null,
      toAccountId: null,
    },
    loggedTransactionId: 100,
    undoExpiry: Date.now() + 10000,
    ...overrides,
  };
}

describe("DoneCard", () => {
  it("renders Transaction Logged text", () => {
    render(<DoneCard msg={makeDoneMsg()} accounts={mockAccounts} onUndo={vi.fn()} onLogAnother={vi.fn()} />);
    expect(screen.getByText("Transaction Logged")).toBeInTheDocument();
  });

  it("shows transaction details", () => {
    render(<DoneCard msg={makeDoneMsg()} accounts={mockAccounts} onUndo={vi.fn()} onLogAnother={vi.fn()} />);
    expect(screen.getByText(/Food/)).toBeInTheDocument();
    expect(screen.getByText(/HDFC Savings/)).toBeInTheDocument();
  });

  it("shows undo button when undo is available", () => {
    render(<DoneCard msg={makeDoneMsg()} accounts={mockAccounts} onUndo={vi.fn()} onLogAnother={vi.fn()} />);
    expect(screen.getByText("Undo")).toBeInTheDocument();
  });

  it("hides undo when expired", () => {
    const msg = makeDoneMsg({ undoExpiry: Date.now() - 1000 });
    render(<DoneCard msg={msg} accounts={mockAccounts} onUndo={vi.fn()} onLogAnother={vi.fn()} />);
    expect(screen.queryByText("Undo")).not.toBeInTheDocument();
  });

  it("calls onUndo when undo is clicked", async () => {
    const onUndo = vi.fn();
    const user = userEvent.setup();
    render(<DoneCard msg={makeDoneMsg()} accounts={mockAccounts} onUndo={onUndo} onLogAnother={vi.fn()} />);
    await user.click(screen.getByText("Undo"));
    expect(onUndo).toHaveBeenCalledWith("done1");
  });

  it("shows Log another button", () => {
    render(<DoneCard msg={makeDoneMsg()} accounts={mockAccounts} onUndo={vi.fn()} onLogAnother={vi.fn()} />);
    expect(screen.getByText("Log another")).toBeInTheDocument();
  });

  it("calls onLogAnother when clicked", async () => {
    const onLogAnother = vi.fn();
    const user = userEvent.setup();
    render(<DoneCard msg={makeDoneMsg()} accounts={mockAccounts} onUndo={vi.fn()} onLogAnother={onLogAnother} />);
    await user.click(screen.getByText("Log another"));
    expect(onLogAnother).toHaveBeenCalled();
  });

  it("renders undo card when content is 'Transaction undone.'", () => {
    const msg = makeDoneMsg({ content: "Transaction undone." });
    render(<DoneCard msg={msg} accounts={mockAccounts} onUndo={vi.fn()} onLogAnother={vi.fn()} />);
    expect(screen.getByText("Transaction undone.")).toBeInTheDocument();
  });

  it("shows Income transaction with + prefix", () => {
    const msg = makeDoneMsg({
      transaction: {
        transactionType: "Income",
        amount: "5000",
        date: "2026-04-05",
        description: "Salary",
        category: "Salary",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<DoneCard msg={msg} accounts={mockAccounts} onUndo={vi.fn()} onLogAnother={vi.fn()} />);
    expect(screen.getByText(/\+₹5,000/)).toBeInTheDocument();
  });

  it("shows Transfer transaction without prefix", () => {
    const msg = makeDoneMsg({
      transaction: {
        transactionType: "Transfer",
        amount: "2000",
        date: "2026-04-05",
        description: "Transfer",
        category: null,
        accountId: null,
        fromAccountId: 1,
        toAccountId: 2,
      },
    });
    render(<DoneCard msg={msg} accounts={mockAccounts} onUndo={vi.fn()} onLogAnother={vi.fn()} />);
    expect(screen.getByText(/₹2,000/)).toBeInTheDocument();
  });

  it("shows Unknown when account is not found", () => {
    const msg = makeDoneMsg({
      transaction: {
        transactionType: "Expense",
        amount: "100",
        date: "2026-04-05",
        description: "Test",
        category: "Food",
        accountId: 999,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<DoneCard msg={msg} accounts={mockAccounts} onUndo={vi.fn()} onLogAnother={vi.fn()} />);
    expect(screen.getByText(/Unknown/)).toBeInTheDocument();
  });

  it("shows transaction without category or account", () => {
    const msg = makeDoneMsg({
      transaction: {
        transactionType: "Expense",
        amount: "100",
        date: "2026-04-05",
        description: "Test",
        category: null,
        accountId: null,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<DoneCard msg={msg} accounts={mockAccounts} onUndo={vi.fn()} onLogAnother={vi.fn()} />);
    expect(screen.getByText("Transaction Logged")).toBeInTheDocument();
  });

  it("shows transaction without transaction data", () => {
    const msg = makeDoneMsg({ transaction: undefined });
    render(<DoneCard msg={msg} accounts={mockAccounts} onUndo={vi.fn()} onLogAnother={vi.fn()} />);
    expect(screen.getByText("Transaction Logged")).toBeInTheDocument();
  });

  it("hides undo when loggedTransactionId is null", () => {
    const msg = makeDoneMsg({ loggedTransactionId: undefined });
    render(<DoneCard msg={msg} accounts={mockAccounts} onUndo={vi.fn()} onLogAnother={vi.fn()} />);
    expect(screen.queryByText("Undo")).not.toBeInTheDocument();
  });
});
