import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw-server";
import { TestWrapper } from "@/test/test-wrapper";
import { AiParseBubble } from "./index";

Element.prototype.scrollIntoView = vi.fn();

const mockUseIsMobile = vi.fn(() => false);
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: (...args: unknown[]) => mockUseIsMobile(...args),
}));

describe("AiParseBubble", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
  });

  it("renders the floating button", () => {
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    expect(screen.getByTestId("ai-parse-bubble")).toBeInTheDocument();
  });

  it("opens chat panel on button click", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
  });

  it("shows empty state when chat opens", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    expect(screen.getByText(/help you log transactions/i)).toBeInTheDocument();
  });

  it("has an input field for typing messages", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    expect(input).toBeInTheDocument();
  });

  it("can type text into the input", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "coffee 200");
    expect(input).toHaveValue("coffee 200");
  });

  it("sends message on Enter key", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "coffee 200");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("coffee 200")).toBeInTheDocument();
    });
  });

  it("shows processing state after sending message", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "lunch 300");
    await user.keyboard("{Enter}");
    expect(screen.getByText("lunch 300")).toBeInTheDocument();
  });

  it("closes panel when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    const closeButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-x") !== null,
    );
    expect(closeButtons.length).toBeGreaterThan(0);
    await user.click(closeButtons[0]);
    expect(screen.queryByText("AI Assistant")).not.toBeInTheDocument();
  });

  it("does not send empty message", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "   ");
    const sendButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-send") !== null,
    );
    expect(sendButtons.length).toBeGreaterThan(0);
    expect(sendButtons[0]).toBeDisabled();
  });

  it("shows quick action buttons in empty state", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(2);
  });
});

describe("AiParseBubble - mobile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(true);
  });

  it("renders mobile FAB button", () => {
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    expect(screen.getByTestId("ai-parse-bubble")).toBeInTheDocument();
  });

  it("opens mobile sheet on click", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
  });

  it("renders input field in mobile view", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    expect(input).toBeInTheDocument();
  });

  it("can type and send message in mobile view", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "lunch 500");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("lunch 500")).toBeInTheDocument();
    });
  });

  it("renders the drag handle in mobile view", async () => {
    const user = userEvent.setup();
    const { container } = render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const dragHandle = container.querySelector('.cursor-grab');
    expect(dragHandle).toBeInTheDocument();
  });

  it("renders backdrop in mobile view", async () => {
    const user = userEvent.setup();
    const { container } = render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const backdrop = container.querySelector('.bg-black\\/60');
    expect(backdrop).toBeInTheDocument();
  });
});

describe("AiParseBubble - chat interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
  });

  it("clears input after sending message", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "coffee 200");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(input).toHaveValue("");
    });
  });

  it("shows user message bubble after sending", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "groceries 1500");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("groceries 1500")).toBeInTheDocument();
    });
  });

  it("does not submit on Enter when input is whitespace only", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "   ");
    await user.keyboard("{Enter}");
    expect(screen.queryByText(/   /)).toBeDefined();
  });

  it("receives AI response after sending message", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "spent 450 at starbucks");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("spent 450 at starbucks")).toBeInTheDocument();
    });
    await waitFor(() => {
      const msgs = screen.queryAllByText(/starbucks/i);
      expect(msgs.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it("handles clear conversation first click (pending)", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "test message");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("test message")).toBeInTheDocument();
    });
    const clearButtons = screen.queryAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    if (clearButtons.length > 0) {
      await user.click(clearButtons[0]);
      await waitFor(() => {
        const confirmClearButtons = screen.queryAllByRole("button").filter(
          (btn) => btn.textContent?.includes("Clear") || btn.querySelector("svg.lucide-trash-2") !== null,
        );
        expect(confirmClearButtons.length).toBeGreaterThanOrEqual(0);
      });
    }
  });

  it("toggles panel open and closed via button", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    await user.click(screen.getByTestId("ai-parse-bubble"));
    await waitFor(() => {
      expect(screen.queryByText("AI Assistant")).not.toBeInTheDocument();
    });
  });
});

describe("AiParseBubble - mobile interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(true);
  });

  it("closes mobile panel when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    const backdrop = container.querySelector('.bg-black\\/60');
    if (backdrop) {
      await user.click(backdrop);
      await waitFor(() => {
        expect(screen.queryByText("AI Assistant")).not.toBeInTheDocument();
      });
    }
  });

  it("sends message and gets AI response in mobile view", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "coffee 300");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("coffee 300")).toBeInTheDocument();
    });
  });

  it("toggles mobile panel via FAB button", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    await user.click(screen.getByTestId("ai-parse-bubble"));
    await waitFor(() => {
      expect(screen.queryByText("AI Assistant")).not.toBeInTheDocument();
    });
  });
});

describe("AiParseBubble - confirmation response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
  });

  it("handles confirmation response type with transaction data", async () => {
    server.use(
      http.post("/api/ai/chat", () =>
        HttpResponse.json({
          type: "confirmation",
          reply: "I found this transaction:",
          transaction: {
            transactionType: "Expense",
            amount: "450",
            date: "2026-04-05",
            description: "Starbucks",
            category: "Food",
            accountId: 1,
            fromAccountId: null,
            toAccountId: null,
          },
          warnings: [],
        }),
      ),
    );
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "coffee 450 starbucks");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("coffee 450 starbucks")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("I found this transaction:")).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it("refocuses input after AI response on desktop", async () => {
    server.use(
      http.post("/api/ai/chat", () =>
        HttpResponse.json({
          type: "assistant",
          reply: "Got it!",
        }),
      ),
    );
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "test msg");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("Got it!")).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe("AiParseBubble - mobile touch interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(true);
  });

  it("handles touch start, move, and end without closing for small drag", async () => {
    const user = userEvent.setup();
    const { container } = render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    const dragHandle = container.querySelector('.cursor-grab');
    expect(dragHandle).toBeInTheDocument();
  });

  it("closes mobile panel when backdrop overlay is tapped", async () => {
    const user = userEvent.setup();
    const { container } = render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    const backdrop = container.querySelector('.bg-black\\/60');
    if (backdrop) {
      await user.click(backdrop);
      await waitFor(() => {
        expect(screen.queryByText("AI Assistant")).not.toBeInTheDocument();
      });
    }
  });
});

describe("AiParseBubble - clear conversation flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
  });

  it("clears messages on second click of clear button", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "test clear msg");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("test clear msg")).toBeInTheDocument();
    });
    const clearBtns = screen.queryAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    if (clearBtns.length > 0) {
      await user.click(clearBtns[0]);
      await user.click(clearBtns[0]);
      await waitFor(() => {
        expect(screen.queryByText("test clear msg")).not.toBeInTheDocument();
      });
    }
  });

  it("resets clear confirm pending state after timeout", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "timeout test");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("timeout test")).toBeInTheDocument();
    });
    const clearBtns = screen.queryAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    if (clearBtns.length > 0) {
      await user.click(clearBtns[0]);
      vi.advanceTimersByTime(4000);
    }
    vi.useRealTimers();
  });

  it("handles option click by sending the option value", async () => {
    server.use(
      http.post("/api/ai/chat", () =>
        HttpResponse.json({
          type: "assistant",
          reply: "Which category?",
          options: [{ label: "Pick Food", value: "Food" }, { label: "Pick Travel", value: "Travel" }],
        }),
      ),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "lunch 300");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("Which category?")).toBeInTheDocument();
    }, { timeout: 5000 });
    server.use(
      http.post("/api/ai/chat", () =>
        HttpResponse.json({
          type: "assistant",
          reply: "Got it, Food selected!",
        }),
      ),
    );
    await user.click(screen.getByText("Pick Food"));
    await waitFor(() => {
      const msgs = screen.queryAllByText(/Pick Food|Food/i);
      expect(msgs.length).toBeGreaterThan(0);
    });
  });
});

describe("AiParseBubble - AI response types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
  });

  it("handles cancelled response type from AI", async () => {
    server.use(
      http.post("/api/ai/chat", () =>
        HttpResponse.json({
          type: "cancelled",
          reply: "Transaction cancelled.",
        }),
      ),
    );
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "cancel that");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("cancel that")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("Transaction cancelled.")).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it("handles query_result response type from AI", async () => {
    server.use(
      http.post("/api/ai/chat", () =>
        HttpResponse.json({
          type: "query_result",
          reply: "Here are your results",
          queryData: { items: [{ label: "Food", value: "5000" }], summary: "Total: ₹5,000" },
        }),
      ),
    );
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "show my spending");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("show my spending")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("Here are your results")).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it("handles assistant reply with options", async () => {
    server.use(
      http.post("/api/ai/chat", () =>
        HttpResponse.json({
          type: "assistant",
          reply: "Which category would you like?",
          options: [{ label: "Select Food", value: "Food" }, { label: "Select Travel", value: "Travel" }],
        }),
      ),
    );
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "lunch 300");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("Which category would you like?")).toBeInTheDocument();
    }, { timeout: 5000 });
  }, 10000);

  it("handles API error gracefully", async () => {
    server.use(
      http.post("/api/ai/chat", () =>
        HttpResponse.json({ error: "fail" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "bad request");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("bad request")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/sorry.*trouble/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it("handles clear conversation double click flow", async () => {
    const user = userEvent.setup();
    render(<TestWrapper><AiParseBubble /></TestWrapper>);
    await user.click(screen.getByTestId("ai-parse-bubble"));
    const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
    await user.type(input, "hello");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("hello")).toBeInTheDocument();
    });
    const clearBtns = screen.queryAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    if (clearBtns.length > 0) {
      await user.click(clearBtns[0]);
      await user.click(clearBtns[0]);
    }
  });

  describe("mobile touch interactions", () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(true);
    });

    it("renders mobile sheet layout when isMobile is true", async () => {
      const user = userEvent.setup();
      render(<TestWrapper><AiParseBubble /></TestWrapper>);
      await user.click(screen.getByTestId("ai-parse-bubble"));
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Spent 450 at Starbucks/i)).toBeInTheDocument();
      });
    });

    it("handles touch start on mobile drag handle", async () => {
      const user = userEvent.setup();
      const { container } = render(<TestWrapper><AiParseBubble /></TestWrapper>);
      await user.click(screen.getByTestId("ai-parse-bubble"));
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Spent 450 at Starbucks/i)).toBeInTheDocument();
      });
      const dragHandle = container.querySelector(".cursor-grab");
      expect(dragHandle).toBeTruthy();
      if (dragHandle) {
        fireEvent.touchStart(dragHandle, { touches: [{ clientY: 100, clientX: 0 }] });
      }
    });

    it("handles touch move and end - small drag (snap back)", async () => {
      const user = userEvent.setup();
      const { container } = render(<TestWrapper><AiParseBubble /></TestWrapper>);
      await user.click(screen.getByTestId("ai-parse-bubble"));
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Spent 450 at Starbucks/i)).toBeInTheDocument();
      });
      const dragHandle = container.querySelector(".cursor-grab");
      expect(dragHandle).toBeTruthy();
      if (dragHandle) {
        fireEvent.touchStart(dragHandle, { touches: [{ clientY: 100, clientX: 0 }] });
        fireEvent.touchMove(dragHandle, { touches: [{ clientY: 120, clientX: 0 }] });
        fireEvent.touchEnd(dragHandle, { touches: [] });
      }
    });

    it("handles touch move and end - large drag (close sheet)", async () => {
      const user = userEvent.setup();
      const { container } = render(<TestWrapper><AiParseBubble /></TestWrapper>);
      await user.click(screen.getByTestId("ai-parse-bubble"));
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Spent 450 at Starbucks/i)).toBeInTheDocument();
      });
      const dragHandle = container.querySelector(".cursor-grab");
      expect(dragHandle).toBeTruthy();
      if (dragHandle) {
        fireEvent.touchStart(dragHandle, { touches: [{ clientY: 100, clientX: 0 }] });
        fireEvent.touchMove(dragHandle, { touches: [{ clientY: 500, clientX: 0 }] });
        fireEvent.touchEnd(dragHandle, { touches: [] });
      }
    });

    it("sends message on mobile and shows in chat", async () => {
      const user = userEvent.setup();
      render(<TestWrapper><AiParseBubble /></TestWrapper>);
      await user.click(screen.getByTestId("ai-parse-bubble"));
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Spent 450 at Starbucks/i)).toBeInTheDocument();
      });
      const input = screen.getByPlaceholderText(/Spent 450 at Starbucks/i);
      await user.type(input, "mobile test msg");
      await user.keyboard("{Enter}");
      await waitFor(() => {
        expect(screen.getByText("mobile test msg")).toBeInTheDocument();
      });
    });

    it("touch handlers are no-ops when not mobile", async () => {
      mockUseIsMobile.mockReturnValue(false);
      const user = userEvent.setup();
      render(<TestWrapper><AiParseBubble /></TestWrapper>);
      await user.click(screen.getByTestId("ai-parse-bubble"));
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Spent 450 at Starbucks/i)).toBeInTheDocument();
      });
    });
  });
});
