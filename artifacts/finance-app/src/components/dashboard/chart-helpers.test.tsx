import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  GoalProgressRing,
  WaterfallConnectors,
  formatDateGroup,
  niceYAxisTicks,
  formatAxisValue,
  computeCategoryTrendData,
  DashboardModal,
} from "./chart-helpers";
import { TestWrapper } from "@/test/test-wrapper";

describe("GoalProgressRing", () => {
  it("renders progress percentage", () => {
    render(
      <TestWrapper>
        <GoalProgressRing goals={[{ targetAmount: "100000", currentAmount: "50000" }]} />
      </TestWrapper>,
    );
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("GOALS")).toBeInTheDocument();
  });

  it("handles zero target", () => {
    render(
      <TestWrapper>
        <GoalProgressRing goals={[{ targetAmount: "0", currentAmount: "0" }]} />
      </TestWrapper>,
    );
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("caps at 100%", () => {
    render(
      <TestWrapper>
        <GoalProgressRing goals={[{ targetAmount: "100", currentAmount: "200" }]} />
      </TestWrapper>,
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});

describe("WaterfallConnectors", () => {
  it("renders nothing with no items", () => {
    const { container } = render(<WaterfallConnectors />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing with empty formatted items", () => {
    const { container } = render(<WaterfallConnectors formattedGraphicalItems={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders connector lines between bars", () => {
    const mockBars = [
      { x: 10, y: 50, width: 40, height: 100 },
      { x: 60, y: 30, width: 40, height: 120 },
      { x: 110, y: 40, width: 40, height: 110 },
    ];
    const { container } = render(
      <svg>
        <WaterfallConnectors formattedGraphicalItems={[{ props: { data: mockBars } }]} />
      </svg>,
    );
    const lines = container.querySelectorAll("line");
    expect(lines.length).toBe(2);
  });
});

describe("formatDateGroup", () => {
  it("returns 'Today' for today's date", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(formatDateGroup(today)).toBe("Today");
  });

  it("returns 'Yesterday' for yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatDateGroup(yesterday.toISOString().split("T")[0])).toBe("Yesterday");
  });

  it("returns formatted date for older dates", () => {
    expect(formatDateGroup("2025-01-15")).toMatch(/Jan 15, 2025/);
  });
});

describe("niceYAxisTicks", () => {
  it("returns [0] for zero max", () => {
    expect(niceYAxisTicks(0)).toEqual([0]);
  });

  it("returns reasonable ticks", () => {
    const ticks = niceYAxisTicks(100000);
    expect(ticks[0]).toBe(0);
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(100000);
  });

  it("works for small values", () => {
    const ticks = niceYAxisTicks(50);
    expect(ticks.length).toBeGreaterThan(1);
  });
});

describe("formatAxisValue", () => {
  it("formats lakhs", () => {
    expect(formatAxisValue(100000)).toBe("₹1L");
    expect(formatAxisValue(250000)).toBe("₹2.5L");
  });

  it("formats thousands", () => {
    expect(formatAxisValue(5000)).toBe("₹5k");
    expect(formatAxisValue(1500)).toBe("₹1.5k");
  });

  it("formats small values", () => {
    expect(formatAxisValue(500)).toBe("₹500");
  });
});

describe("computeCategoryTrendData", () => {
  const trendData = [
    { category: "Food", data: [{ cycle: "2026-03", total: "14000" }, { cycle: "2026-04", total: "15000" }] },
    { category: "Transport", data: [{ cycle: "2026-03", total: "7000" }, { cycle: "2026-04", total: "8000" }] },
    { category: "Utilities", data: [{ cycle: "2026-03", total: "5000" }, { cycle: "2026-04", total: "4000" }] },
    { category: "Personal", data: [{ cycle: "2026-03", total: "3000" }, { cycle: "2026-04", total: "3500" }] },
    { category: "Medical", data: [{ cycle: "2026-03", total: "1000" }, { cycle: "2026-04", total: "1500" }] },
    { category: "Gifts", data: [{ cycle: "2026-03", total: "500" }, { cycle: "2026-04", total: "800" }] },
  ];

  it("returns empty for undefined data", () => {
    const result = computeCategoryTrendData(undefined, "all");
    expect(result.top5Categories).toEqual([]);
    expect(result.categoryTrendLineData).toEqual([]);
  });

  it("groups top 5 and Others when selecting all", () => {
    const result = computeCategoryTrendData(trendData, "all");
    expect(result.top5Categories.length).toBe(6);
    expect(result.top5Categories).toContain("Others");
  });

  it("filters to single category when selected", () => {
    const result = computeCategoryTrendData(trendData, "Food");
    expect(result.top5Categories).toEqual(["Food"]);
    expect(result.categoryTrendLineData.length).toBe(2);
  });
});

describe("DashboardModal", () => {
  it("renders dialog on desktop", () => {
    render(
      <TestWrapper>
        <DashboardModal open={true} onOpenChange={() => {}} title="Test" isMobile={false}>
          <div>Content</div>
        </DashboardModal>
      </TestWrapper>,
    );
    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders sheet on mobile", () => {
    render(
      <TestWrapper>
        <DashboardModal open={true} onOpenChange={() => {}} title="Mobile Title" isMobile={true}>
          <div>Mobile Content</div>
        </DashboardModal>
      </TestWrapper>,
    );
    expect(screen.getByText("Mobile Title")).toBeInTheDocument();
    expect(screen.getByText("Mobile Content")).toBeInTheDocument();
  });
});
