import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmationCard } from "./ConfirmationCard";
import type { ChatMessage, TransactionData } from "../types";

const mockAccounts = [
  { id: 1, name: "HDFC Savings", type: "bank" },
  { id: 2, name: "SBI Savings", type: "bank" },
  { id: 3, name: "ICICI CC", type: "credit_card" },
];

const mockCategories = [
  { name: "Food", type: "Expense" },
  { name: "Transportation", type: "Expense" },
  { name: "Paycheck (Salary)", type: "Income" },
];

const baseProps = {
  accounts: mockAccounts,
  categories: mockCategories,
  isProcessing: false,
  isMobile: false,
  onLogIt: vi.fn(),
  onEdit: vi.fn(),
  onEditField: vi.fn(),
  onCancelEdit: vi.fn(),
};

function makeMsg(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "c1",
    type: "confirm",
    content: "Please confirm",
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
    ...overrides,
  };
}

describe("ConfirmationCard", () => {
  it("renders expense type badge", () => {
    render(<ConfirmationCard msg={makeMsg()} {...baseProps} />);
    expect(screen.getByText("Expense")).toBeInTheDocument();
  });

  it("shows amount", () => {
    render(<ConfirmationCard msg={makeMsg()} {...baseProps} />);
    expect(screen.getByText("₹450")).toBeInTheDocument();
  });

  it("shows category", () => {
    render(<ConfirmationCard msg={makeMsg()} {...baseProps} />);
    expect(screen.getByText("Food")).toBeInTheDocument();
  });

  it("shows description", () => {
    render(<ConfirmationCard msg={makeMsg()} {...baseProps} />);
    expect(screen.getByText("Starbucks")).toBeInTheDocument();
  });

  it("shows account name", () => {
    render(<ConfirmationCard msg={makeMsg()} {...baseProps} />);
    expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
  });

  it("shows date", () => {
    render(<ConfirmationCard msg={makeMsg()} {...baseProps} />);
    expect(screen.getByText("2026-04-05")).toBeInTheDocument();
  });

  it("has Log It button", () => {
    render(<ConfirmationCard msg={makeMsg()} {...baseProps} />);
    expect(screen.getByText("Log It")).toBeInTheDocument();
  });

  it("calls onLogIt when Log It is clicked", async () => {
    const onLogIt = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmationCard msg={makeMsg()} {...baseProps} onLogIt={onLogIt} />);
    await user.click(screen.getByText("Log It"));
    expect(onLogIt).toHaveBeenCalledWith("c1");
  });

  it("has Edit button", () => {
    render(<ConfirmationCard msg={makeMsg()} {...baseProps} />);
    expect(screen.getByLabelText("Edit transaction")).toBeInTheDocument();
  });

  it("calls onEdit when edit button is clicked", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmationCard msg={makeMsg()} {...baseProps} onEdit={onEdit} />);
    await user.click(screen.getByLabelText("Edit transaction"));
    expect(onEdit).toHaveBeenCalledWith("c1");
  });

  it("shows Income type correctly", () => {
    const msg = makeMsg({
      transaction: {
        transactionType: "Income",
        amount: "100000",
        date: "2026-04-01",
        description: "Salary",
        category: "Paycheck (Salary)",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} />);
    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("+")).toBeInTheDocument();
  });

  it("shows Transfer type badge", () => {
    const msg = makeMsg({
      transaction: {
        transactionType: "Transfer",
        amount: "5000",
        date: "2026-04-05",
        description: "CC Payment",
        category: "",
        accountId: 0,
        fromAccountId: 1,
        toAccountId: 3,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} />);
    expect(screen.getByText("Transfer")).toBeInTheDocument();
    expect(screen.getByText("CC Payment")).toBeInTheDocument();
  });

  it("renders edit mode", () => {
    const msg = makeMsg({
      editMode: true,
      editableTransaction: {
        transactionType: "Expense",
        amount: "450",
        date: "2026-04-05",
        description: "Starbucks",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} />);
    expect(screen.getByText("Edit Transaction")).toBeInTheDocument();
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("shows category buttons in edit mode", () => {
    const msg = makeMsg({
      editMode: true,
      editableTransaction: {
        transactionType: "Expense",
        amount: "450",
        date: "2026-04-05",
        description: "Starbucks",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} />);
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("Transportation")).toBeInTheDocument();
  });

  it("shows account buttons in edit mode", () => {
    const msg = makeMsg({
      editMode: true,
      editableTransaction: {
        transactionType: "Expense",
        amount: "450",
        date: "2026-04-05",
        description: "Starbucks",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} />);
    expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    expect(screen.getByText("SBI Savings")).toBeInTheDocument();
  });

  it("calls onCancelEdit when Cancel is clicked in edit mode", async () => {
    const onCancelEdit = vi.fn();
    const user = userEvent.setup();
    const msg = makeMsg({
      editMode: true,
      editableTransaction: {
        transactionType: "Expense",
        amount: "450",
        date: "2026-04-05",
        description: "Starbucks",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} onCancelEdit={onCancelEdit} />);
    await user.click(screen.getByText("Cancel"));
    expect(onCancelEdit).toHaveBeenCalledWith("c1");
  });

  it("disables Log It button when processing", () => {
    render(<ConfirmationCard msg={makeMsg()} {...baseProps} isProcessing={true} />);
    expect(screen.getByText("Log It").closest("button")).toBeDisabled();
  });

  it("shows warnings when present", () => {
    const msg = makeMsg({
      warnings: [
        {
          type: "duplicate",
          existingAmount: "450",
          existingDescription: "Starbucks",
          existingDate: "2026-04-04",
        },
      ],
    });
    render(<ConfirmationCard msg={msg} {...baseProps} />);
    expect(screen.getByText("Possible Duplicate")).toBeInTheDocument();
  });

  it("shows transfer edit mode with from/to selectors", () => {
    const msg = makeMsg({
      editMode: true,
      editableTransaction: {
        transactionType: "Transfer",
        amount: "5000",
        date: "2026-04-05",
        description: "Payment",
        category: "",
        accountId: 0,
        fromAccountId: 1,
        toAccountId: 3,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} />);
    expect(screen.getByText("From Account")).toBeInTheDocument();
    expect(screen.getByText("To Account")).toBeInTheDocument();
  });

  it("calls onLogIt in edit mode when Save Changes is clicked", async () => {
    const onLogIt = vi.fn();
    const user = userEvent.setup();
    const msg = makeMsg({
      editMode: true,
      editableTransaction: {
        transactionType: "Expense",
        amount: "450",
        date: "2026-04-05",
        description: "Starbucks",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} onLogIt={onLogIt} />);
    await user.click(screen.getByText("Save Changes"));
    expect(onLogIt).toHaveBeenCalledWith("c1");
  });

  it("calls onEditField when amount is changed in edit mode", async () => {
    const onEditField = vi.fn();
    const user = userEvent.setup();
    const msg = makeMsg({
      editMode: true,
      editableTransaction: {
        transactionType: "Expense",
        amount: "450",
        date: "2026-04-05",
        description: "Starbucks",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} onEditField={onEditField} />);
    const amountInput = screen.getByDisplayValue("450");
    await user.clear(amountInput);
    await user.type(amountInput, "500");
    expect(onEditField).toHaveBeenCalled();
  });

  it("calls onEditField when type toggle is clicked in edit mode", async () => {
    const onEditField = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const msg = makeMsg({
      editMode: true,
      editableTransaction: {
        transactionType: "Expense",
        amount: "450",
        date: "2026-04-05",
        description: "Starbucks",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} onEditField={onEditField} />);
    await user.click(screen.getByText("Income"));
    expect(onEditField).toHaveBeenCalledWith("c1", "transactionType", "Income");
  });

  it("calls onEditField when category button is clicked in edit mode", async () => {
    const onEditField = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const msg = makeMsg({
      editMode: true,
      editableTransaction: {
        transactionType: "Expense",
        amount: "450",
        date: "2026-04-05",
        description: "Starbucks",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} onEditField={onEditField} />);
    await user.click(screen.getByText("Transportation"));
    expect(onEditField).toHaveBeenCalledWith("c1", "category", "Transportation");
  });

  it("calls onEditField when account button is clicked in edit mode", async () => {
    const onEditField = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const msg = makeMsg({
      editMode: true,
      editableTransaction: {
        transactionType: "Expense",
        amount: "450",
        date: "2026-04-05",
        description: "Starbucks",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} onEditField={onEditField} />);
    await user.click(screen.getByText("SBI Savings"));
    expect(onEditField).toHaveBeenCalledWith("c1", "accountId", 2);
  });

  it("calls onCancelEdit when X button is clicked in edit mode", async () => {
    const onCancelEdit = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const msg = makeMsg({
      editMode: true,
      editableTransaction: {
        transactionType: "Expense",
        amount: "450",
        date: "2026-04-05",
        description: "Starbucks",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} onCancelEdit={onCancelEdit} />);
    const xButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-x") !== null,
    );
    if (xButtons.length > 0) {
      await user.click(xButtons[0]);
      expect(onCancelEdit).toHaveBeenCalledWith("c1");
    }
  });

  it("calls onEditField when description is changed in edit mode", async () => {
    const onEditField = vi.fn();
    const user = userEvent.setup();
    const msg = makeMsg({
      editMode: true,
      editableTransaction: {
        transactionType: "Expense",
        amount: "450",
        date: "2026-04-05",
        description: "Starbucks",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} onEditField={onEditField} />);
    const descInput = screen.getByDisplayValue("Starbucks");
    await user.clear(descInput);
    await user.type(descInput, "Coffee");
    expect(onEditField).toHaveBeenCalledWith("c1", "description", expect.any(String));
  });

  it("shows Unknown for invalid accountId", () => {
    const msg = makeMsg({
      transaction: {
        transactionType: "Expense",
        amount: "450",
        date: "2026-04-05",
        description: "Test",
        category: "Food",
        accountId: 999,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("shows transfer accounts in view mode", () => {
    const msg = makeMsg({
      transaction: {
        transactionType: "Transfer",
        amount: "5000",
        date: "2026-04-05",
        description: "CC Payment",
        category: "",
        accountId: 0,
        fromAccountId: 1,
        toAccountId: 3,
      },
    });
    const { container } = render(<ConfirmationCard msg={msg} {...baseProps} />);
    expect(container.textContent).toContain("HDFC Savings");
    expect(container.textContent).toContain("ICICI CC");
  });

  it("disables Save Changes button when processing in edit mode", () => {
    const msg = makeMsg({
      editMode: true,
      editableTransaction: {
        transactionType: "Expense",
        amount: "450",
        date: "2026-04-05",
        description: "Starbucks",
        category: "Food",
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} isProcessing={true} />);
    expect(screen.getByText("Save Changes").closest("button")).toBeDisabled();
  });

  it("renders minus sign for expense amount", () => {
    render(<ConfirmationCard msg={makeMsg()} {...baseProps} />);
    expect(screen.getByText("−")).toBeInTheDocument();
  });

  it("renders no sign for transfer amount", () => {
    const msg = makeMsg({
      transaction: {
        transactionType: "Transfer",
        amount: "5000",
        date: "2026-04-05",
        description: "Payment",
        category: "",
        accountId: 0,
        fromAccountId: 1,
        toAccountId: 3,
      },
    });
    render(<ConfirmationCard msg={msg} {...baseProps} />);
    expect(screen.queryByText("−")).not.toBeInTheDocument();
    expect(screen.queryByText("+")).not.toBeInTheDocument();
  });

  it("renders transfer edit mode with null fromAccountId and toAccountId", () => {
    const transferTx: TransactionData = {
      transactionType: "Transfer",
      amount: "3000",
      date: "2026-04-05",
      description: "Inter-account",
      category: "",
      accountId: 0,
      fromAccountId: null,
      toAccountId: null,
    };
    const msg = makeMsg({
      editMode: true,
      editableTransaction: { ...transferTx },
      transaction: transferTx,
    });
    render(<ConfirmationCard msg={msg} {...baseProps} />);
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
    expect(screen.getByText("From Account")).toBeInTheDocument();
    expect(screen.getByText("To Account")).toBeInTheDocument();
  });

  it("renders edit mode with no date", () => {
    const tx: TransactionData = {
      transactionType: "Expense",
      amount: "200",
      date: "",
      description: "No date test",
      category: "Food",
      accountId: 1,
      fromAccountId: null,
      toAccountId: null,
    };
    const msg = makeMsg({
      editMode: true,
      editableTransaction: { ...tx },
      transaction: tx,
    });
    render(<ConfirmationCard msg={msg} {...baseProps} />);
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });

  it("renders mobile layout with larger buttons in edit mode", () => {
    const tx: TransactionData = {
      transactionType: "Expense",
      amount: "450",
      date: "2026-04-05",
      description: "Starbucks",
      category: "Food",
      accountId: 1,
      fromAccountId: null,
      toAccountId: null,
    };
    const msg = makeMsg({
      editMode: true,
      editableTransaction: { ...tx },
      transaction: tx,
    });
    render(<ConfirmationCard msg={msg} {...baseProps} isMobile={true} />);
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });

  it("renders income type in edit mode with correct categories", () => {
    const tx: TransactionData = {
      transactionType: "Income",
      amount: "10000",
      date: "2026-04-05",
      description: "Salary",
      category: "Paycheck (Salary)",
      accountId: 1,
      fromAccountId: null,
      toAccountId: null,
    };
    const msg = makeMsg({
      editMode: true,
      editableTransaction: { ...tx },
      transaction: tx,
    });
    render(<ConfirmationCard msg={msg} {...baseProps} />);
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });
});
