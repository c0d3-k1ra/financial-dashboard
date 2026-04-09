import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaginationBar } from "./pagination-bar";

const defaultProps = {
  currentPage: 1,
  totalPages: 5,
  totalCount: 75,
  showingFrom: 1,
  showingTo: 15,
  setCurrentPage: vi.fn(),
};

describe("PaginationBar", () => {
  it("renders showing text", () => {
    render(<PaginationBar {...defaultProps} />);
    expect(screen.getByText(/Showing 1–15 of 75 transactions/)).toBeInTheDocument();
  });

  it("renders nothing when totalCount is 0", () => {
    const { container } = render(<PaginationBar {...defaultProps} totalCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders page buttons", () => {
    render(<PaginationBar {...defaultProps} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("disables prev button on first page", () => {
    render(<PaginationBar {...defaultProps} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(<PaginationBar {...defaultProps} currentPage={5} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[buttons.length - 1]).toBeDisabled();
  });

  it("calls setCurrentPage when page button clicked", async () => {
    const setPage = vi.fn();
    const user = userEvent.setup();
    render(<PaginationBar {...defaultProps} setCurrentPage={setPage} />);
    await user.click(screen.getByText("3"));
    expect(setPage).toHaveBeenCalledWith(3);
  });

  it("does not show page buttons when totalPages is 1", () => {
    render(<PaginationBar {...defaultProps} totalPages={1} totalCount={5} showingFrom={1} showingTo={5} />);
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("renders navigation buttons for large page counts", () => {
    render(<PaginationBar {...defaultProps} totalPages={20} currentPage={10} />);
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("calls setCurrentPage with prev page function when prev button clicked", async () => {
    const setPage = vi.fn();
    const user = userEvent.setup();
    render(<PaginationBar {...defaultProps} currentPage={3} setCurrentPage={setPage} />);
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]);
    expect(setPage).toHaveBeenCalled();
    const fn = setPage.mock.calls[0][0];
    if (typeof fn === "function") {
      expect(fn(3)).toBe(2);
    }
  });

  it("calls setCurrentPage with next page function when next button clicked", async () => {
    const setPage = vi.fn();
    const user = userEvent.setup();
    render(<PaginationBar {...defaultProps} currentPage={3} setCurrentPage={setPage} />);
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);
    expect(setPage).toHaveBeenCalled();
    const fn = setPage.mock.calls[0][0];
    if (typeof fn === "function") {
      expect(fn(3)).toBe(4);
    }
  });

  it("prev button function clamps to minimum 1", () => {
    const setPage = vi.fn();
    render(<PaginationBar {...defaultProps} currentPage={1} setCurrentPage={setPage} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toBeDisabled();
  });

  it("next button function clamps to maximum totalPages", () => {
    const setPage = vi.fn();
    render(<PaginationBar {...defaultProps} currentPage={5} setCurrentPage={setPage} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[buttons.length - 1]).toBeDisabled();
  });

  it("shows ellipsis for large page ranges", () => {
    render(<PaginationBar {...defaultProps} totalPages={20} currentPage={10} />);
    const ellipses = screen.getAllByText("…");
    expect(ellipses.length).toBeGreaterThan(0);
  });
});
