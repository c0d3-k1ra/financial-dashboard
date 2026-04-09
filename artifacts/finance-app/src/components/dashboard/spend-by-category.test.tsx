import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpendByCategorySection } from "./spend-by-category";
import { TestWrapper } from "@/test/test-wrapper";

vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  };
});

const defaultProps = {
  pieData: [
    { name: "Food", value: 15000, fill: "#ef4444" },
    { name: "Transport", value: 8000, fill: "#3b82f6" },
    { name: "Utilities", value: 5000, fill: "#22c55e" },
  ],
  pieTotal: 28000,
  isLoadingCatSpend: false,
  isErrorCatSpend: false,
  refetchCatSpend: vi.fn(),
  spendAccountFilter: "all" as const,
  setSpendAccountFilter: vi.fn(),
  ccDues: [] as Array<{ id: number; name: string; outstanding: string; creditLimit?: string | null; remainingLimit?: string | null; sharedLimitGroup?: string | null }>,
  isLoadingCcDues: false,
  isErrorCcDues: false,
  refetchCcDues: vi.fn(),
};

function renderComponent(overrides = {}) {
  return render(
    <TestWrapper>
      <SpendByCategorySection {...defaultProps} {...overrides} />
    </TestWrapper>,
  );
}

describe("SpendByCategorySection", () => {
  it("renders the title", () => {
    renderComponent();
    expect(screen.getByText("Spend by Category")).toBeInTheDocument();
  });

  it("renders description", () => {
    renderComponent();
    expect(screen.getByText("Expense breakdown for this billing cycle")).toBeInTheDocument();
  });

  it("shows loading skeleton", () => {
    const { container } = renderComponent({ isLoadingCatSpend: true });
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="Skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state", () => {
    renderComponent({ isErrorCatSpend: true });
    expect(screen.getByText(/Retry/)).toBeInTheDocument();
  });

  it("calls refetchCatSpend on error retry", () => {
    const refetchCatSpend = vi.fn();
    renderComponent({ isErrorCatSpend: true, refetchCatSpend });
    fireEvent.click(screen.getByText(/Retry/));
    expect(refetchCatSpend).toHaveBeenCalled();
  });

  it("renders category list", () => {
    renderComponent();
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("Transport")).toBeInTheDocument();
    expect(screen.getByText("Utilities")).toBeInTheDocument();
  });

  it("shows pie chart container", () => {
    renderComponent();
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("shows no expense message when pie data is empty", () => {
    renderComponent({ pieData: [], pieTotal: 0 });
    expect(screen.getByText(/No expense data/)).toBeInTheDocument();
  });

  it("shows no credit cards message when cc dues is empty", () => {
    renderComponent({ ccDues: [] });
    expect(screen.getByText(/No credit cards/)).toBeInTheDocument();
  });

  it("renders filter buttons for All, CC, Non-CC", () => {
    renderComponent();
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("CC")).toBeInTheDocument();
    expect(screen.getByText("Non-CC")).toBeInTheDocument();
  });

  it("calls setSpendAccountFilter when clicking CC filter", () => {
    const setSpendAccountFilter = vi.fn();
    renderComponent({ setSpendAccountFilter });
    fireEvent.click(screen.getByText("CC"));
    expect(setSpendAccountFilter).toHaveBeenCalledWith("cc");
  });

  it("calls setSpendAccountFilter when clicking Non-CC filter", () => {
    const setSpendAccountFilter = vi.fn();
    renderComponent({ setSpendAccountFilter });
    fireEvent.click(screen.getByText("Non-CC"));
    expect(setSpendAccountFilter).toHaveBeenCalledWith("non_cc");
  });

  it("renders category percentage values", () => {
    renderComponent();
    expect(screen.getByText("53.6%")).toBeInTheDocument();
    expect(screen.getByText("28.6%")).toBeInTheDocument();
    expect(screen.getByText("17.9%")).toBeInTheDocument();
  });

  it("renders total row", () => {
    renderComponent();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders cc outstanding section with cc data", () => {
    renderComponent({
      ccDues: [{ id: 1, name: "ICICI CC", outstanding: "5000", creditLimit: "100000", remainingLimit: "95000" }],
    });
    expect(screen.getByText("ICICI CC")).toBeInTheDocument();
  });

  it("renders cc card with shared limit group badge", () => {
    renderComponent({
      ccDues: [{ id: 1, name: "ICICI CC", outstanding: "5000", sharedLimitGroup: "ICICI Group", creditLimit: "100000", remainingLimit: "95000" }],
    });
    expect(screen.getByText("ICICI Group")).toBeInTheDocument();
  });

  it("renders remaining limit for cc card", () => {
    renderComponent({
      ccDues: [{ id: 1, name: "SBI CC", outstanding: "20000", creditLimit: "100000", remainingLimit: "80000" }],
    });
    expect(screen.getByText(/Available/)).toBeInTheDocument();
  });

  it("renders cc card with low remaining limit (yellow)", () => {
    renderComponent({
      ccDues: [{ id: 1, name: "Low CC", outstanding: "70000", creditLimit: "100000", remainingLimit: "30000" }],
    });
    expect(screen.getByText(/Available/)).toBeInTheDocument();
  });

  it("renders cc card with very low remaining limit (destructive)", () => {
    renderComponent({
      ccDues: [{ id: 1, name: "Very Low CC", outstanding: "90000", creditLimit: "100000", remainingLimit: "10000" }],
    });
    expect(screen.getByText(/Available/)).toBeInTheDocument();
  });

  it("shows loading skeleton for cc dues", () => {
    const { container } = renderComponent({ isLoadingCcDues: true });
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="Skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state for cc dues", () => {
    renderComponent({ isErrorCcDues: true });
    expect(screen.getByText(/Failed to load CC dues/)).toBeInTheDocument();
  });

  it("calls refetchCcDues on cc error retry", () => {
    const refetchCcDues = vi.fn();
    renderComponent({ isErrorCcDues: true, refetchCcDues });
    const retryBtns = screen.getAllByText(/Retry/);
    fireEvent.click(retryBtns[retryBtns.length - 1]);
    expect(refetchCcDues).toHaveBeenCalled();
  });

  it("renders CC Outstanding title", () => {
    renderComponent();
    expect(screen.getByText("CC Outstanding")).toBeInTheDocument();
  });

  it("renders scroll hint when more than 6 pie items", () => {
    const manyPieData = Array.from({ length: 8 }, (_, i) => ({
      name: `Cat${i}`,
      value: 1000 * (i + 1),
      fill: `#${i}${i}${i}${i}${i}${i}`,
    }));
    const { container } = renderComponent({ pieData: manyPieData, pieTotal: 36000 });
    expect(container.querySelector('[data-scroll-hint]')).toBeInTheDocument();
  });

  it("renders scroll hint when more than 3 cc dues", () => {
    const manyCcDues = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `CC ${i + 1}`,
      outstanding: `${(i + 1) * 10000}`,
    }));
    const { container } = renderComponent({ ccDues: manyCcDues });
    expect(container.querySelector('[data-scroll-hint]')).toBeInTheDocument();
  });

  it("renders with zero pieTotal", () => {
    renderComponent({
      pieData: [{ name: "Food", value: 0, fill: "#ef4444" }],
      pieTotal: 0,
    });
    expect(screen.getByText("0.0%")).toBeInTheDocument();
  });

  it("renders cc card without creditLimit", () => {
    renderComponent({
      ccDues: [{ id: 1, name: "Basic CC", outstanding: "5000", remainingLimit: "10000" }],
    });
    expect(screen.getByText(/Available/)).toBeInTheDocument();
  });

  it("highlights active filter button", () => {
    renderComponent({ spendAccountFilter: "cc" });
    const ccBtn = screen.getByText("CC");
    expect(ccBtn.className).toContain("bg-primary");
  });

  it("calls setSpendAccountFilter when clicking All filter", () => {
    const setSpendAccountFilter = vi.fn();
    renderComponent({ setSpendAccountFilter, spendAccountFilter: "cc" });
    fireEvent.click(screen.getByText("All"));
    expect(setSpendAccountFilter).toHaveBeenCalledWith("all");
  });

  it("highlights Non-CC when active", () => {
    renderComponent({ spendAccountFilter: "non_cc" });
    const nonCcBtn = screen.getByText("Non-CC");
    expect(nonCcBtn.className).toContain("bg-primary");
  });

  it("renders multiple CC dues cards", () => {
    renderComponent({
      ccDues: [
        { id: 1, name: "ICICI CC", outstanding: "25000", creditLimit: "200000", remainingLimit: "175000" },
        { id: 2, name: "SBI CC", outstanding: "15000", creditLimit: "100000", remainingLimit: "85000" },
        { id: 3, name: "HDFC CC", outstanding: "5000", creditLimit: "150000", remainingLimit: "145000" },
      ],
    });
    expect(screen.getByText("ICICI CC")).toBeInTheDocument();
    expect(screen.getByText("SBI CC")).toBeInTheDocument();
    expect(screen.getByText("HDFC CC")).toBeInTheDocument();
  });

  it("renders cc card without remainingLimit", () => {
    renderComponent({
      ccDues: [{ id: 1, name: "Simple CC", outstanding: "10000" }],
    });
    expect(screen.getByText("Simple CC")).toBeInTheDocument();
    expect(screen.queryByText(/Available/)).not.toBeInTheDocument();
  });

  it("renders cc card with high remaining limit (emerald)", () => {
    renderComponent({
      ccDues: [{ id: 1, name: "Good CC", outstanding: "10000", creditLimit: "200000", remainingLimit: "190000" }],
    });
    expect(screen.getByText(/Available/)).toBeInTheDocument();
  });

  it("does not show scroll hint with 6 or fewer pie items", () => {
    const { container } = renderComponent();
    expect(container.querySelector('[data-scroll-hint]')).not.toBeInTheDocument();
  });

  it("does not show cc scroll hint with 3 or fewer cc dues", () => {
    const { container } = renderComponent({
      ccDues: [
        { id: 1, name: "CC1", outstanding: "5000" },
        { id: 2, name: "CC2", outstanding: "8000" },
      ],
    });
    expect(container.querySelector('[data-scroll-hint]')).not.toBeInTheDocument();
  });

  it("fires scroll event on category table", () => {
    const manyPieData = Array.from({ length: 10 }, (_, i) => ({
      name: `Category${i}`,
      value: 1000 * (i + 1),
      fill: `hsl(${i * 36}, 70%, 50%)`,
    }));
    const { container } = renderComponent({ pieData: manyPieData, pieTotal: 55000 });
    const scrollContainer = container.querySelector('.overflow-auto.max-h-\\[280px\\]');
    if (scrollContainer) {
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } });
    }
    expect(container.querySelector('[data-scroll-hint]')).toBeInTheDocument();
  });

  it("fires scroll event on cc dues container", () => {
    const manyCcDues = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `CC ${i + 1}`,
      outstanding: `${(i + 1) * 10000}`,
    }));
    const { container } = renderComponent({ ccDues: manyCcDues });
    const scrollContainer = container.querySelector('.overflow-y-auto.pr-1');
    if (scrollContainer) {
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } });
    }
  });

  it("renders with cc card having null remainingLimit", () => {
    renderComponent({
      ccDues: [{ id: 1, name: "Null Limit CC", outstanding: "5000", remainingLimit: null }],
    });
    expect(screen.getByText("Null Limit CC")).toBeInTheDocument();
    expect(screen.queryByText(/Available/)).not.toBeInTheDocument();
  });

  it("renders cc card with zero credit limit", () => {
    renderComponent({
      ccDues: [{ id: 1, name: "Zero Limit CC", outstanding: "5000", creditLimit: "0", remainingLimit: "0" }],
    });
    expect(screen.getByText("Zero Limit CC")).toBeInTheDocument();
  });

  it("renders table headers for category breakdown", () => {
    renderComponent();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("%")).toBeInTheDocument();
  });
});
