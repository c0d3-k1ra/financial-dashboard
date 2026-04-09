import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionTable } from "./transaction-table";
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
  {
    date: "2026-04-04",
    formattedDate: "Fri, Apr 4",
    dailySpend: 100000,
    transactions: [
      { id: 2, date: "2026-04-04", amount: "100000", description: "April Salary", category: "Paycheck (Salary)", type: "Income", accountId: 1, toAccountId: null, createdAt: "2026-04-04T09:00:00Z" },
    ],
  },
];

const defaultProps = {
  dateGroups: mockDateGroups,
  accounts: [
    { id: 1, name: "HDFC Savings" },
    { id: 2, name: "SBI Savings" },
  ],
  sortField: "date" as const,
  sortDir: "desc" as const,
  toggleSort: vi.fn(),
  showAdjustments: true,
  expandedAdjustmentDates: new Set<string>(),
  toggleAdjustmentDate: vi.fn(),
  openEdit: vi.fn(),
  setDeleteId: vi.fn(),
  handleCategoryClick: vi.fn(),
  isBalanceAdjustment: () => false,
};

function renderTable(overrides = {}) {
  return render(
    <TestWrapper>
      <TransactionTable {...defaultProps} {...overrides} />
    </TestWrapper>,
  );
}

describe("TransactionTable", () => {
  it("renders the table headers", () => {
    renderTable();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("renders transaction rows", () => {
    renderTable();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("April Salary")).toBeInTheDocument();
  });

  it("shows account names", () => {
    renderTable();
    const hdfc = screen.getAllByText("HDFC Savings");
    expect(hdfc.length).toBeGreaterThan(0);
  });

  it("renders empty when no date groups", () => {
    renderTable({ dateGroups: [] });
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("calls toggleSort when clicking sort headers", async () => {
    const toggleSort = vi.fn();
    const user = userEvent.setup();
    renderTable({ toggleSort });
    await user.click(screen.getByText("Description"));
    expect(toggleSort).toHaveBeenCalledWith("description");
    await user.click(screen.getByText("Amount"));
    expect(toggleSort).toHaveBeenCalledWith("amount");
    await user.click(screen.getByText("Category"));
    expect(toggleSort).toHaveBeenCalledWith("category");
  });

  it("calls openEdit when edit button is clicked", async () => {
    const openEdit = vi.fn();
    const user = userEvent.setup();
    renderTable({ openEdit });
    await user.click(screen.getByTestId("btn-edit-tx-1"));
    expect(openEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it("calls setDeleteId when delete button is clicked", async () => {
    const setDeleteId = vi.fn();
    const user = userEvent.setup();
    renderTable({ setDeleteId });
    await user.click(screen.getByTestId("btn-delete-tx-1"));
    expect(setDeleteId).toHaveBeenCalledWith(1);
  });

  it("does not show edit button for Transfer type", () => {
    const transferGroups = [
      {
        date: "2026-04-05",
        formattedDate: "Sat, Apr 5",
        dailySpend: 0,
        transactions: [
          { id: 10, ...baseTx, amount: "5000", description: "Transfer to SBI", category: "Transfer", type: "Transfer", accountId: 1, toAccountId: 2 },
        ],
      },
    ];
    renderTable({ dateGroups: transferGroups });
    expect(screen.queryByTestId("btn-edit-tx-10")).not.toBeInTheDocument();
    expect(screen.getByTestId("btn-delete-tx-10")).toBeInTheDocument();
  });

  it("shows transfer account format for Transfer type", () => {
    const transferGroups = [
      {
        date: "2026-04-05",
        formattedDate: "Sat, Apr 5",
        dailySpend: 0,
        transactions: [
          { id: 10, ...baseTx, amount: "5000", description: "Transfer to SBI", category: "Transfer", type: "Transfer", accountId: 1, toAccountId: 2 },
        ],
      },
    ];
    renderTable({ dateGroups: transferGroups });
    expect(screen.getByText("HDFC Savings → SBI Savings")).toBeInTheDocument();
  });

  it("shows dash when account not found", () => {
    const groups = [
      {
        date: "2026-04-05",
        formattedDate: "Sat, Apr 5",
        dailySpend: 0,
        transactions: [
          { id: 10, ...baseTx, amount: "100", description: "Unknown acct", category: "Food", type: "Expense", accountId: 999 },
        ],
      },
    ];
    renderTable({ dateGroups: groups });
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders balance adjustment rows with italic styling", () => {
    const isBalanceAdjustment = (tx: { description: string }) => tx.description.includes("Adjustment");
    const adjGroups = [
      {
        date: "2026-04-05",
        formattedDate: "Sat, Apr 5",
        dailySpend: 0,
        transactions: [
          { id: 20, ...baseTx, amount: "100", description: "Balance Adjustment", category: "Adjustment", type: "Expense", accountId: 1 },
        ],
      },
    ];
    renderTable({ dateGroups: adjGroups, isBalanceAdjustment, showAdjustments: true });
    expect(screen.getByText("Balance Adjustment")).toBeInTheDocument();
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
    renderTable({
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
    renderTable({
      dateGroups: adjGroups,
      isBalanceAdjustment,
      showAdjustments: true,
      expandedAdjustmentDates: new Set(["2026-04-05"]),
    });
    expect(screen.getByText("Adj 1")).toBeInTheDocument();
    expect(screen.getByText("Adj 2")).toBeInTheDocument();
    expect(screen.getByText(/Collapse 2 Balance Adjustments/)).toBeInTheDocument();
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
    renderTable({
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
    renderTable({
      dateGroups: adjGroups,
      isBalanceAdjustment,
      showAdjustments: false,
    });
    expect(screen.queryByText("Adj 1")).not.toBeInTheDocument();
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
    renderTable({ dateGroups: groups });
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });

  it("shows single adjustment row without collapse/expand controls", () => {
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
    renderTable({
      dateGroups: adjGroups,
      isBalanceAdjustment,
      showAdjustments: true,
    });
    expect(screen.getByText("Single Adj")).toBeInTheDocument();
    expect(screen.queryByText(/Balance Adjustments/)).not.toBeInTheDocument();
  });

  it("renders active sort icon with text-primary when sortDir is asc for description", () => {
    const { container } = renderTable({ sortField: "description", sortDir: "asc" });
    const headers = container.querySelectorAll("th button");
    const descHeader = headers[0];
    expect(descHeader).toBeTruthy();
    const svgs = descHeader.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    const svgClasses = Array.from(svgs).map(s => s.getAttribute("class") || "");
    expect(svgClasses.some(c => c.includes("text-primary"))).toBe(true);
  });

  it("renders active sort icon with text-primary when sortDir is desc for description", () => {
    const { container } = renderTable({ sortField: "description", sortDir: "desc" });
    const headers = container.querySelectorAll("th button");
    const descHeader = headers[0];
    expect(descHeader).toBeTruthy();
    const svgs = descHeader.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    const svgClasses = Array.from(svgs).map(s => s.getAttribute("class") || "");
    expect(svgClasses.some(c => c.includes("text-primary"))).toBe(true);
  });

  it("renders inactive sort icon with opacity-40 for non-sorted field", () => {
    const { container } = renderTable({ sortField: "amount", sortDir: "asc" });
    const headers = container.querySelectorAll("th button");
    const descHeader = headers[0];
    expect(descHeader).toBeTruthy();
    const svgs = descHeader.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    const svgClasses = Array.from(svgs).map(s => s.getAttribute("class") || "");
    expect(svgClasses.some(c => c.includes("opacity-40"))).toBe(true);
  });

  it("calls handleCategoryClick when clicking a category badge", async () => {
    const handleCategoryClick = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderTable({ handleCategoryClick });
    const categoryBtns = screen.getAllByLabelText("Food");
    await user.click(categoryBtns[0]);
    expect(handleCategoryClick).toHaveBeenCalledWith("Food");
  });
});
