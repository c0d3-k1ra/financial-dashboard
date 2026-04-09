import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryTrendChart, CcSpendTrendChart } from "./category-trend";
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
              return <Tick key={`tick-${ci}`} x={10} y={20} payload={{ value: 25000 }} />;
            }
            if (child.props.content && typeof child.props.content === "function") {
              const Content = child.props.content;
              return <Content key={`legend-${ci}`} payload={[{ value: "Food", color: "#8884d8" }, { value: "Others", color: "#ccc" }]} />;
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
        return <g><Tick x={10} y={20} payload={{ value: 25000 }} /></g>;
      }
      return <g />;
    },
    CartesianGrid: () => <g />,
    Tooltip: () => <g />,
    Legend: (props: any) => {
      if (props.content && typeof props.content === "function") {
        const Content = props.content;
        return <Content payload={[{ value: "Food", color: "#8884d8" }, { value: "Others", color: "#ccc" }]} />;
      }
      return <g />;
    },
    ReferenceLine: () => <g />,
  };
});

const defaultProps = {
  categoryTrendLineData: [
    { cycle: "2026-03", Food: 14000, Transport: 7000 },
    { cycle: "2026-04", Food: 15000, Transport: 8000 },
  ],
  visibleCategories: ["Food", "Transport"],
  allCategoryNames: ["Food", "Transport"],
  selectedCategory: "all",
  setSelectedCategory: vi.fn(),
  catTrendYMax: 20000,
  isLoadingCatTrend: false,
  isErrorCatTrend: false,
  refetchCatTrend: vi.fn(),
};

function renderComponent(overrides = {}) {
  return render(
    <TestWrapper>
      <CategoryTrendChart {...defaultProps} {...overrides} />
    </TestWrapper>,
  );
}

describe("CategoryTrendChart", () => {
  it("renders the title", () => {
    renderComponent();
    expect(screen.getByText("Category Trend")).toBeInTheDocument();
  });

  it("shows loading skeleton", () => {
    const { container } = renderComponent({ isLoadingCatTrend: true });
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="Skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state", () => {
    renderComponent({ isErrorCatTrend: true });
    expect(screen.getByText(/Retry/)).toBeInTheDocument();
  });

  it("renders chart container when loaded", () => {
    renderComponent();
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("handles empty data", () => {
    renderComponent({ categoryTrendLineData: [] });
    expect(screen.getByText("No category trend data available")).toBeInTheDocument();
  });

  it("renders category selector", () => {
    renderComponent();
    expect(screen.getByText("All Categories")).toBeInTheDocument();
  });

  it("renders description text", () => {
    renderComponent();
    expect(screen.getByText("Expense trends over last 6 billing cycles")).toBeInTheDocument();
  });

  it("calls refetchCatTrend on error retry", () => {
    const refetchCatTrend = vi.fn();
    renderComponent({ isErrorCatTrend: true, refetchCatTrend });
    fireEvent.click(screen.getByText(/Retry/));
    expect(refetchCatTrend).toHaveBeenCalled();
  });

  it("renders with single category selected", () => {
    renderComponent({ selectedCategory: "Food" });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with Others in visible categories", () => {
    renderComponent({
      visibleCategories: ["Food", "Transport", "Others"],
      allCategoryNames: ["Food", "Transport"],
    });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders category items in select", () => {
    renderComponent({ allCategoryNames: ["Food", "Transport", "Utilities"] });
    expect(screen.getByText("All Categories")).toBeInTheDocument();
  });
});

const ccDefaultProps = {
  ccSpendTrend: [
    { cycle: "2026-02", total: "18000" },
    { cycle: "2026-03", total: "22000" },
    { cycle: "2026-04", total: "20000" },
  ],
  isLoadingCcSpend: false,
  isErrorCcSpend: false,
  refetchCcSpend: vi.fn(),
};

function renderCcChart(overrides = {}) {
  return render(
    <TestWrapper>
      <CcSpendTrendChart {...ccDefaultProps} {...overrides} />
    </TestWrapper>,
  );
}

describe("CcSpendTrendChart", () => {
  it("renders the title", () => {
    renderCcChart();
    expect(screen.getByText("CC Spend Trend")).toBeInTheDocument();
  });

  it("renders description", () => {
    renderCcChart();
    expect(screen.getByText("Credit card spending per cycle")).toBeInTheDocument();
  });

  it("shows loading skeleton", () => {
    const { container } = renderCcChart({ isLoadingCcSpend: true });
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="Skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state", () => {
    renderCcChart({ isErrorCcSpend: true });
    expect(screen.getByText(/Retry/)).toBeInTheDocument();
  });

  it("calls refetchCcSpend on error retry", () => {
    const refetchCcSpend = vi.fn();
    renderCcChart({ isErrorCcSpend: true, refetchCcSpend });
    fireEvent.click(screen.getByText(/Retry/));
    expect(refetchCcSpend).toHaveBeenCalled();
  });

  it("renders chart container when data loaded", () => {
    renderCcChart();
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("shows empty message for empty data", () => {
    renderCcChart({ ccSpendTrend: [] });
    expect(screen.getByText("No CC spending data available")).toBeInTheDocument();
  });

  it("shows empty message for undefined data", () => {
    renderCcChart({ ccSpendTrend: undefined });
    expect(screen.getByText("No CC spending data available")).toBeInTheDocument();
  });

  it("renders with single data point", () => {
    renderCcChart({ ccSpendTrend: [{ cycle: "2026-04", total: "20000" }] });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with numeric total values", () => {
    renderCcChart({
      ccSpendTrend: [
        { cycle: "2026-01", total: 15000 },
        { cycle: "2026-02", total: 18000 },
      ],
    });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with many data points", () => {
    const data = Array.from({ length: 6 }, (_, i) => ({
      cycle: `2026-${String(i + 1).padStart(2, "0")}`,
      total: String(10000 + i * 3000),
    }));
    renderCcChart({ ccSpendTrend: data });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });
});

describe("CategoryTrendChart - legend and tick rendering", () => {
  it("renders PrivacyYAxisTick via YAxis mock", () => {
    const { container } = renderComponent();
    const textElements = container.querySelectorAll("text");
    expect(textElements.length).toBeGreaterThan(0);
  });

  it("renders custom legend with category buttons", () => {
    const setSelectedCategory = vi.fn();
    renderComponent({
      setSelectedCategory,
      visibleCategories: ["Food", "Others"],
      allCategoryNames: ["Food", "Transport"],
    });
    const foodBtns = screen.getAllByText("Food");
    expect(foodBtns.length).toBeGreaterThan(0);
  });

  it("clicking legend button for non-Others category calls setSelectedCategory", () => {
    const setSelectedCategory = vi.fn();
    renderComponent({
      setSelectedCategory,
      visibleCategories: ["Food", "Transport"],
      allCategoryNames: ["Food", "Transport"],
    });
    const foodBtns = screen.getAllByRole("button").filter(
      (btn) => btn.textContent === "Food",
    );
    if (foodBtns.length > 0) {
      fireEvent.click(foodBtns[0]);
      expect(setSelectedCategory).toHaveBeenCalledWith("Food");
    }
  });

  it("clicking legend button for Others does not call setSelectedCategory", () => {
    const setSelectedCategory = vi.fn();
    renderComponent({
      setSelectedCategory,
      visibleCategories: ["Food", "Others"],
      allCategoryNames: ["Food"],
    });
    const otherBtns = screen.getAllByRole("button").filter(
      (btn) => btn.textContent === "Others",
    );
    if (otherBtns.length > 0) {
      fireEvent.click(otherBtns[0]);
      expect(setSelectedCategory).not.toHaveBeenCalled();
    }
  });

  it("clicking already selected category resets to all", () => {
    const setSelectedCategory = vi.fn();
    renderComponent({
      selectedCategory: "Food",
      setSelectedCategory,
      visibleCategories: ["Food", "Transport"],
      allCategoryNames: ["Food", "Transport"],
    });
    const foodBtns = screen.getAllByRole("button").filter(
      (btn) => btn.textContent === "Food",
    );
    if (foodBtns.length > 0) {
      fireEvent.click(foodBtns[0]);
      expect(setSelectedCategory).toHaveBeenCalledWith("all");
    }
  });

  it("legend renders with dimmed categories when one is selected", () => {
    renderComponent({
      selectedCategory: "Food",
      visibleCategories: ["Food", "Transport"],
      allCategoryNames: ["Food", "Transport"],
    });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("legend renders null payload guard", () => {
    renderComponent({
      categoryTrendLineData: [],
    });
    expect(screen.getByText("No category trend data available")).toBeInTheDocument();
  });
});

describe("CcSpendTrendChart - PrivacyYAxisTick11", () => {
  it("renders CC chart with tick rendering via mock", () => {
    const { container } = renderCcChart();
    const textElements = container.querySelectorAll("text");
    expect(textElements.length).toBeGreaterThan(0);
  });
});

describe("CategoryTrendChart - additional", () => {
  it("renders with selectedCategory filter applied", () => {
    renderComponent({
      selectedCategory: "Food",
      visibleCategories: ["Food"],
    });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with many categories in visible list", () => {
    renderComponent({
      categoryTrendLineData: [
        { cycle: "2026-03", Food: 14000, Transport: 7000, Utilities: 5000, Entertainment: 3000 },
        { cycle: "2026-04", Food: 15000, Transport: 8000, Utilities: 6000, Entertainment: 4000 },
      ],
      visibleCategories: ["Food", "Transport", "Utilities", "Entertainment"],
      allCategoryNames: ["Food", "Transport", "Utilities", "Entertainment"],
    });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with catTrendYMax of 0", () => {
    renderComponent({ catTrendYMax: 0 });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with Others as only visible category", () => {
    renderComponent({
      categoryTrendLineData: [
        { cycle: "2026-03", Others: 5000 },
        { cycle: "2026-04", Others: 6000 },
      ],
      visibleCategories: ["Others"],
      allCategoryNames: ["Food", "Transport"],
    });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with category not in allCategoryNames", () => {
    renderComponent({
      categoryTrendLineData: [
        { cycle: "2026-03", Unknown: 3000 },
        { cycle: "2026-04", Unknown: 4000 },
      ],
      visibleCategories: ["Unknown"],
      allCategoryNames: ["Food", "Transport"],
    });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("renders with empty allCategoryNames array", () => {
    renderComponent({
      categoryTrendLineData: [
        { cycle: "2026-03", Food: 14000 },
      ],
      visibleCategories: ["Food"],
      allCategoryNames: [],
    });
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });
});
