import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IncomeExpenseTrend } from "./income-expense-trend";
import { TestWrapper } from "@/test/test-wrapper";

vi.mock("recharts", async () => {
  const React = await import("react");
  return {
    ResponsiveContainer: ({ children }: any) => (
      <div data-testid="chart-container" style={{ width: 800, height: 400 }}>
        {typeof children === "function" ? children(800, 400) : children}
      </div>
    ),
    AreaChart: ({ children, data }: any) => {
      const childArr = React.Children.toArray(children);
      return (
        <svg data-testid="area-chart">
          {childArr.map((child: any, ci: number) => {
            if (!child?.props) return null;
            if (child.props.tick && typeof child.props.tick === "function") {
              const Tick = child.props.tick;
              return <Tick key={`tick-${ci}`} x={10} y={20} payload={{ value: 50000 }} />;
            }
            if (typeof child.props.tick === "object" && child.props.tick !== null && !React.isValidElement(child.props.tick)) {
              return null;
            }
            if (child.props.dot && typeof child.props.dot === "function") {
              return (
                <g key={`dots-${ci}`}>
                  {data?.map((d: any, i: number) =>
                    child.props.dot({ cx: 100 + i * 50, cy: 200, index: i, payload: d })
                  )}
                </g>
              );
            }
            if (child.props.content && typeof child.props.content === "function") {
              const Content = child.props.content;
              return <Content key={`content-${ci}`} payload={[{ value: "Income", color: "green" }, { value: "Expenses", color: "red" }]} />;
            }
            return <g key={`child-${ci}`} />;
          })}
        </svg>
      );
    },
    Area: (props: any) => <g data-testid={`area-${props.dataKey}`} />,
    XAxis: () => <g />,
    YAxis: (props: any) => {
      if (props.tick && typeof props.tick === "function") {
        const Tick = props.tick;
        return <g><Tick x={10} y={20} payload={{ value: 50000 }} /></g>;
      }
      return <g />;
    },
    CartesianGrid: () => <g />,
    Tooltip: () => <g />,
    Legend: (props: any) => {
      if (props.content && typeof props.content === "function") {
        const Content = props.content;
        return <Content payload={[{ value: "Income", color: "green" }, { value: "Expenses", color: "red" }]} />;
      }
      return <g />;
    },
    ReferenceLine: () => <g data-testid="reference-line" />,
  };
});

const defaultProps = {
  monthlyTrend: [
    { month: "2026-01", income: "100000", expenses: "80000" },
    { month: "2026-02", income: "100000", expenses: "75000" },
    { month: "2026-03", income: "100000", expenses: "90000" },
  ],
  crossoverMonths: [],
  incExpYMax: 120000,
  isLoadingTrend: false,
  isErrorTrend: false,
  refetchTrend: vi.fn(),
};

function renderComponent(overrides = {}) {
  return render(
    <TestWrapper>
      <IncomeExpenseTrend {...defaultProps} {...overrides} />
    </TestWrapper>,
  );
}

describe("IncomeExpenseTrend", () => {
  it("renders the title", () => {
    renderComponent();
    expect(screen.getByText("Income vs Expenses Trend")).toBeInTheDocument();
  });

  it("shows loading skeleton", () => {
    const { container } = renderComponent({ isLoadingTrend: true });
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="Skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state", () => {
    renderComponent({ isErrorTrend: true });
    expect(screen.getByText(/Retry/)).toBeInTheDocument();
  });

  it("renders chart container when data is loaded", () => {
    renderComponent();
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("handles empty trend data", () => {
    renderComponent({ monthlyTrend: [] });
    expect(screen.getByText(/No trend data available/)).toBeInTheDocument();
  });

  it("handles undefined trend data", () => {
    renderComponent({ monthlyTrend: undefined });
    expect(screen.getByText(/No trend data available/)).toBeInTheDocument();
  });

  it("renders with crossover months", () => {
    renderComponent({ crossoverMonths: ["2026-03"] });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders chart description text", () => {
    renderComponent();
    expect(screen.getByText(/Last 6 billing cycles/)).toBeInTheDocument();
  });

  it("calls refetchTrend on error retry", () => {
    const refetchTrend = vi.fn();
    renderComponent({ isErrorTrend: true, refetchTrend });
    fireEvent.click(screen.getByText(/Retry/));
    expect(refetchTrend).toHaveBeenCalled();
  });

  it("renders with single data point", () => {
    renderComponent({
      monthlyTrend: [{ month: "2026-01", income: "100000", expenses: "80000" }],
    });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with multiple crossover months", () => {
    renderComponent({ crossoverMonths: ["2026-01", "2026-02", "2026-03"] });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with expenses exceeding income data", () => {
    renderComponent({
      monthlyTrend: [
        { month: "2026-01", income: "50000", expenses: "80000" },
        { month: "2026-02", income: "60000", expenses: "90000" },
      ],
      crossoverMonths: ["2026-01", "2026-02"],
    });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with zero incExpYMax", () => {
    renderComponent({ incExpYMax: 0 });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders chart with numeric income/expenses values", () => {
    renderComponent({
      monthlyTrend: [
        { month: "2026-01", income: 100000, expenses: 80000 },
        { month: "2026-02", income: 110000, expenses: 90000 },
      ],
    });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with expenses exceeding income in all months", () => {
    renderComponent({
      monthlyTrend: [
        { month: "2026-01", income: 50000, expenses: 80000 },
        { month: "2026-02", income: 40000, expenses: 90000 },
        { month: "2026-03", income: 30000, expenses: 100000 },
      ],
      crossoverMonths: ["2026-01", "2026-02", "2026-03"],
    });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with large dataset", () => {
    const monthlyTrend = Array.from({ length: 12 }, (_, i) => ({
      month: `2026-${String(i + 1).padStart(2, "0")}`,
      income: String(100000 + i * 5000),
      expenses: String(60000 + i * 3000),
    }));
    renderComponent({ monthlyTrend, incExpYMax: 160000 });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with very high incExpYMax value", () => {
    renderComponent({ incExpYMax: 10000000 });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with mixed string and number income/expense values", () => {
    renderComponent({
      monthlyTrend: [
        { month: "2026-01", income: "100000", expenses: 80000 },
        { month: "2026-02", income: 110000, expenses: "90000" },
      ],
    });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });
});

describe("IncomeExpenseTrend - dot render functions", () => {
  it("renders income dots via custom mock that invokes dot callback", () => {
    const { container } = renderComponent();
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBeGreaterThan(0);
  });

  it("renders expense dots with isOver=true branch (expenses > income)", () => {
    const { container } = renderComponent({
      monthlyTrend: [
        { month: "2026-01", income: 50000, expenses: 80000 },
        { month: "2026-02", income: 60000, expenses: 40000 },
      ],
      crossoverMonths: ["2026-01"],
    });
    const groups = container.querySelectorAll("g");
    expect(groups.length).toBeGreaterThan(0);
  });

  it("renders expense dots with isOver=false branch (income > expenses)", () => {
    const { container } = renderComponent({
      monthlyTrend: [
        { month: "2026-01", income: 100000, expenses: 50000 },
        { month: "2026-02", income: 120000, expenses: 60000 },
      ],
    });
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBeGreaterThan(0);
  });
});

describe("IncomeExpenseTrend - PrivacyYAxisTick", () => {
  it("renders PrivacyYAxisTick via YAxis mock", () => {
    const { container } = renderComponent();
    const textElements = container.querySelectorAll("text");
    expect(textElements.length).toBeGreaterThan(0);
  });
});
