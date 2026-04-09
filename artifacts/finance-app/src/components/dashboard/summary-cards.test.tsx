import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SummaryCards } from "./summary-cards";
import { TestWrapper } from "@/test/test-wrapper";
import { mockSummary, mockGoals } from "@/test/msw-handlers";
import { vi } from "vitest";

const defaultProps = {
  summary: mockSummary,
  isLoadingSummary: false,
  isErrorSummary: false,
  refetchSummary: vi.fn(),
  liquidCash: 125000,
  liquidityRatio: 2.08,
  liquidityHealthy: true,
  totalBank: 150000,
  totalCcOutstanding: 25000,
  totalLoanOutstanding: 500000,
  netWorth: -375000,
  debtToAssetRatio: 350,
  allAccounts: [{ id: 1 }],
  isErrorAccounts: false,
  refetchAccounts: vi.fn(),
  goals: mockGoals.map(g => ({ targetAmount: g.targetAmount, currentAmount: g.currentAmount })),
  isErrorGoals: false,
  refetchGoals: vi.fn(),
};

function renderCards(overrides = {}) {
  return render(
    <TestWrapper>
      <SummaryCards {...defaultProps} {...overrides} />
    </TestWrapper>,
  );
}

describe("SummaryCards", () => {
  it("renders Net Liquidity card", () => {
    renderCards();
    expect(screen.getByText("Net Liquidity")).toBeInTheDocument();
  });

  it("renders Net Worth card", () => {
    renderCards();
    expect(screen.getByText("Net Worth")).toBeInTheDocument();
  });

  it("renders Goal Progress card", () => {
    renderCards();
    expect(screen.getByText("Goal Progress")).toBeInTheDocument();
  });

  it("shows liquidity ratio", () => {
    renderCards();
    expect(screen.getByText(/Covers 2.1x monthly expenses/)).toBeInTheDocument();
  });

  it("shows debt-to-asset ratio", () => {
    renderCards();
    expect(screen.getByText(/Debt-to-asset ratio/)).toBeInTheDocument();
  });

  it("shows loading skeleton for summary", () => {
    const { container } = renderCards({ isLoadingSummary: true });
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state for summary", () => {
    renderCards({ isErrorSummary: true });
    expect(screen.getByText(/Failed to load summary/)).toBeInTheDocument();
  });

  it("calls refetchSummary on error retry", () => {
    const refetchSummary = vi.fn();
    renderCards({ isErrorSummary: true, refetchSummary });
    fireEvent.click(screen.getByText(/Retry/));
    expect(refetchSummary).toHaveBeenCalled();
  });

  it("shows error state for accounts", () => {
    renderCards({ isErrorAccounts: true });
    expect(screen.getByText(/Failed to load accounts/)).toBeInTheDocument();
  });

  it("calls refetchAccounts on accounts error retry", () => {
    const refetchAccounts = vi.fn();
    renderCards({ isErrorAccounts: true, refetchAccounts });
    fireEvent.click(screen.getByText(/Retry/));
    expect(refetchAccounts).toHaveBeenCalled();
  });

  it("shows error state for goals", () => {
    renderCards({ isErrorGoals: true });
    expect(screen.getByText(/Failed to load goals/)).toBeInTheDocument();
  });

  it("calls refetchGoals on goals error retry", () => {
    const refetchGoals = vi.fn();
    renderCards({ isErrorGoals: true, refetchGoals });
    fireEvent.click(screen.getByText(/Retry/));
    expect(refetchGoals).toHaveBeenCalled();
  });

  it("shows no active goals when goals array is empty", () => {
    renderCards({ goals: [] });
    expect(screen.getByText("No active goals")).toBeInTheDocument();
  });

  it("shows goal progress ring when goals exist", () => {
    renderCards();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("GOALS")).toBeInTheDocument();
  });

  it("renders with no EMI due (hides EMI breakdown)", () => {
    renderCards({ summary: { ...mockSummary, totalEmiDue: "0" } });
    expect(screen.getByText("Net Liquidity")).toBeInTheDocument();
  });

  it("renders with EMI due showing landmark icon", () => {
    renderCards({ summary: { ...mockSummary, totalEmiDue: "15000" } });
    expect(screen.getByText("Net Liquidity")).toBeInTheDocument();
  });

  it("renders with no loan outstanding (hides loan in net worth)", () => {
    renderCards({ totalLoanOutstanding: 0 });
    expect(screen.getByText("Net Worth")).toBeInTheDocument();
  });

  it("renders with positive net worth and low debt ratio", () => {
    renderCards({ netWorth: 500000, debtToAssetRatio: 20 });
    expect(screen.getByText(/20.0%/)).toBeInTheDocument();
  });

  it("renders with high debt ratio (>80) as destructive color", () => {
    renderCards({ debtToAssetRatio: 90 });
    expect(screen.getByText(/90.0%/)).toBeInTheDocument();
  });

  it("renders with medium debt ratio (50-80) as amber color", () => {
    renderCards({ debtToAssetRatio: 60 });
    expect(screen.getByText(/60.0%/)).toBeInTheDocument();
  });

  it("renders with unhealthy liquidity", () => {
    renderCards({ liquidityHealthy: false, liquidityRatio: 0.5 });
    expect(screen.getByText(/0.5x monthly expenses/)).toBeInTheDocument();
  });

  it("shows loading skeleton for accounts", () => {
    const { container } = renderCards({ allAccounts: undefined, isErrorAccounts: false });
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="Skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders with undefined goals (shows no active goals or progress)", () => {
    renderCards({ goals: undefined });
    expect(screen.getByText("Goal Progress")).toBeInTheDocument();
  });

  it("renders with negative net worth", () => {
    renderCards({ netWorth: -375000 });
    expect(screen.getByText("Net Worth")).toBeInTheDocument();
  });

  it("renders with positive net worth applying emerald color", () => {
    const { container } = renderCards({ netWorth: 500000, debtToAssetRatio: 10 });
    const netWorthValue = container.querySelector('.text-emerald-500');
    expect(netWorthValue).toBeInTheDocument();
  });

  it("renders with zero net worth", () => {
    renderCards({ netWorth: 0, debtToAssetRatio: 0 });
    expect(screen.getByText(/0.0%/)).toBeInTheDocument();
  });

  it("renders undefined summary with fallback values", () => {
    renderCards({ summary: undefined, isLoadingSummary: false, isErrorSummary: false });
    expect(screen.getByText("Net Liquidity")).toBeInTheDocument();
  });
});
