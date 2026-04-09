import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoanSection } from "./loan-section";
import { TestWrapper } from "@/test/test-wrapper";

const loanAccounts = [
  {
    id: 4,
    name: "Home Loan",
    currentBalance: "-500000",
    emiAmount: "15000",
    emiDay: 5,
    loanTenure: 240,
    interestRate: "8.5",
    originalLoanAmount: "2000000",
    loanStartDate: "2024-01-01",
    emisPaid: 28,
  },
];

function renderLoanSection(overrides = {}) {
  return render(
    <TestWrapper>
      <LoanSection
        loanAccounts={loanAccounts}
        totalLoanOutstanding="500000"
        totalEmiDue="15000"
        {...overrides}
      />
    </TestWrapper>,
  );
}

describe("LoanSection", () => {
  it("renders loan outstanding card", () => {
    renderLoanSection();
    expect(screen.getByText("Loan Outstanding")).toBeInTheDocument();
  });

  it("renders upcoming EMI dues card", () => {
    renderLoanSection();
    expect(screen.getByText("Upcoming EMI Dues")).toBeInTheDocument();
  });

  it("shows loan name", () => {
    renderLoanSection();
    const loanNames = screen.getAllByText("Home Loan");
    expect(loanNames.length).toBeGreaterThan(0);
  });

  it("shows interest rate", () => {
    renderLoanSection();
    expect(screen.getByText("@ 8.5%")).toBeInTheDocument();
  });

  it("shows emi day", () => {
    renderLoanSection();
    expect(screen.getByText("5th")).toBeInTheDocument();
  });

  it("shows progress percentage for loans with original amount", () => {
    renderLoanSection();
    expect(screen.getByText(/paid$/)).toBeInTheDocument();
  });

  it("shows EMI count info", () => {
    renderLoanSection();
    expect(screen.getByText(/28\/240/)).toBeInTheDocument();
  });

  it("shows payoff estimate", () => {
    renderLoanSection();
    expect(screen.getByText(/Payoff:/)).toBeInTheDocument();
  });

  it("shows no active loans message when empty", () => {
    render(
      <TestWrapper>
        <LoanSection loanAccounts={[]} totalLoanOutstanding="0" totalEmiDue="0" />
      </TestWrapper>,
    );
    expect(screen.getByText("No active loans")).toBeInTheDocument();
  });

  it("shows monthly EMI burden", () => {
    renderLoanSection();
    expect(screen.getByText(/Monthly EMI burden/)).toBeInTheDocument();
  });

  it("hides monthly EMI burden when totalEmiDue is 0", () => {
    renderLoanSection({ totalEmiDue: "0" });
    expect(screen.queryByText(/Monthly EMI burden/)).not.toBeInTheDocument();
  });

  it("shows message when original amount is not set", () => {
    render(
      <TestWrapper>
        <LoanSection
          loanAccounts={[{ id: 1, name: "PL", currentBalance: "-100000", emiAmount: "5000", emiDay: 10 }]}
          totalLoanOutstanding="100000"
          totalEmiDue="5000"
        />
      </TestWrapper>,
    );
    expect(screen.getByText(/Set original loan amount/)).toBeInTheDocument();
  });

  it("shows outstanding description text", () => {
    renderLoanSection();
    expect(screen.getByText("Total loan principal remaining")).toBeInTheDocument();
  });

  it("shows active loan EMI schedule description", () => {
    renderLoanSection();
    expect(screen.getByText("Active loan EMI schedule")).toBeInTheDocument();
  });

  it("renders loan with no emi amount showing dash", () => {
    render(
      <TestWrapper>
        <LoanSection
          loanAccounts={[{ id: 1, name: "No EMI Loan", currentBalance: "-100000" }]}
          totalLoanOutstanding="100000"
          totalEmiDue="0"
        />
      </TestWrapper>,
    );
    const dashes = screen.getAllByText(/—/);
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("renders loan without loanStartDate but with emisRemaining for payoff", () => {
    render(
      <TestWrapper>
        <LoanSection
          loanAccounts={[{
            id: 1,
            name: "Car Loan",
            currentBalance: "-200000",
            emiAmount: "10000",
            emiDay: 10,
            loanTenure: 60,
            interestRate: "9",
            originalLoanAmount: "500000",
            emisPaid: 20,
          }]}
          totalLoanOutstanding="200000"
          totalEmiDue="10000"
        />
      </TestWrapper>,
    );
    expect(screen.getByText(/Payoff:/)).toBeInTheDocument();
    expect(screen.getByText(/20\/60/)).toBeInTheDocument();
  });

  it("renders interest paid information when applicable", () => {
    render(
      <TestWrapper>
        <LoanSection
          loanAccounts={[{
            id: 1,
            name: "Interest Loan",
            currentBalance: "90000",
            emiAmount: "5000",
            emiDay: 10,
            loanTenure: 24,
            interestRate: "12",
            originalLoanAmount: "100000",
            emisPaid: 10,
          }]}
          totalLoanOutstanding="90000"
          totalEmiDue="5000"
        />
      </TestWrapper>,
    );
    expect(screen.getByText(/Interest Paid/)).toBeInTheDocument();
  });

  it("renders loan with no interest rate", () => {
    render(
      <TestWrapper>
        <LoanSection
          loanAccounts={[{
            id: 1,
            name: "Zero Rate Loan",
            currentBalance: "-100000",
            emiAmount: "5000",
            emiDay: 10,
            loanTenure: 24,
            originalLoanAmount: "120000",
            emisPaid: 4,
          }]}
          totalLoanOutstanding="100000"
          totalEmiDue="5000"
        />
      </TestWrapper>,
    );
    expect(screen.queryByText(/@ /)).not.toBeInTheDocument();
  });

  it("renders loan with no emiDay", () => {
    render(
      <TestWrapper>
        <LoanSection
          loanAccounts={[{
            id: 1,
            name: "No Day Loan",
            currentBalance: "-100000",
            emiAmount: "5000",
          }]}
          totalLoanOutstanding="100000"
          totalEmiDue="5000"
        />
      </TestWrapper>,
    );
    expect(screen.queryByText(/th$/)).not.toBeInTheDocument();
  });

  it("renders fully paid loan (emisPaid === tenure)", () => {
    render(
      <TestWrapper>
        <LoanSection
          loanAccounts={[{
            id: 1,
            name: "Paid Loan",
            currentBalance: "0",
            emiAmount: "5000",
            emiDay: 5,
            loanTenure: 24,
            originalLoanAmount: "120000",
            emisPaid: 24,
          }]}
          totalLoanOutstanding="0"
          totalEmiDue="0"
        />
      </TestWrapper>,
    );
    expect(screen.getByText(/24\/24/)).toBeInTheDocument();
  });
});
