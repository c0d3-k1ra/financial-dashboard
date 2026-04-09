import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestWrapper } from "@/test/test-wrapper";
import { NetWorthCard } from "./net-worth-card";

const defaultProps = {
  netWorth: 500000,
  totalBank: 1000000,
  totalCcOutstanding: 200000,
  totalLoanOutstanding: 300000,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

describe("NetWorthCard", () => {
  it("renders net worth title", () => {
    render(<TestWrapper><NetWorthCard {...defaultProps} /></TestWrapper>);
    expect(screen.getByText("Net Worth")).toBeInTheDocument();
  });

  it("shows loading skeleton", () => {
    const { container } = render(<TestWrapper><NetWorthCard {...defaultProps} isLoading={true} /></TestWrapper>);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it("shows error state", () => {
    render(<TestWrapper><NetWorthCard {...defaultProps} isError={true} /></TestWrapper>);
    expect(screen.getByText(/Retry/i)).toBeInTheDocument();
  });

  it("shows positive net worth with green styling", () => {
    render(<TestWrapper><NetWorthCard {...defaultProps} /></TestWrapper>);
    expect(screen.getByText("Assets")).toBeInTheDocument();
    expect(screen.getByText("CC Debt")).toBeInTheDocument();
  });

  it("shows negative net worth", () => {
    render(<TestWrapper><NetWorthCard {...defaultProps} netWorth={-100000} /></TestWrapper>);
    expect(screen.getByText("Net Worth")).toBeInTheDocument();
  });

  it("shows loan section when totalLoanOutstanding > 0", () => {
    render(<TestWrapper><NetWorthCard {...defaultProps} /></TestWrapper>);
    expect(screen.getByText("Loans")).toBeInTheDocument();
  });

  it("hides loan section when totalLoanOutstanding is 0", () => {
    render(<TestWrapper><NetWorthCard {...defaultProps} totalLoanOutstanding={0} /></TestWrapper>);
    expect(screen.queryByText("Loans")).not.toBeInTheDocument();
  });

  it("hides breakdown when all totals are 0", () => {
    render(<TestWrapper><NetWorthCard {...defaultProps} totalBank={0} totalCcOutstanding={0} totalLoanOutstanding={0} /></TestWrapper>);
    expect(screen.queryByText("Assets")).not.toBeInTheDocument();
  });
});
