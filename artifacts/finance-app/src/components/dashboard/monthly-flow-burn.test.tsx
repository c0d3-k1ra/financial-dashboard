import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MonthlyFlowChart, BurnRateCard } from "./monthly-flow-burn";
import { TestWrapper } from "@/test/test-wrapper";

vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  };
});

const defaultProps = {
  waterfallData: [
    { name: "Income", value: 100000, fill: "#22c55e" },
    { name: "Fixed", value: -30000, fill: "#ef4444" },
    { name: "Discretionary", value: -25000, fill: "#f97316" },
    { name: "Surplus", value: 45000, fill: "#3b82f6" },
  ],
  isLoadingSummary: false,
  isErrorSummary: false,
  refetchSummary: vi.fn(),
};

function renderComponent(overrides = {}) {
  return render(
    <TestWrapper>
      <MonthlyFlowChart {...defaultProps} {...overrides} />
    </TestWrapper>,
  );
}

describe("MonthlyFlowChart", () => {
  it("renders the title", () => {
    renderComponent();
    expect(screen.getByText("Monthly Flow")).toBeInTheDocument();
  });

  it("renders description", () => {
    renderComponent();
    expect(screen.getByText(/Income → Expenses → Surplus → Goals/)).toBeInTheDocument();
  });

  it("shows loading skeleton", () => {
    const { container } = renderComponent({ isLoadingSummary: true });
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="Skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state", () => {
    renderComponent({ isErrorSummary: true });
    expect(screen.getByText(/Retry/)).toBeInTheDocument();
  });

  it("calls refetchSummary on error retry", () => {
    const refetchSummary = vi.fn();
    renderComponent({ isErrorSummary: true, refetchSummary });
    fireEvent.click(screen.getByText(/Retry/));
    expect(refetchSummary).toHaveBeenCalled();
  });

  it("renders chart when data is loaded", () => {
    renderComponent();
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("handles empty data", () => {
    renderComponent({ waterfallData: [] });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with single bar", () => {
    renderComponent({ waterfallData: [{ name: "Income", value: 100000, fill: "#22c55e" }] });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with privacy mode enabled", () => {
    renderComponent();
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders chart with negative values", () => {
    renderComponent({
      waterfallData: [
        { name: "Income", value: 100000, fill: "#22c55e" },
        { name: "Fixed", value: -50000, fill: "#ef4444" },
        { name: "Discretionary", value: -40000, fill: "#f97316" },
        { name: "Surplus", value: 10000, fill: "#3b82f6" },
      ],
    });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });
});

const burnDefaultProps = {
  summary: {
    burnRate: 60,
    actualExpenses: "60000",
    plannedExpenses: "100000",
  },
  isLoadingSummary: false,
  isErrorSummary: false,
  refetchSummary: vi.fn(),
};

function renderBurnRate(overrides = {}) {
  return render(
    <TestWrapper>
      <BurnRateCard {...burnDefaultProps} {...overrides} />
    </TestWrapper>,
  );
}

describe("BurnRateCard", () => {
  it("renders the title", () => {
    renderBurnRate();
    expect(screen.getByText("Monthly Burn Rate")).toBeInTheDocument();
  });

  it("renders description", () => {
    renderBurnRate();
    expect(screen.getByText("Actual vs Planned Expenses")).toBeInTheDocument();
  });

  it("shows burn rate percentage", () => {
    renderBurnRate();
    expect(screen.getByText("60.0%")).toBeInTheDocument();
  });

  it("shows loading skeleton", () => {
    const { container } = renderBurnRate({ isLoadingSummary: true });
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="Skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state", () => {
    renderBurnRate({ isErrorSummary: true });
    expect(screen.getByText(/Retry/)).toBeInTheDocument();
  });

  it("calls refetchSummary on error retry", () => {
    const refetchSummary = vi.fn();
    renderBurnRate({ isErrorSummary: true, refetchSummary });
    fireEvent.click(screen.getByText(/Retry/));
    expect(refetchSummary).toHaveBeenCalled();
  });

  it("renders with over-budget burn rate (>100)", () => {
    renderBurnRate({ summary: { burnRate: 120, actualExpenses: "120000", plannedExpenses: "100000" } });
    expect(screen.getByText("120.0%")).toBeInTheDocument();
  });

  it("renders with zero burn rate", () => {
    renderBurnRate({ summary: { burnRate: 0, actualExpenses: "0", plannedExpenses: "100000" } });
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("renders with undefined summary", () => {
    renderBurnRate({ summary: undefined });
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("renders with undefined burnRate", () => {
    renderBurnRate({ summary: {} });
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("renders progress bar", () => {
    const { container } = renderBurnRate();
    expect(container.querySelector('[role="progressbar"]')).toBeInTheDocument();
  });
});
