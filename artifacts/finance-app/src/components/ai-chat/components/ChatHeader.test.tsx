import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatHeader } from "./ChatHeader";

const defaultProps = {
  isMobile: false,
  isProcessing: false,
  hasMessages: true,
  clearConfirmPending: false,
  onClearConversation: vi.fn(),
  onClose: vi.fn(),
};

describe("ChatHeader", () => {
  it("renders the title", () => {
    render(<ChatHeader {...defaultProps} />);
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
  });

  it("shows clear button when there are messages", () => {
    render(<ChatHeader {...defaultProps} />);
    expect(screen.getByLabelText("Clear conversation")).toBeInTheDocument();
  });

  it("hides clear button when no messages", () => {
    render(<ChatHeader {...defaultProps} hasMessages={false} />);
    expect(screen.queryByLabelText("Clear conversation")).not.toBeInTheDocument();
  });

  it("shows 'Clear?' text when clearConfirmPending is true", () => {
    render(<ChatHeader {...defaultProps} clearConfirmPending={true} />);
    expect(screen.getByText("Clear?")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ChatHeader {...defaultProps} onClose={onClose} />);
    const buttons = screen.getAllByRole("button");
    const closeBtn = buttons[buttons.length - 1];
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClearConversation when clear button is clicked", async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(<ChatHeader {...defaultProps} onClearConversation={onClear} />);
    await user.click(screen.getByLabelText("Clear conversation"));
    expect(onClear).toHaveBeenCalled();
  });

  it("applies mobile styles", () => {
    const { container } = render(<ChatHeader {...defaultProps} isMobile={true} />);
    expect(container.firstChild).toHaveClass("px-4");
  });

  it("applies shimmer class when processing on mobile", () => {
    const { container } = render(<ChatHeader {...defaultProps} isMobile={true} isProcessing={true} />);
    expect(container.firstChild).toHaveClass("ai-header-shimmer");
  });
});
