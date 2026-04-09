import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileFilterBar } from "./mobile-filter-bar";

function createProps(overrides = {}) {
  return {
    search: "",
    setSearch: vi.fn(),
    filterCategory: "all",
    setFilterCategory: vi.fn(),
    filterType: "all",
    setFilterType: vi.fn(),
    filterAccount: "all",
    setFilterAccount: vi.fn(),
    dateRange: "all",
    setDateRange: vi.fn(),
    customFrom: undefined as Date | undefined,
    setCustomFrom: vi.fn(),
    customTo: undefined as Date | undefined,
    setCustomTo: vi.fn(),
    amountMin: "",
    setAmountMin: vi.fn(),
    amountMax: "",
    setAmountMax: vi.fn(),
    sortField: "date",
    setSortField: vi.fn(),
    sortDir: "desc" as "asc" | "desc",
    setSortDir: vi.fn(),
    showAdjustments: false,
    setShowAdjustments: vi.fn(),
    activeFilterCount: 0,
    clearAllFilters: vi.fn(),
    categories: [
      { id: 1, name: "Food" },
      { id: 2, name: "Transport" },
    ],
    accounts: [
      { id: 1, name: "HDFC" },
      { id: 2, name: "SBI" },
    ],
    ...overrides,
  };
}

describe("MobileFilterBar", () => {
  it("renders search input", () => {
    render(<MobileFilterBar {...createProps()} />);
    expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
  });

  it("calls setSearch on input", async () => {
    const setSearch = vi.fn();
    const user = userEvent.setup();
    render(<MobileFilterBar {...createProps({ setSearch })} />);
    await user.type(screen.getByPlaceholderText(/Search/i), "test");
    expect(setSearch).toHaveBeenCalled();
  });

  it("renders Filters button", () => {
    render(<MobileFilterBar {...createProps()} />);
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("shows Clear button when activeFilterCount > 0", () => {
    render(<MobileFilterBar {...createProps({ activeFilterCount: 2 })} />);
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("hides Clear button when activeFilterCount is 0", () => {
    render(<MobileFilterBar {...createProps({ activeFilterCount: 0 })} />);
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
  });

  it("calls clearAllFilters when Clear button clicked", async () => {
    const clearAllFilters = vi.fn();
    const user = userEvent.setup();
    render(<MobileFilterBar {...createProps({ activeFilterCount: 1, clearAllFilters })} />);
    await user.click(screen.getByText("Clear"));
    expect(clearAllFilters).toHaveBeenCalled();
  });

  it("shows mobile filter count badge when filters are active", () => {
    render(
      <MobileFilterBar
        {...createProps({ filterCategory: "Food", filterType: "Expense", amountMin: "100" })}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does not show mobile filter count badge when no filters set", () => {
    render(<MobileFilterBar {...createProps()} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("opens filter sheet when Filters button clicked", async () => {
    const user = userEvent.setup();
    render(<MobileFilterBar {...createProps()} />);
    await user.click(screen.getByText("Filters"));
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Time Period")).toBeInTheDocument();
    expect(screen.getByText("Amount Range")).toBeInTheDocument();
    expect(screen.getByText("Sort By")).toBeInTheDocument();
  });

  it("renders Show Balance Adjustments toggle inside sheet", async () => {
    const user = userEvent.setup();
    render(<MobileFilterBar {...createProps({ showAdjustments: false })} />);
    await user.click(screen.getByText("Filters"));
    expect(screen.getByText(/Show Balance Adjustments/i)).toBeInTheDocument();
  });

  it("renders Hide Balance Adjustments toggle when showAdjustments is true", async () => {
    const user = userEvent.setup();
    render(<MobileFilterBar {...createProps({ showAdjustments: true })} />);
    await user.click(screen.getByText("Filters"));
    expect(screen.getByText(/Hide Balance Adjustments/i)).toBeInTheDocument();
  });

  it("toggles adjustments when button clicked in sheet", async () => {
    const setShowAdjustments = vi.fn();
    const user = userEvent.setup();
    render(<MobileFilterBar {...createProps({ showAdjustments: false, setShowAdjustments })} />);
    await user.click(screen.getByText("Filters"));
    await user.click(screen.getByText(/Show Balance Adjustments/i));
    expect(setShowAdjustments).toHaveBeenCalledWith(true);
  });

  it("renders amount inputs inside sheet", async () => {
    const user = userEvent.setup();
    render(<MobileFilterBar {...createProps()} />);
    await user.click(screen.getByText("Filters"));
    expect(screen.getByPlaceholderText("Min ₹")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Max ₹")).toBeInTheDocument();
  });

  it("calls setAmountMin when min amount changes", async () => {
    const setAmountMin = vi.fn();
    const user = userEvent.setup();
    render(<MobileFilterBar {...createProps({ setAmountMin })} />);
    await user.click(screen.getByText("Filters"));
    await user.type(screen.getByPlaceholderText("Min ₹"), "100");
    expect(setAmountMin).toHaveBeenCalled();
  });

  it("calls setAmountMax when max amount changes", async () => {
    const setAmountMax = vi.fn();
    const user = userEvent.setup();
    render(<MobileFilterBar {...createProps({ setAmountMax })} />);
    await user.click(screen.getByText("Filters"));
    await user.type(screen.getByPlaceholderText("Max ₹"), "5000");
    expect(setAmountMax).toHaveBeenCalled();
  });

  it("shows Clear All inside sheet when filters active", async () => {
    const user = userEvent.setup();
    render(
      <MobileFilterBar
        {...createProps({ filterCategory: "Food" })}
      />,
    );
    await user.click(screen.getByText("Filters"));
    expect(screen.getByText("Clear All")).toBeInTheDocument();
  });

  it("hides Clear All inside sheet when no filters active", async () => {
    const user = userEvent.setup();
    render(<MobileFilterBar {...createProps()} />);
    await user.click(screen.getByText("Filters"));
    expect(screen.queryByText("Clear All")).not.toBeInTheDocument();
  });

  it("computes mobile filter count correctly with dateRange filter", () => {
    render(<MobileFilterBar {...createProps({ dateRange: "3" })} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("computes mobile filter count correctly with amountMax", () => {
    render(<MobileFilterBar {...createProps({ amountMax: "5000" })} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders with undefined categories and accounts", () => {
    render(<MobileFilterBar {...createProps({ categories: undefined, accounts: undefined })} />);
    expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
  });

  it("renders existing search value", () => {
    render(<MobileFilterBar {...createProps({ search: "test" })} />);
    expect(screen.getByPlaceholderText(/Search/i)).toHaveValue("test");
  });

  it("shows custom date pickers when dateRange is custom inside sheet", async () => {
    const user = userEvent.setup();
    render(<MobileFilterBar {...createProps({ dateRange: "custom" })} />);
    await user.click(screen.getByText("Filters"));
    expect(screen.getByText("to")).toBeInTheDocument();
  });

  it("does not show custom date pickers when dateRange is not custom", async () => {
    const user = userEvent.setup();
    render(<MobileFilterBar {...createProps({ dateRange: "3" })} />);
    await user.click(screen.getByText("Filters"));
    expect(screen.queryByText("to")).not.toBeInTheDocument();
  });
});
