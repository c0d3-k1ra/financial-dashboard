import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatMessageList } from "./ChatMessageList";
import type { ChatMessage } from "../types";
import { TestWrapper } from "@/test/test-wrapper";

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const baseProps = {
  isProcessing: false,
  isMobile: false,
  accounts: [{ id: 1, name: "HDFC", type: "bank" }],
  categories: [{ name: "Food", type: "Expense" }],
  onSendMessage: vi.fn(),
  onOptionClick: vi.fn(),
  onLogIt: vi.fn(),
  onEdit: vi.fn(),
  onEditField: vi.fn(),
  onCancelEdit: vi.fn(),
  onUndo: vi.fn(),
};

function renderList(messages: ChatMessage[]) {
  return render(
    <TestWrapper>
      <ChatMessageList messages={messages} {...baseProps} />
    </TestWrapper>,
  );
}

describe("ChatMessageList", () => {
  it("renders empty state when no messages", () => {
    renderList([]);
    expect(screen.getByText(/Good (morning|afternoon|evening)/)).toBeInTheDocument();
  });

  it("renders user message", () => {
    renderList([
      { id: "u1", type: "user", content: "Spent 450 on food", timestamp: Date.now() },
    ]);
    expect(screen.getByText("Spent 450 on food")).toBeInTheDocument();
  });

  it("renders assistant message", () => {
    renderList([
      { id: "a1", type: "assistant", content: "I found a transaction", timestamp: Date.now() },
    ]);
    expect(screen.getByText("I found a transaction")).toBeInTheDocument();
  });

  it("renders assistant options", () => {
    renderList([
      {
        id: "a1",
        type: "assistant",
        content: "Choose one",
        timestamp: Date.now(),
        options: [
          { label: "Option A", value: "a" },
          { label: "Option B", value: "b" },
        ],
      },
    ]);
    expect(screen.getByText("Option A")).toBeInTheDocument();
    expect(screen.getByText("Option B")).toBeInTheDocument();
  });

  it("renders typing indicator when processing", () => {
    const { container } = render(
      <TestWrapper>
        <ChatMessageList messages={[]} {...baseProps} isProcessing={true} />
      </TestWrapper>,
    );
    expect(container.querySelector(".ai-typing-dot")).toBeInTheDocument();
  });

  it("renders query_result message", () => {
    renderList([
      {
        id: "qr1",
        type: "query_result",
        content: "Here are your results",
        timestamp: Date.now(),
        queryData: {
          queryType: "spend",
          title: "Spending",
          items: [{ label: "Food", value: "₹5000" }],
          summary: "Summary text",
        },
      },
    ]);
    expect(screen.getByText("Here are your results")).toBeInTheDocument();
    expect(screen.getByText("Spending")).toBeInTheDocument();
  });

  it("renders done message", () => {
    renderList([
      {
        id: "d1",
        type: "done",
        content: "Transaction logged!",
        timestamp: Date.now(),
        transaction: {
          transactionType: "Expense",
          amount: "450",
          date: "2026-04-05",
          description: "test",
          category: "Food",
          accountId: 1,
          fromAccountId: null,
          toAccountId: null,
        },
      },
    ]);
    expect(screen.getByText("Transaction Logged")).toBeInTheDocument();
  });

  it("shows timestamp for first message", () => {
    renderList([
      { id: "u1", type: "user", content: "Hello", timestamp: Date.now() - 1000 },
    ]);
    expect(screen.getByText("Just now")).toBeInTheDocument();
  });

  it("calls onOptionClick when option button is clicked", async () => {
    const onOptionClick = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <TestWrapper>
        <ChatMessageList
          messages={[
            {
              id: "a1",
              type: "assistant",
              content: "Pick one",
              timestamp: Date.now(),
              options: [{ label: "Option X", value: "x" }],
            },
          ]}
          {...baseProps}
          onOptionClick={onOptionClick}
        />
      </TestWrapper>,
    );
    await user.click(screen.getByText("Option X"));
    expect(onOptionClick).toHaveBeenCalledWith({ label: "Option X", value: "x" });
  });

  it("renders confirmation message with transaction card", () => {
    renderList([
      {
        id: "c1",
        type: "confirmation",
        content: "Confirm this?",
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
      },
    ]);
    expect(screen.getByText("Confirm this?")).toBeInTheDocument();
    expect(screen.getByText("Log It")).toBeInTheDocument();
  });

  it("renders done message with Log another button", () => {
    renderList([
      {
        id: "d1",
        type: "done",
        content: "Logged!",
        timestamp: Date.now(),
        transaction: {
          transactionType: "Expense",
          amount: "450",
          date: "2026-04-05",
          description: "test",
          category: "Food",
          accountId: 1,
          fromAccountId: null,
          toAccountId: null,
        },
      },
    ]);
    expect(screen.getByText("Log another")).toBeInTheDocument();
  });

  it("calls onSendMessage when Log another is clicked", async () => {
    const onSendMessage = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <TestWrapper>
        <ChatMessageList
          messages={[
            {
              id: "d1",
              type: "done",
              content: "Logged!",
              timestamp: Date.now(),
              transaction: {
                transactionType: "Expense",
                amount: "450",
                date: "2026-04-05",
                description: "test",
                category: "Food",
                accountId: 1,
                fromAccountId: null,
                toAccountId: null,
              },
            },
          ]}
          {...baseProps}
          onSendMessage={onSendMessage}
        />
      </TestWrapper>,
    );
    await user.click(screen.getByText("Log another"));
    expect(onSendMessage).toHaveBeenCalledWith("I want to log another transaction");
  });

  it("skips timestamp when messages are close together", () => {
    const now = Date.now();
    renderList([
      { id: "u1", type: "user", content: "First", timestamp: now },
      { id: "u2", type: "user", content: "Second", timestamp: now + 1000 },
    ]);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    const timestamps = screen.queryAllByText("Just now");
    expect(timestamps.length).toBe(1);
  });

  it("shows timestamp when messages are far apart", () => {
    const now = Date.now();
    renderList([
      { id: "u1", type: "user", content: "First msg", timestamp: now - 300000 },
      { id: "u2", type: "user", content: "Second msg", timestamp: now },
    ]);
    expect(screen.getByText("First msg")).toBeInTheDocument();
    expect(screen.getByText("Second msg")).toBeInTheDocument();
  });
});
