import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountCardSections } from "./account-cards";
import { TestWrapper } from "@/test/test-wrapper";

const bankAccounts = [
  { id: 1, name: "HDFC Savings", type: "bank", currentBalance: "100000", useInSurplus: true },
  { id: 2, name: "SBI Savings", type: "bank", currentBalance: "50000", useInSurplus: false },
];
const ccAccounts = [
  { id: 3, name: "ICICI CC", type: "credit_card", currentBalance: "-25000", creditLimit: "200000", billingDueDay: 15, sharedLimitGroup: null },
  { id: 6, name: "HDFC CC", type: "credit_card", currentBalance: "-10000", creditLimit: "200000", billingDueDay: 20, sharedLimitGroup: "Premium" },
];
const loanAccounts = [
  {
    id: 4, name: "Home Loan", type: "loan", currentBalance: "-500000",
    emiAmount: "15000", emiDay: 5, loanTenure: 240, interestRate: "8.5",
    originalLoanAmount: "2000000", loanStartDate: "2024-01-01", emisPaid: 24,
    linkedAccountId: 1,
  },
];

const allAccounts = [...bankAccounts, ...ccAccounts, ...loanAccounts];

const defaultProps = {
  bankAccounts,
  ccAccounts,
  loanAccounts,
  accounts: allAccounts,
  bankOpen: true,
  setBankOpen: vi.fn(),
  ccOpen: true,
  setCcOpen: vi.fn(),
  loanOpen: true,
  setLoanOpen: vi.fn(),
  openEdit: vi.fn(),
  setReconcileId: vi.fn(),
  setReconcileBalance: vi.fn(),
  setDeleteAccountId: vi.fn(),
};

function renderCards(overrides = {}) {
  return render(<TestWrapper><AccountCardSections {...defaultProps} {...overrides} /></TestWrapper>);
}

describe("AccountCardSections", () => {
  it("renders bank account section with names", () => {
    renderCards();
    expect(screen.getByText("Bank Accounts")).toBeInTheDocument();
    expect(screen.getAllByText("HDFC Savings").length).toBeGreaterThan(0);
    expect(screen.getByText("SBI Savings")).toBeInTheDocument();
  });

  it("renders credit card section", () => {
    renderCards();
    expect(screen.getByText("Credit Cards")).toBeInTheDocument();
    expect(screen.getByText("ICICI CC")).toBeInTheDocument();
  });

  it("renders loan section", () => {
    renderCards();
    expect(screen.getByText("Loans")).toBeInTheDocument();
    expect(screen.getByText("Home Loan")).toBeInTheDocument();
  });

  it("shows surplus badge for bank account with useInSurplus", () => {
    renderCards();
    expect(screen.getByText("Surplus")).toBeInTheDocument();
  });

  it("toggles bank section when clicked", async () => {
    const setBankOpen = vi.fn();
    const user = userEvent.setup();
    renderCards({ setBankOpen });
    await user.click(screen.getByText("Bank Accounts"));
    expect(setBankOpen).toHaveBeenCalledWith(false);
  });

  it("toggles cc section when clicked", async () => {
    const setCcOpen = vi.fn();
    const user = userEvent.setup();
    renderCards({ setCcOpen });
    await user.click(screen.getByText("Credit Cards"));
    expect(setCcOpen).toHaveBeenCalledWith(false);
  });

  it("toggles loan section when clicked", async () => {
    const setLoanOpen = vi.fn();
    const user = userEvent.setup();
    renderCards({ setLoanOpen });
    await user.click(screen.getByText("Loans"));
    expect(setLoanOpen).toHaveBeenCalledWith(false);
  });

  it("hides bank cards when bankOpen is false", () => {
    renderCards({ bankOpen: false, loanAccounts: [], ccAccounts: [] });
    expect(screen.getByText("Bank Accounts")).toBeInTheDocument();
    expect(screen.queryByText("HDFC Savings")).not.toBeInTheDocument();
  });

  it("hides cc cards when ccOpen is false", () => {
    renderCards({ ccOpen: false });
    expect(screen.getByText("Credit Cards")).toBeInTheDocument();
    expect(screen.queryByText("ICICI CC")).not.toBeInTheDocument();
  });

  it("hides loan cards when loanOpen is false", () => {
    renderCards({ loanOpen: false });
    expect(screen.getByText("Loans")).toBeInTheDocument();
    expect(screen.queryByText("Home Loan")).not.toBeInTheDocument();
  });

  it("does not render sections with empty arrays", () => {
    renderCards({ bankAccounts: [], ccAccounts: [], loanAccounts: [] });
    expect(screen.queryByText("Bank Accounts")).not.toBeInTheDocument();
    expect(screen.queryByText("Credit Cards")).not.toBeInTheDocument();
    expect(screen.queryByText("Loans")).not.toBeInTheDocument();
  });

  it("shows credit card outstanding info", () => {
    renderCards();
    expect(screen.getAllByText("Outstanding").length).toBeGreaterThan(0);
  });

  it("shows credit card limit info", () => {
    renderCards();
    expect(screen.getAllByText("Limit").length).toBeGreaterThan(0);
  });

  it("shows shared limit group badge", () => {
    renderCards();
    expect(screen.getByText("Premium")).toBeInTheDocument();
  });

  it("shows billing due day for credit card", () => {
    renderCards();
    expect(screen.getByText(/Due 15th/)).toBeInTheDocument();
  });

  it("shows loan EMI info", () => {
    renderCards();
    expect(screen.getByText("EMI")).toBeInTheDocument();
  });

  it("shows loan interest rate", () => {
    renderCards();
    expect(screen.getByText("Rate")).toBeInTheDocument();
    expect(screen.getByText("8.5% p.a.")).toBeInTheDocument();
  });

  it("shows loan tenure and EMI count", () => {
    renderCards();
    expect(screen.getByText("EMIs")).toBeInTheDocument();
    expect(screen.getByText(/24\/240 paid/)).toBeInTheDocument();
  });

  it("shows loan linked account name", () => {
    renderCards();
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getAllByText("HDFC Savings").length).toBeGreaterThanOrEqual(2);
  });

  it("shows estimated payoff date", () => {
    renderCards();
    expect(screen.getByText("Payoff")).toBeInTheDocument();
  });

  it("shows principal paid info", () => {
    renderCards();
    expect(screen.getByText("Principal Paid")).toBeInTheDocument();
  });

  it("shows loan original amount", () => {
    renderCards();
    expect(screen.getByText(/Loan:/)).toBeInTheDocument();
  });

  it("shows progress bar for loan repayment", () => {
    renderCards();
    expect(screen.getByText(/principal repaid/)).toBeInTheDocument();
  });

  it("shows EMI day info for loan", () => {
    renderCards();
    expect(screen.getByText(/EMI on 5th/)).toBeInTheDocument();
  });

  it("renders loan without optional fields", () => {
    const minimalLoan = [
      { id: 5, name: "Personal Loan", type: "loan", currentBalance: "-100000" },
    ];
    renderCards({ loanAccounts: minimalLoan, bankAccounts: [], ccAccounts: [] });
    expect(screen.getByText("Personal Loan")).toBeInTheDocument();
  });

  it("renders cc without creditLimit", () => {
    const noLimitCC = [
      { id: 7, name: "Simple CC", type: "credit_card", currentBalance: "-5000" },
    ];
    renderCards({ ccAccounts: noLimitCC, bankAccounts: [], loanAccounts: [] });
    expect(screen.getByText("Simple CC")).toBeInTheDocument();
  });

  it("calls openEdit when pencil button clicked on bank card", async () => {
    const openEdit = vi.fn();
    const user = userEvent.setup();
    renderCards({ openEdit, ccAccounts: [], loanAccounts: [] });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    expect(editButtons.length).toBeGreaterThan(0);
    await user.click(editButtons[0]);
    expect(openEdit).toHaveBeenCalledWith(1);
  });

  it("calls setDeleteAccountId when delete button clicked", async () => {
    const setDeleteAccountId = vi.fn();
    const user = userEvent.setup();
    renderCards({ setDeleteAccountId, ccAccounts: [], loanAccounts: [] });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    expect(deleteButtons.length).toBeGreaterThan(0);
    await user.click(deleteButtons[0]);
    expect(setDeleteAccountId).toHaveBeenCalledWith(1);
  });

  it("calls setReconcileId when sync button clicked", async () => {
    const setReconcileId = vi.fn();
    const setReconcileBalance = vi.fn();
    const user = userEvent.setup();
    renderCards({ setReconcileId, setReconcileBalance, ccAccounts: [], loanAccounts: [] });
    const syncButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-refresh-cw") !== null,
    );
    expect(syncButtons.length).toBeGreaterThan(0);
    await user.click(syncButtons[0]);
    expect(setReconcileId).toHaveBeenCalledWith(1);
    expect(setReconcileBalance).toHaveBeenCalledWith("100000");
  });

  it("shows available limit for credit cards", () => {
    renderCards();
    expect(screen.getAllByText("Available").length).toBeGreaterThan(0);
  });

  it("shows interest paid for loan with enough EMIs", () => {
    const highEmiLoan = [
      {
        id: 4, name: "High EMI Loan", type: "loan", currentBalance: "-100000",
        emiAmount: "50000", emiDay: 5, loanTenure: 60, interestRate: "8.5",
        originalLoanAmount: "500000", loanStartDate: "2024-01-01", emisPaid: 24,
      },
    ];
    renderCards({ loanAccounts: highEmiLoan, bankAccounts: [], ccAccounts: [] });
    expect(screen.getByText("Interest Paid")).toBeInTheDocument();
  });

  it("renders loan with no start date but has emisRemaining", () => {
    const loanNoStart = [
      {
        id: 5, name: "Car Loan", type: "loan", currentBalance: "-200000",
        emiAmount: "10000", emiDay: 10, loanTenure: 60, interestRate: "9.0",
        originalLoanAmount: "500000", emisPaid: 10,
      },
    ];
    renderCards({ loanAccounts: loanNoStart, bankAccounts: [], ccAccounts: [] });
    expect(screen.getByText("Car Loan")).toBeInTheDocument();
    expect(screen.getByText("Payoff")).toBeInTheDocument();
  });
});
