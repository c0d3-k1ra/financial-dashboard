import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DesktopFilterBar } from "./desktop-filter-bar";

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = vi.fn();
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = vi.fn();
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

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
    setCurrentPage: vi.fn(),
    setExpandedAdjustmentDates: vi.fn(),
    ...overrides,
  };
}

describe("DesktopFilterBar", () => {
  it("renders search input", () => {
    render(<DesktopFilterBar {...createProps()} />);
    expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
  });

  it("calls setSearch on input", async () => {
    const setSearch = vi.fn();
    const user = userEvent.setup();
    render(<DesktopFilterBar {...createProps({ setSearch })} />);
    await user.type(screen.getByPlaceholderText(/Search/i), "test");
    expect(setSearch).toHaveBeenCalled();
  });

  it("renders adjustments toggle with Show text when hidden", () => {
    render(<DesktopFilterBar {...createProps({ showAdjustments: false })} />);
    expect(screen.getByText(/Show Adjustments/i)).toBeInTheDocument();
  });

  it("renders adjustments toggle with Hide text when shown", () => {
    render(<DesktopFilterBar {...createProps({ showAdjustments: true })} />);
    expect(screen.getByText(/Hide Adjustments/i)).toBeInTheDocument();
  });

  it("toggles adjustments and resets page on click", async () => {
    const setShowAdjustments = vi.fn();
    const setCurrentPage = vi.fn();
    const setExpandedAdjustmentDates = vi.fn();
    const user = userEvent.setup();
    render(
      <DesktopFilterBar
        {...createProps({ showAdjustments: true, setShowAdjustments, setCurrentPage, setExpandedAdjustmentDates })}
      />,
    );
    await user.click(screen.getByText(/Hide Adjustments/i));
    expect(setShowAdjustments).toHaveBeenCalledWith(false);
    expect(setCurrentPage).toHaveBeenCalledWith(1);
    expect(setExpandedAdjustmentDates).toHaveBeenCalled();
  });

  it("does not clear expandedAdjustmentDates when turning adjustments on", async () => {
    const setExpandedAdjustmentDates = vi.fn();
    const user = userEvent.setup();
    render(
      <DesktopFilterBar
        {...createProps({ showAdjustments: false, setExpandedAdjustmentDates })}
      />,
    );
    await user.click(screen.getByText(/Show Adjustments/i));
    expect(setExpandedAdjustmentDates).not.toHaveBeenCalled();
  });

  it("shows filter count when filters are active", () => {
    render(<DesktopFilterBar {...createProps({ activeFilterCount: 3 })} />);
    expect(screen.getByText(/Filters \(3\)/)).toBeInTheDocument();
  });

  it("hides filter count when no filters active", () => {
    render(<DesktopFilterBar {...createProps({ activeFilterCount: 0 })} />);
    expect(screen.queryByText(/Filters/)).not.toBeInTheDocument();
  });

  it("shows and calls clearAllFilters when clear button is clicked", async () => {
    const clearAllFilters = vi.fn();
    const user = userEvent.setup();
    render(<DesktopFilterBar {...createProps({ activeFilterCount: 2, clearAllFilters })} />);
    await user.click(screen.getByText(/Clear All/i));
    expect(clearAllFilters).toHaveBeenCalled();
  });

  it("calls setAmountMin and resets page when min amount changes", async () => {
    const setAmountMin = vi.fn();
    const setCurrentPage = vi.fn();
    const user = userEvent.setup();
    render(<DesktopFilterBar {...createProps({ setAmountMin, setCurrentPage })} />);
    await user.type(screen.getByPlaceholderText("Min ₹"), "100");
    expect(setAmountMin).toHaveBeenCalled();
    expect(setCurrentPage).toHaveBeenCalledWith(1);
  });

  it("calls setAmountMax and resets page when max amount changes", async () => {
    const setAmountMax = vi.fn();
    const setCurrentPage = vi.fn();
    const user = userEvent.setup();
    render(<DesktopFilterBar {...createProps({ setAmountMax, setCurrentPage })} />);
    await user.type(screen.getByPlaceholderText("Max ₹"), "5000");
    expect(setAmountMax).toHaveBeenCalled();
    expect(setCurrentPage).toHaveBeenCalledWith(1);
  });

  it("shows custom date range pickers when dateRange is custom", () => {
    render(<DesktopFilterBar {...createProps({ dateRange: "custom" })} />);
    expect(screen.getByText("to")).toBeInTheDocument();
  });

  it("does not show custom date range pickers when dateRange is not custom", () => {
    render(<DesktopFilterBar {...createProps({ dateRange: "3" })} />);
    expect(screen.queryByText("to")).not.toBeInTheDocument();
  });

  it("renders with undefined categories and accounts", () => {
    render(<DesktopFilterBar {...createProps({ categories: undefined, accounts: undefined })} />);
    expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
  });

  it("renders existing search value", () => {
    render(<DesktopFilterBar {...createProps({ search: "test search" })} />);
    expect(screen.getByPlaceholderText(/Search/i)).toHaveValue("test search");
  });

  it("renders existing amount values", () => {
    render(<DesktopFilterBar {...createProps({ amountMin: "100", amountMax: "5000" })} />);
    expect(screen.getByPlaceholderText("Min ₹")).toHaveValue(100);
    expect(screen.getByPlaceholderText("Max ₹")).toHaveValue(5000);
  });

  it("renders category select trigger", () => {
    render(<DesktopFilterBar {...createProps()} />);
    const triggers = screen.getAllByRole("combobox");
    expect(triggers.length).toBeGreaterThanOrEqual(4);
  });

  it("renders custom date range fields with From/To placeholders", () => {
    render(<DesktopFilterBar {...createProps({ dateRange: "custom" })} />);
    expect(screen.getByText("to")).toBeInTheDocument();
  });

  it("renders all four select triggers", () => {
    render(<DesktopFilterBar {...createProps()} />);
    const triggers = screen.getAllByRole("combobox");
    expect(triggers.length).toBeGreaterThanOrEqual(4);
  });

  it("renders with selected category filter", () => {
    render(<DesktopFilterBar {...createProps({ filterCategory: "Food" })} />);
    expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
  });

  it("renders with selected type filter", () => {
    render(<DesktopFilterBar {...createProps({ filterType: "Expense" })} />);
    expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
  });

  it("renders with selected account filter", () => {
    render(<DesktopFilterBar {...createProps({ filterAccount: "1" })} />);
    expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
  });

  it("opens category select and shows categories", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<DesktopFilterBar {...createProps()} />);
    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[0]);
    await waitFor(() => {
      expect(screen.getAllByText("All Categories").length).toBeGreaterThan(0);
    });
  });

  it("opens type select and shows type options", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<DesktopFilterBar {...createProps()} />);
    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[1]);
    await waitFor(() => {
      expect(screen.getAllByText("All Types").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Expense").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Income").length).toBeGreaterThan(0);
    });
  });

  it("opens account select and shows accounts", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<DesktopFilterBar {...createProps()} />);
    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[2]);
    await waitFor(() => {
      expect(screen.getAllByText("All Accounts").length).toBeGreaterThan(0);
    });
  });

  it("calls setFilterCategory when category is selected", async () => {
    const setFilterCategory = vi.fn();
    const setCurrentPage = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<DesktopFilterBar {...createProps({ setFilterCategory, setCurrentPage })} />);
    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[0]);
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Food"));
    expect(setFilterCategory).toHaveBeenCalledWith("Food");
    expect(setCurrentPage).toHaveBeenCalledWith(1);
  });

  it("calls setFilterType when type is selected", async () => {
    const setFilterType = vi.fn();
    const setCurrentPage = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<DesktopFilterBar {...createProps({ setFilterType, setCurrentPage })} />);
    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[1]);
    await waitFor(() => {
      expect(screen.getByText("Expense")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Expense"));
    expect(setFilterType).toHaveBeenCalledWith("Expense");
    expect(setCurrentPage).toHaveBeenCalledWith(1);
  });

  it("calls setFilterAccount when account is selected", async () => {
    const setFilterAccount = vi.fn();
    const setCurrentPage = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<DesktopFilterBar {...createProps({ setFilterAccount, setCurrentPage })} />);
    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[2]);
    await waitFor(() => {
      expect(screen.getByText("HDFC")).toBeInTheDocument();
    });
    await user.click(screen.getByText("HDFC"));
    expect(setFilterAccount).toHaveBeenCalledWith("1");
    expect(setCurrentPage).toHaveBeenCalledWith(1);
  });

  it("opens date range select and shows options", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<DesktopFilterBar {...createProps()} />);
    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[3]);
    await waitFor(() => {
      expect(screen.getByText("Past 1 Month")).toBeInTheDocument();
      expect(screen.getByText("Past 3 Months")).toBeInTheDocument();
      expect(screen.getByText("Custom Range")).toBeInTheDocument();
    });
  });
});
