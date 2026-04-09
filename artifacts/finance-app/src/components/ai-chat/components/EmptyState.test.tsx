import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders a greeting", () => {
    render(<EmptyState isMobile={false} isProcessing={false} onSendMessage={vi.fn()} />);
    expect(screen.getByText(/Good (morning|afternoon|evening)/)).toBeInTheDocument();
  });

  it("renders helper text", () => {
    render(<EmptyState isMobile={false} isProcessing={false} onSendMessage={vi.fn()} />);
    expect(screen.getByText(/log transactions/)).toBeInTheDocument();
  });

  it("renders quick action buttons", () => {
    render(<EmptyState isMobile={false} isProcessing={false} onSendMessage={vi.fn()} />);
    expect(screen.getByText("Log an expense")).toBeInTheDocument();
    expect(screen.getByText("Record salary")).toBeInTheDocument();
    expect(screen.getByText("Transfer money")).toBeInTheDocument();
  });

  it("calls onSendMessage when a quick action is clicked", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<EmptyState isMobile={false} isProcessing={false} onSendMessage={onSend} />);
    await user.click(screen.getByText("Log an expense"));
    expect(onSend).toHaveBeenCalledWith("I want to log an expense");
  });

  it("disables buttons when processing", () => {
    render(<EmptyState isMobile={false} isProcessing={true} onSendMessage={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach(btn => expect(btn).toBeDisabled());
  });
});
