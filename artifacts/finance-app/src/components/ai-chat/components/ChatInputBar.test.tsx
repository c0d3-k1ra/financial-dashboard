import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInputBar } from "./ChatInputBar";
import { createRef } from "react";

const defaultProps = {
  inputRef: createRef<HTMLInputElement>(),
  nlInput: "",
  setNlInput: vi.fn(),
  isProcessing: false,
  isListening: false,
  speechSupported: true,
  isMobile: false,
  isTouchDevice: false,
  hasCompletedMessages: false,
  onSend: vi.fn(),
  onStartListening: vi.fn(),
  onStopListening: vi.fn(),
};

describe("ChatInputBar", () => {
  it("renders the input field", () => {
    render(<ChatInputBar {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Spent 450 at Starbucks/)).toBeInTheDocument();
  });

  it("shows different placeholder when has completed messages", () => {
    render(<ChatInputBar {...defaultProps} hasCompletedMessages={true} />);
    expect(screen.getByPlaceholderText(/Log another or ask a question/)).toBeInTheDocument();
  });

  it("renders send button", () => {
    render(<ChatInputBar {...defaultProps} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("send button is disabled when no input", () => {
    render(<ChatInputBar {...defaultProps} nlInput="" />);
    const buttons = screen.getAllByRole("button");
    const sendBtn = buttons.find(b => !b.getAttribute("aria-label")?.includes("voice"));
    expect(sendBtn).toBeDisabled();
  });

  it("send button is enabled when there is input", () => {
    render(<ChatInputBar {...defaultProps} nlInput="hello" />);
    const buttons = screen.getAllByRole("button");
    const lastBtn = buttons[buttons.length - 1];
    expect(lastBtn).not.toBeDisabled();
  });

  it("calls onSend when send button is clicked", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatInputBar {...defaultProps} nlInput="test" onSend={onSend} />);
    const buttons = screen.getAllByRole("button");
    const sendBtn = buttons[buttons.length - 1];
    await user.click(sendBtn);
    expect(onSend).toHaveBeenCalledWith("test");
  });

  it("shows mic button when speech is supported", () => {
    render(<ChatInputBar {...defaultProps} speechSupported={true} />);
    expect(screen.getByLabelText(/Start voice input/)).toBeInTheDocument();
  });

  it("hides mic button when speech is not supported", () => {
    render(<ChatInputBar {...defaultProps} speechSupported={false} />);
    expect(screen.queryByLabelText(/voice input/)).not.toBeInTheDocument();
  });

  it("shows stop label when listening", () => {
    render(<ChatInputBar {...defaultProps} isListening={true} />);
    expect(screen.getByLabelText(/Stop voice input/)).toBeInTheDocument();
  });

  it("shows recording bar when listening", () => {
    const { container } = render(<ChatInputBar {...defaultProps} isListening={true} />);
    expect(container.querySelector(".ai-recording-bar")).toBeInTheDocument();
  });

  it("disables input when processing", () => {
    render(<ChatInputBar {...defaultProps} isProcessing={true} />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("calls setNlInput on input change", async () => {
    const setNlInput = vi.fn();
    const user = userEvent.setup();
    render(<ChatInputBar {...defaultProps} setNlInput={setNlInput} />);
    await user.type(screen.getByRole("textbox"), "h");
    expect(setNlInput).toHaveBeenCalled();
  });

  it("calls onSend on Enter key", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatInputBar {...defaultProps} nlInput="test message" onSend={onSend} />);
    await user.type(screen.getByRole("textbox"), "{enter}");
    expect(onSend).toHaveBeenCalledWith("test message");
  });

  it("calls onStartListening when mic button clicked", async () => {
    const onStartListening = vi.fn();
    const user = userEvent.setup();
    render(<ChatInputBar {...defaultProps} onStartListening={onStartListening} />);
    await user.click(screen.getByLabelText(/Start voice input/));
    expect(onStartListening).toHaveBeenCalled();
  });

  it("calls onStopListening when mic button clicked while listening", async () => {
    const onStopListening = vi.fn();
    const user = userEvent.setup();
    render(<ChatInputBar {...defaultProps} isListening={true} onStopListening={onStopListening} />);
    await user.click(screen.getByLabelText(/Stop voice input/));
    expect(onStopListening).toHaveBeenCalled();
  });

  it("shows processing spinner in send button", () => {
    render(<ChatInputBar {...defaultProps} isProcessing={true} nlInput="test" />);
    const buttons = screen.getAllByRole("button");
    const sendBtn = buttons[buttons.length - 1];
    expect(sendBtn.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("applies mobile styles when isMobile", () => {
    render(<ChatInputBar {...defaultProps} isMobile={true} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("h-12");
  });
});
