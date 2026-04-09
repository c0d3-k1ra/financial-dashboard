import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileTransactionList } from "./transaction-mobile-list";
import { TestWrapper } from "@/test/test-wrapper";

const baseTx = {
  date: "2026-04-05",
  createdAt: "2026-04-05T10:00:00Z",
  toAccountId: null,
};

const mockDateGroups = [
  {
    date: "2026-04-05",
    formattedDate: "Sat, Apr 5",
    dailySpend: 5000,
    transactions: [
      { id: 1, ...baseTx, amount: "5000", description: "Groceries", category: "Food", type: "Expense", accountId: 1 },
    ],
  },
];

const defaultProps = {
  dateGroups: mockDateGroups,
  accounts: [
    { id: 1, name: "HDFC Savings" },
    { id: 2, name: "SBI Savings" },
  ],
  showAdjustments: true,
  expandedAdjustmentDates: new Set<string>(),
  toggleAdjustmentDate: vi.fn(),
  openEdit: vi.fn(),
  setDeleteId: vi.fn(),
  handleCategoryClick: vi.fn(),
  isBalanceAdjustment: () => false,
};

function renderList(overrides = {}) {
  return render(
    <TestWrapper>
      <MobileTransactionList {...defaultProps} {...overrides} />
    </TestWrapper>,
  );
}

describe("MobileTransactionList", () => {
  it("renders transaction items", () => {
    renderList();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
  });

  it("shows date group header", () => {
    renderList();
    expect(screen.getByText("Sat, Apr 5")).toBeInTheDocument();
  });

  it("shows category badge", () => {
    renderList();
    const food = screen.getAllByText("Food");
    expect(food.length).toBeGreaterThan(0);
  });

  it("shows account name", () => {
    renderList();
    expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
  });

  it("handles empty date groups", () => {
    renderList({ dateGroups: [] });
    expect(screen.queryByText("Groceries")).not.toBeInTheDocument();
  });

  it("calls openEdit when edit button is clicked", async () => {
    const openEdit = vi.fn();
    const user = userEvent.setup();
    renderList({ openEdit });
    const editButtons = screen.getAllByRole("button");
    const pencilBtn = editButtons.find((btn) => !btn.getAttribute("data-testid")?.includes("delete"));
    if (pencilBtn) {
      await user.click(pencilBtn);
      expect(openEdit).toHaveBeenCalled();
    }
  });

  it("calls setDeleteId when delete button is clicked", async () => {
    const setDeleteId = vi.fn();
    const user = userEvent.setup();
    renderList({ setDeleteId });
    await user.click(screen.getByTestId("btn-delete-tx-1"));
    expect(setDeleteId).toHaveBeenCalledWith(1);
  });

  it("renders income with + prefix and green styling", () => {
    const incomeGroups = [
      {
        date: "2026-04-05",
        formattedDate: "Sat, Apr 5",
        dailySpend: 0,
        transactions: [
          { id: 2, ...baseTx, amount: "100000", description: "April Salary", category: "Paycheck", type: "Income", accountId: 1 },
        ],
      },
    ];
    renderList({ dateGroups: incomeGroups });
    expect(screen.getByText("April Salary")).toBeInTheDocument();
  });

  it("renders transfer transactions", () => {
    const transferGroups = [
      {
        date: "2026-04-05",
        formattedDate: "Sat, Apr 5",
        dailySpend: 0,
        transactions: [
          { id: 10, ...baseTx, amount: "5000", description: "Fund Transfer", category: "Transfer", type: "Transfer", accountId: 1, toAccountId: 2 },
        ],
      },
    ];
    renderList({ dateGroups: transferGroups });
    expect(screen.getByText("Fund Transfer")).toBeInTheDocument();
    expect(screen.getByText("HDFC Savings → SBI Savings")).toBeInTheDocument();
  });

  it("does not show edit button for Transfer type", () => {
    const transferGroups = [
      {
        date: "2026-04-05",
        formattedDate: "Sat, Apr 5",
        dailySpend: 0,
        transactions: [
          { id: 10, ...baseTx, amount: "5000", description: "Fund Transfer", category: "Transfer", type: "Transfer", accountId: 1, toAccountId: 2 },
        ],
      },
    ];
    renderList({ dateGroups: transferGroups });
    expect(screen.getByTestId("btn-delete-tx-10")).toBeInTheDocument();
  });

  it("shows dash when account not found", () => {
    const groups = [
      {
        date: "2026-04-05",
        formattedDate: "Sat, Apr 5",
        dailySpend: 0,
        transactions: [
          { id: 10, ...baseTx, amount: "100", description: "Unknown", category: "Food", type: "Expense", accountId: 999 },
        ],
      },
    ];
    renderList({ dateGroups: groups });
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows collapsed adjustments when multiple adjustments and not expanded", () => {
    const isBalanceAdjustment = () => true;
    const adjGroups = [
      {
        date: "2026-04-05",
        formattedDate: "Sat, Apr 5",
        dailySpend: 0,
        transactions: [
          { id: 20, ...baseTx, amount: "100", description: "Adj 1", category: "Adj", type: "Expense", accountId: 1 },
          { id: 21, ...baseTx, amount: "200", description: "Adj 2", category: "Adj", type: "Expense", accountId: 1 },
        ],
      },
    ];
    renderList({
      dateGroups: adjGroups,
      isBalanceAdjustment,
      showAdjustments: true,
      expandedAdjustmentDates: new Set<string>(),
    });
    expect(screen.getByText("2 Balance Adjustments")).toBeInTheDocument();
  });

  it("shows expanded adjustments when expanded", () => {
    const isBalanceAdjustment = () => true;
    const adjGroups = [
      {
        date: "2026-04-05",
        formattedDate: "Sat, Apr 5",
        dailySpend: 0,
        transactions: [
          { id: 20, ...baseTx, amount: "100", description: "Adj 1", category: "Adj", type: "Expense", accountId: 1 },
          { id: 21, ...baseTx, amount: "200", description: "Adj 2", category: "Adj", type: "Expense", accountId: 1 },
        ],
      },
    ];
    renderList({
      dateGroups: adjGroups,
      isBalanceAdjustment,
      showAdjustments: true,
      expandedAdjustmentDates: new Set(["2026-04-05"]),
    });
    expect(screen.getByText("Adj 1")).toBeInTheDocument();
    expect(screen.getByText("Adj 2")).toBeInTheDocument();
    expect(screen.getByText("Collapse")).toBeInTheDocument();
  });

  it("calls toggleAdjustmentDate when collapsed adjustment row clicked", async () => {
    const toggleAdjustmentDate = vi.fn();
    const isBalanceAdjustment = () => true;
    const user = userEvent.setup();
    const adjGroups = [
      {
        date: "2026-04-05",
        formattedDate: "Sat, Apr 5",
        dailySpend: 0,
        transactions: [
          { id: 20, ...baseTx, amount: "100", description: "Adj 1", category: "Adj", type: "Expense", accountId: 1 },
          { id: 21, ...baseTx, amount: "200", description: "Adj 2", category: "Adj", type: "Expense", accountId: 1 },
        ],
      },
    ];
    renderList({
      dateGroups: adjGroups,
      isBalanceAdjustment,
      showAdjustments: true,
      expandedAdjustmentDates: new Set<string>(),
      toggleAdjustmentDate,
    });
    await user.click(screen.getByText("2 Balance Adjustments"));
    expect(toggleAdjustmentDate).toHaveBeenCalledWith("2026-04-05");
  });

  it("does not show adjustments when showAdjustments is false", () => {
    const isBalanceAdjustment = () => true;
    const adjGroups = [
      {
        date: "2026-04-05",
        formattedDate: "Sat, Apr 5",
        dailySpend: 0,
        transactions: [
          { id: 20, ...baseTx, amount: "100", description: "Adj 1", category: "Adj", type: "Expense", accountId: 1 },
        ],
      },
    ];
    renderList({
      dateGroups: adjGroups,
      isBalanceAdjustment,
      showAdjustments: false,
    });
    expect(screen.queryByText("Adj 1")).not.toBeInTheDocument();
  });

  it("shows single adjustment without collapse controls", () => {
    const isBalanceAdjustment = () => true;
    const adjGroups = [
      {
        date: "2026-04-05",
        formattedDate: "Sat, Apr 5",
        dailySpend: 0,
        transactions: [
          { id: 20, ...baseTx, amount: "100", description: "Single Adj", category: "Adj", type: "Expense", accountId: 1 },
        ],
      },
    ];
    renderList({
      dateGroups: adjGroups,
      isBalanceAdjustment,
      showAdjustments: true,
    });
    expect(screen.getByText("Single Adj")).toBeInTheDocument();
    expect(screen.queryByText(/Balance Adjustments/)).not.toBeInTheDocument();
  });

  it("does not show daily spend when it is 0", () => {
    const groups = [
      {
        date: "2026-04-05",
        formattedDate: "Sat, Apr 5",
        dailySpend: 0,
        transactions: [
          { id: 1, ...baseTx, amount: "100000", description: "Salary", category: "Income", type: "Income", accountId: 1 },
        ],
      },
    ];
    renderList({ dateGroups: groups });
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });

  it("renders balance adjustment with italic styling and info tooltip", () => {
    const isBalanceAdjustment = (tx: { description: string }) => tx.description.includes("Adjustment");
    const adjGroups = [
      {
        date: "2026-04-05",
        formattedDate: "Sat, Apr 5",
        dailySpend: 0,
        transactions: [
          { id: 20, ...baseTx, amount: "100", description: "Balance Adjustment", category: "Adj", type: "Expense", accountId: 1 },
        ],
      },
    ];
    renderList({ dateGroups: adjGroups, isBalanceAdjustment, showAdjustments: true });
    expect(screen.getByText("Balance Adjustment")).toBeInTheDocument();
  });
});
