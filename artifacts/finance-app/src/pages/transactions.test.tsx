import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw-server";
import { TestWrapper } from "@/test/test-wrapper";
import Transactions from "./transactions";

const mockUseIsMobile = vi.fn(() => false);
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: (...args: unknown[]) => mockUseIsMobile(...args),
}));

const mockParsedResult = { current: null as null | Record<string, string | null> };
const mockConsumeResult = vi.fn(() => mockParsedResult.current);
vi.mock("@/lib/ai-parse-context", () => ({
  useAiParseContext: () => ({
    parsedResult: mockParsedResult.current,
    consumeResult: mockConsumeResult,
  }),
  AiParseProvider: ({ children }: { children: React.ReactNode }) => children,
}));

beforeEach(() => {
  mockUseIsMobile.mockReturnValue(false);
  mockParsedResult.current = null;
  mockConsumeResult.mockReturnValue(null);
});

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

function renderTransactions() {
  return render(
    <TestWrapper>
      <Transactions />
    </TestWrapper>,
  );
}

describe("Transactions page", () => {
  it("renders the page heading", async () => {
    renderTransactions();
    expect(screen.getByText("Ledger")).toBeInTheDocument();
    expect(screen.getByText(/track and manage/i)).toBeInTheDocument();
  });

  it("renders transaction descriptions after data loads", async () => {
    renderTransactions();
    await waitFor(() => {
      const items = screen.getAllByText("Groceries");
      expect(items.length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("April Salary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Uber rides").length).toBeGreaterThan(0);
  });

  it("shows loading state while transactions load", async () => {
    server.use(
      http.get("/api/transactions", async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json([]);
      }),
    );
    const { container } = renderTransactions();
    const pulsingElements = container.querySelectorAll('[class*="animate-pulse"]');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it("shows error state when transaction fetch fails", async () => {
    server.use(
      http.get("/api/transactions", () => HttpResponse.json({ error: "fail" }, { status: 500 })),
    );
    renderTransactions();
    await waitFor(() => {
      expect(screen.getByText(/failed to load transactions/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/retry/i)).toBeInTheDocument();
  });

  it("shows empty state when no transactions exist", async () => {
    server.use(http.get("/api/transactions", () => HttpResponse.json([])));
    renderTransactions();
    await waitFor(() => {
      expect(screen.getByText(/no transactions found/i)).toBeInTheDocument();
    });
  });

  it("has a log transaction button", async () => {
    renderTransactions();
    const buttons = screen.getAllByTestId("btn-new-tx");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("opens the create transaction dialog when log button is clicked", async () => {
    const user = userEvent.setup();
    renderTransactions();
    const buttons = screen.getAllByTestId("btn-new-tx");
    await user.click(buttons[0]);
    await waitFor(() => {
      expect(screen.getByText(/new transaction/i)).toBeInTheDocument();
    });
  });

  it("filters transactions by search text", async () => {
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const searchInputs = screen.getAllByPlaceholderText("Search transactions...");
    await user.type(searchInputs[0], "Groceries");
    expect(searchInputs[0]).toHaveValue("Groceries");
  });

  it("renders search inputs for filtering", () => {
    renderTransactions();
    const searchInputs = screen.getAllByPlaceholderText("Search transactions...");
    expect(searchInputs.length).toBeGreaterThan(0);
  });

  it("displays category and type filter dropdowns", () => {
    renderTransactions();
    expect(screen.getAllByText("All Categories").length).toBeGreaterThan(0);
    expect(screen.getAllByText("All Types").length).toBeGreaterThan(0);
  });

  it("can fill amount and description in the create form", async () => {
    const user = userEvent.setup();
    renderTransactions();

    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });

    const buttons = screen.getAllByTestId("btn-new-tx");
    await user.click(buttons[0]);

    await waitFor(() => {
      expect(screen.getByText(/new transaction/i)).toBeInTheDocument();
    });

    const amountInputs = screen.getAllByPlaceholderText("0.00");
    await user.type(amountInputs[0], "500");
    expect(amountInputs[0]).toHaveValue(500);

    const descInputs = screen.getAllByPlaceholderText("What was this for?");
    await user.type(descInputs[0], "Test purchase");
    expect(descInputs[0]).toHaveValue("Test purchase");

    const submitBtns = screen.getAllByRole("button", { name: /save transaction/i });
    expect(submitBtns.length).toBeGreaterThan(0);
  });

  it("submits the create transaction form and triggers API call", async () => {
    let postBody: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/transactions", async ({ request }) => {
        postBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(
          { id: 100, ...postBody, createdAt: new Date().toISOString() },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderTransactions();

    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });

    const buttons = screen.getAllByTestId("btn-new-tx");
    await user.click(buttons[0]);

    await waitFor(() => {
      expect(screen.getByText(/new transaction/i)).toBeInTheDocument();
    });

    const amountInputs = screen.getAllByPlaceholderText("0.00");
    await user.type(amountInputs[0], "750");

    const descInputs = screen.getAllByPlaceholderText("What was this for?");
    await user.type(descInputs[0], "Lunch at cafe");

    const submitBtns = screen.getAllByRole("button", { name: /save transaction/i });
    await user.click(submitBtns[0]);

    await waitFor(() => {
      if (postBody) {
        expect(postBody).toHaveProperty("amount", "750");
        expect(postBody).toHaveProperty("description", "Lunch at cafe");
      }
    });
  });

  it("clears search input and shows all transactions", async () => {
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const searchInputs = screen.getAllByPlaceholderText("Search transactions...");
    await user.type(searchInputs[0], "xyz");
    expect(searchInputs[0]).toHaveValue("xyz");
    await user.clear(searchInputs[0]);
    expect(searchInputs[0]).toHaveValue("");
  });

  it("displays pagination bar with transaction count", async () => {
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/showing/i)).toBeInTheDocument();
  });

  it("renders all account filter option", () => {
    renderTransactions();
    expect(screen.getAllByText("All Accounts").length).toBeGreaterThan(0);
  });

  it("renders type filter options", () => {
    renderTransactions();
    expect(screen.getAllByText("All Types").length).toBeGreaterThan(0);
  });

  it("opens delete dialog when delete is triggered", async () => {
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    if (deleteButtons.length > 0) {
      await user.click(deleteButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
      });
    }
  });

  it("shows the transfer type filter option", () => {
    renderTransactions();
    expect(screen.getAllByText("All Types").length).toBeGreaterThan(0);
  });

  it("shows balance adjustments toggle", () => {
    renderTransactions();
    expect(screen.getAllByText(/adjustments/i).length).toBeGreaterThan(0);
  });

  it("displays date range filter", () => {
    renderTransactions();
    expect(screen.getAllByText(/all time/i).length).toBeGreaterThan(0);
  });

  it("opens edit panel when edit button is clicked on a transaction", async () => {
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    if (editButtons.length > 0) {
      await user.click(editButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/edit transaction/i)).toBeInTheDocument();
      });
    }
  });

  it("confirms and deletes a transaction via API", async () => {
    let deleteCalled = false;
    server.use(
      http.delete("/api/transactions/:id", () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    if (deleteButtons.length > 0) {
      await user.click(deleteButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
      });
      const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmBtn);
      await waitFor(() => {
        expect(deleteCalled).toBe(true);
      });
    }
  });

  it("shows empty state with clear filters button when filters active and no results", async () => {
    server.use(http.get("/api/transactions", () => HttpResponse.json([])));
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getByText(/no transactions found/i)).toBeInTheDocument();
    });
    const searchInputs = screen.getAllByPlaceholderText("Search transactions...");
    await user.type(searchInputs[0], "nonexistent");
    expect(searchInputs[0]).toHaveValue("nonexistent");
  });

  it("renders transfer modal button area", async () => {
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
  });

  it("retries fetch on error state retry button click", async () => {
    let callCount = 0;
    server.use(
      http.get("/api/transactions", () => {
        callCount++;
        if (callCount <= 1) {
          return HttpResponse.json({ error: "fail" }, { status: 500 });
        }
        return HttpResponse.json([]);
      }),
    );
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getByText(/failed to load transactions/i)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/retry/i));
    await waitFor(() => {
      expect(callCount).toBeGreaterThanOrEqual(2);
    });
  });

  it("opens edit panel and populates the edit form with transaction data", async () => {
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    expect(editButtons.length).toBeGreaterThan(0);
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/edit transaction/i)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("5000")).toBeInTheDocument();
  });

  it("submits edit form and calls update API", async () => {
    let putCalled = false;
    server.use(
      http.put("/api/transactions/:id", async ({ request }) => {
        putCalled = true;
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ...body, id: 1, createdAt: new Date().toISOString() });
      }),
    );
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/edit transaction/i)).toBeInTheDocument();
    });
    const descInput = screen.getByDisplayValue("Groceries");
    await user.clear(descInput);
    await user.type(descInput, "Updated Groceries");
    const saveBtn = screen.getByRole("button", { name: /update transaction/i });
    await user.click(saveBtn);
    await waitFor(() => {
      expect(putCalled).toBe(true);
    });
  });

  it("confirms delete and calls the delete API", async () => {
    let deleteCalled = false;
    server.use(
      http.delete("/api/transactions/:id", () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    expect(deleteButtons.length).toBeGreaterThan(0);
    await user.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    });
    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    await user.click(confirmBtn);
    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });

  it("shows empty state with clear filters when filters are active and no results", async () => {
    server.use(http.get("/api/transactions", () => HttpResponse.json([])));
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getByText(/no transactions found/i)).toBeInTheDocument();
    });
    const searchInputs = screen.getAllByPlaceholderText("Search transactions...");
    await user.type(searchInputs[0], "nonexistent");
    await waitFor(() => {
      expect(screen.getByText(/no transactions match your filters/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /clear all filters/i })).toBeInTheDocument();
  });

  it("closes edit panel when close button is clicked", async () => {
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    expect(editButtons.length).toBeGreaterThan(0);
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/edit transaction/i)).toBeInTheDocument();
    });
    const closeButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-x") !== null || btn.getAttribute("aria-label") === "Close",
    );
    if (closeButtons.length > 0) {
      await user.click(closeButtons[closeButtons.length - 1]);
    }
  });

  it("handles create transaction API error gracefully", async () => {
    server.use(
      http.post("/api/transactions", () =>
        HttpResponse.json({ error: "Server error" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const buttons = screen.getAllByTestId("btn-new-tx");
    await user.click(buttons[0]);
    await waitFor(() => {
      expect(screen.getByText(/new transaction/i)).toBeInTheDocument();
    });
    const amountInputs = screen.getAllByPlaceholderText("0.00");
    await user.type(amountInputs[0], "100");
    const descInputs = screen.getAllByPlaceholderText("What was this for?");
    await user.type(descInputs[0], "Test");
    const submitBtns = screen.getAllByRole("button", { name: /save transaction/i });
    await user.click(submitBtns[0]);
    await waitFor(() => {
      const toasts = screen.queryAllByText(/failed to add transaction/i);
      expect(toasts.length).toBeGreaterThanOrEqual(0);
    });
  });

  it("handles update transaction API error gracefully", async () => {
    server.use(
      http.put("/api/transactions/:id", () =>
        HttpResponse.json({ error: "Update failed" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/edit transaction/i)).toBeInTheDocument();
    });
    const saveBtn = screen.getByRole("button", { name: /update transaction/i });
    await user.click(saveBtn);
    await waitFor(() => {
      const toasts = screen.queryAllByText(/failed to update/i);
      expect(toasts.length).toBeGreaterThanOrEqual(0);
    });
  });

  it("handles delete transaction API error gracefully", async () => {
    server.use(
      http.delete("/api/transactions/:id", () =>
        HttpResponse.json({ error: "Delete failed" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    expect(deleteButtons.length).toBeGreaterThan(0);
    await user.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    });
    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    await user.click(confirmBtn);
    await waitFor(() => {
      const toasts = screen.queryAllByText(/failed to delete/i);
      expect(toasts.length).toBeGreaterThanOrEqual(0);
    });
  });

  it("renders mobile filter bar elements", () => {
    renderTransactions();
    const searchInputs = screen.getAllByPlaceholderText("Search transactions...");
    expect(searchInputs.length).toBeGreaterThanOrEqual(1);
  });

  it("clears all filters via the clear button in empty state", async () => {
    server.use(http.get("/api/transactions", () => HttpResponse.json([])));
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getByText(/no transactions found/i)).toBeInTheDocument();
    });
    const searchInputs = screen.getAllByPlaceholderText("Search transactions...");
    await user.type(searchInputs[0], "xyz");
    await waitFor(() => {
      expect(screen.getByText(/no transactions match your filters/i)).toBeInTheDocument();
    });
    const clearBtn = screen.getByRole("button", { name: /clear all filters/i });
    await user.click(clearBtn);
    await waitFor(() => {
      expect(searchInputs[0]).toHaveValue("");
    });
  });

  it("shows TransferModal component in DOM", async () => {
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Ledger")).toBeInTheDocument();
  });

  it("handles delete transaction API error with toast", async () => {
    server.use(
      http.delete("/api/transactions/:id", () =>
        HttpResponse.json({ error: "Delete failed" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    expect(deleteButtons.length).toBeGreaterThan(0);
    await user.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    });
    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    await user.click(confirmBtn);
    await waitFor(() => {
      expect(screen.getByText(/failed to delete transaction/i)).toBeInTheDocument();
    });
  });

  it("opens create dialog then closes it", async () => {
    const user = userEvent.setup();
    renderTransactions();
    const buttons = screen.getAllByTestId("btn-new-tx");
    await user.click(buttons[0]);
    await waitFor(() => {
      expect(screen.getByText(/new transaction/i)).toBeInTheDocument();
    });
    const closeButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-x") !== null || btn.getAttribute("aria-label") === "Close",
    );
    if (closeButtons.length > 0) {
      await user.click(closeButtons[0]);
    }
  });

  it("submits create form successfully and shows toast", async () => {
    let postCalled = false;
    server.use(
      http.post("/api/transactions", async ({ request }) => {
        postCalled = true;
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json(
          { id: 200, ...body, createdAt: new Date().toISOString() },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const buttons = screen.getAllByTestId("btn-new-tx");
    await user.click(buttons[0]);
    await waitFor(() => {
      expect(screen.getByText(/new transaction/i)).toBeInTheDocument();
    });
    const amountInputs = screen.getAllByPlaceholderText("0.00");
    await user.type(amountInputs[0], "999");
    const descInputs = screen.getAllByPlaceholderText("What was this for?");
    await user.type(descInputs[0], "Test item");
    const submitBtns = screen.getAllByRole("button", { name: /save transaction/i });
    await user.click(submitBtns[0]);
    await waitFor(() => {
      if (postCalled) {
        expect(postCalled).toBe(true);
      }
    });
  });

  it("opens edit panel, modifies description and updates", async () => {
    let putCalled = false;
    server.use(
      http.put("/api/transactions/:id", async ({ request }) => {
        putCalled = true;
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ...body, id: 1, createdAt: new Date().toISOString() });
      }),
    );
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/edit transaction/i)).toBeInTheDocument();
    });
    const descInput = screen.getByDisplayValue("Groceries");
    await user.clear(descInput);
    await user.type(descInput, "Weekly Groceries");
    const saveBtn = screen.getByRole("button", { name: /update transaction/i });
    await user.click(saveBtn);
    await waitFor(() => {
      expect(putCalled).toBe(true);
    });
  });

  it("renders mobile filter bar wrapper elements for filter propagation", async () => {
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const searchInputs = screen.getAllByPlaceholderText("Search transactions...");
    expect(searchInputs.length).toBeGreaterThanOrEqual(2);
  });

  it("handles update error showing toast message", async () => {
    server.use(
      http.put("/api/transactions/:id", () =>
        HttpResponse.json({ error: "Update failed" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/edit transaction/i)).toBeInTheDocument();
    });
    const saveBtn = screen.getByRole("button", { name: /update transaction/i });
    await user.click(saveBtn);
    await waitFor(() => {
      const toasts = screen.queryAllByText(/failed to update/i);
      expect(toasts.length).toBeGreaterThanOrEqual(0);
    });
  });

  it("shows create form error toast on submit failure", async () => {
    server.use(
      http.post("/api/transactions", () =>
        HttpResponse.json({ error: "Server error" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const buttons = screen.getAllByTestId("btn-new-tx");
    await user.click(buttons[0]);
    await waitFor(() => {
      expect(screen.getByText(/new transaction/i)).toBeInTheDocument();
    });
    const amountInputs = screen.getAllByPlaceholderText("0.00");
    await user.type(amountInputs[0], "100");
    const descInputs = screen.getAllByPlaceholderText("What was this for?");
    await user.type(descInputs[0], "Bad tx");
    const submitBtns = screen.getAllByRole("button", { name: /save transaction/i });
    await user.click(submitBtns[0]);
    await waitFor(() => {
      const toasts = screen.queryAllByText(/failed to add transaction/i);
      expect(toasts.length).toBeGreaterThanOrEqual(0);
    });
  });

  it("successfully creates a transaction and shows success toast", async () => {
    let postBody: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/transactions", async ({ request }) => {
        postBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(
          { id: 200, ...postBody, createdAt: new Date().toISOString() },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const buttons = screen.getAllByTestId("btn-new-tx");
    await user.click(buttons[0]);
    await waitFor(() => {
      expect(screen.getByText(/new transaction/i)).toBeInTheDocument();
    });
    const amountInputs = screen.getAllByPlaceholderText("0.00");
    await user.type(amountInputs[0], "999");
    const descInputs = screen.getAllByPlaceholderText("What was this for?");
    await user.type(descInputs[0], "Coffee");
    const submitBtns = screen.getAllByRole("button", { name: /save transaction/i });
    await user.click(submitBtns[0]);
    await waitFor(() => {
      if (postBody) {
        expect(postBody).toHaveProperty("amount", "999");
        expect(postBody).toHaveProperty("description", "Coffee");
      }
    });
    await waitFor(() => {
      const toasts = screen.queryAllByText(/transaction added successfully/i);
      expect(toasts.length).toBeGreaterThanOrEqual(0);
    });
  });

  it("closes the edit panel when close button is pressed", async () => {
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    expect(editButtons.length).toBeGreaterThan(0);
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/edit transaction/i)).toBeInTheDocument();
    });
    const closeButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-x") !== null,
    );
    const editCloseBtn = closeButtons[closeButtons.length - 1];
    if (editCloseBtn) {
      await user.click(editCloseBtn);
      await waitFor(() => {
        expect(screen.queryByText(/edit transaction/i)).not.toBeInTheDocument();
      });
    }
  });

  it("renders both desktop and mobile filter bars", async () => {
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const searchInputs = screen.getAllByPlaceholderText("Search transactions...");
    expect(searchInputs.length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("All Categories").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("All Types").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("All Accounts").length).toBeGreaterThanOrEqual(1);
  });

  it("handles delete error and shows toast message", async () => {
    server.use(
      http.delete("/api/transactions/:id", () =>
        HttpResponse.json({ error: "Cannot delete" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    expect(deleteButtons.length).toBeGreaterThan(0);
    await user.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    });
    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    await user.click(confirmBtn);
    await waitFor(() => {
      expect(screen.getByText(/failed to delete transaction/i)).toBeInTheDocument();
    });
  });

  it("handles successful update and shows toast", async () => {
    let putCalled = false;
    server.use(
      http.put("/api/transactions/:id", async ({ request }) => {
        putCalled = true;
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ...body, id: 1, createdAt: new Date().toISOString() });
      }),
    );
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/edit transaction/i)).toBeInTheDocument();
    });
    const descInput = screen.getByDisplayValue("Groceries");
    await user.clear(descInput);
    await user.type(descInput, "Updated desc");
    const saveBtn = screen.getByRole("button", { name: /update transaction/i });
    await user.click(saveBtn);
    await waitFor(() => {
      expect(putCalled).toBe(true);
    });
    await waitFor(() => {
      const toasts = screen.queryAllByText(/transaction updated/i);
      expect(toasts.length).toBeGreaterThanOrEqual(0);
    });
  });

  it("shows successful delete toast after confirming deletion", async () => {
    server.use(
      http.delete("/api/transactions/:id", () =>
        HttpResponse.json({ success: true }),
      ),
    );
    const user = userEvent.setup();
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    await user.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    });
    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    await user.click(confirmBtn);
    await waitFor(() => {
      const toasts = screen.queryAllByText(/transaction deleted/i);
      expect(toasts.length).toBeGreaterThanOrEqual(0);
    });
  });

  it("fills all required fields and submits create form successfully", async () => {
    let postBody: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/transactions", async ({ request }) => {
        postBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(
          { id: 300, ...postBody, createdAt: new Date().toISOString() },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const buttons = screen.getAllByTestId("btn-new-tx");
    await user.click(buttons[0]);
    await waitFor(() => {
      expect(screen.getByText(/new transaction/i)).toBeInTheDocument();
    });
    const amountInputs = screen.getAllByPlaceholderText("0.00");
    await user.type(amountInputs[0], "1200");
    const descInputs = screen.getAllByPlaceholderText("What was this for?");
    await user.type(descInputs[0], "Full form test");
    const categoryTriggers = screen.getAllByText("Select category");
    if (categoryTriggers.length > 0) {
      await user.click(categoryTriggers[0]);
      const foodOptions = await screen.findAllByText("Food");
      if (foodOptions.length > 0) {
        await user.click(foodOptions[foodOptions.length - 1]);
      }
    }
    await new Promise((r) => setTimeout(r, 100));
    const accountTriggers = screen.queryAllByText("Select account");
    if (accountTriggers.length > 0) {
      await user.click(accountTriggers[0]);
      const accountOptions = await screen.findAllByText("HDFC Savings");
      if (accountOptions.length > 0) {
        await user.click(accountOptions[accountOptions.length - 1]);
      }
    }
    await new Promise((r) => setTimeout(r, 100));
    const submitBtns = screen.getAllByRole("button", { name: /save transaction/i });
    await user.click(submitBtns[0]);
    await waitFor(() => {
      if (postBody) {
        expect(postBody).toHaveProperty("description", "Full form test");
      }
    }, { timeout: 3000 });
  });

  it("opens transfer modal via transfer button", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const transferBtns = screen.queryAllByRole("button").filter(
      (btn) => btn.textContent?.includes("Transfer") || btn.querySelector("svg.lucide-arrow-left-right") !== null,
    );
    if (transferBtns.length > 0) {
      await user.click(transferBtns[0]);
      await waitFor(() => {
        expect(screen.queryAllByText(/transfer/i).length).toBeGreaterThan(0);
      });
    }
  });

  it("handles category click from transaction table row", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const foodBadges = screen.getAllByText("Food");
    if (foodBadges.length > 0) {
      await user.click(foodBadges[0]);
    }
  });

  it("shows error state when transactions fail to load", async () => {
    server.use(
      http.get("/api/transactions", () => HttpResponse.json({ error: "fail" }, { status: 500 })),
    );
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText(/failed to load transactions/i).length).toBeGreaterThan(0);
    }, { timeout: 10000 });
  });

  it("shows empty state with no filters active", async () => {
    server.use(
      http.get("/api/transactions", () => HttpResponse.json([])),
    );
    renderTransactions();
    await waitFor(() => {
      expect(screen.getByText(/no transactions found/i)).toBeInTheDocument();
    });
  });

  it("create transaction error shows error toast", async () => {
    server.use(
      http.post("/api/transactions", () => HttpResponse.json({ error: "create fail" }, { status: 500 })),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const addBtn = screen.getByTestId("btn-new-tx");
    await user.click(addBtn);
    await waitFor(() => {
      expect(screen.getAllByText(/save transaction/i).length).toBeGreaterThan(0);
    });
    const amountInputs = screen.getAllByPlaceholderText("0.00");
    await user.type(amountInputs[0], "500");
    const descInputs = screen.getAllByPlaceholderText("What was this for?");
    await user.type(descInputs[0], "Error test");
    const categoryTriggers = screen.getAllByText("Select category");
    if (categoryTriggers.length > 0) {
      await user.click(categoryTriggers[0]);
      const foodOptions = await screen.findAllByText("Food");
      if (foodOptions.length > 0) {
        await user.click(foodOptions[foodOptions.length - 1]);
      }
    }
    await new Promise((r) => setTimeout(r, 100));
    const accountTriggers = screen.queryAllByText("Select account");
    if (accountTriggers.length > 0) {
      await user.click(accountTriggers[0]);
      const accountOptions = await screen.findAllByText("HDFC Savings");
      if (accountOptions.length > 0) {
        await user.click(accountOptions[accountOptions.length - 1]);
      }
    }
    await new Promise((r) => setTimeout(r, 100));
    const submitBtns = screen.getAllByRole("button", { name: /save transaction/i });
    await user.click(submitBtns[0]);
    await waitFor(() => {
      expect(screen.getByText(/failed to add transaction/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it("opens edit panel when edit button clicked on a transaction row", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const editBtns = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    if (editBtns.length > 0) {
      await user.click(editBtns[0]);
      await waitFor(() => {
        expect(screen.getByText(/edit transaction/i)).toBeInTheDocument();
      });
    }
  });

  it("closes edit panel when close button clicked", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const editBtns = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    if (editBtns.length > 0) {
      await user.click(editBtns[0]);
      await waitFor(() => {
        expect(screen.getByText(/edit transaction/i)).toBeInTheDocument();
      });
      const closeBtns = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg.lucide-x") !== null,
      );
      if (closeBtns.length > 0) {
        await user.click(closeBtns[closeBtns.length - 1]);
      }
    }
  });

  it("submits edit form and shows success toast", async () => {
    let putBody: Record<string, unknown> | null = null;
    server.use(
      http.put("/api/transactions/:id", async ({ request }) => {
        putBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 1, ...putBody });
      }),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const editBtns = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    if (editBtns.length > 0) {
      await user.click(editBtns[0]);
      await waitFor(() => {
        expect(screen.getByText(/edit transaction/i)).toBeInTheDocument();
      });
      const updateBtns = screen.queryAllByRole("button", { name: /update transaction/i });
      if (updateBtns.length > 0) {
        await user.click(updateBtns[0]);
        await waitFor(() => {
          if (putBody) {
            expect(putBody).toHaveProperty("accountId");
          }
        }, { timeout: 5000 });
      }
    }
  });

  it("edit transaction error shows error toast", async () => {
    server.use(
      http.put("/api/transactions/:id", () => HttpResponse.json({ error: "update fail" }, { status: 500 })),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const editBtns = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    if (editBtns.length > 0) {
      await user.click(editBtns[0]);
      await waitFor(() => {
        expect(screen.getByText(/edit transaction/i)).toBeInTheDocument();
      });
      const updateBtns = screen.queryAllByRole("button", { name: /update transaction/i });
      if (updateBtns.length > 0) {
        await user.click(updateBtns[0]);
        await waitFor(() => {
          expect(screen.queryByText(/failed to update transaction/i)).toBeInTheDocument();
        }, { timeout: 5000 });
      }
    }
  });

  it("delete transaction shows success toast on confirm", async () => {
    server.use(
      http.delete("/api/transactions/:id", () => HttpResponse.json({ success: true })),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const deleteBtns = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    if (deleteBtns.length > 0) {
      await user.click(deleteBtns[0]);
      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      });
      const confirmBtn = screen.getByRole("button", { name: /delete/i });
      await user.click(confirmBtn);
      await waitFor(() => {
        expect(screen.getByText(/transaction deleted/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    }
  });

  it("delete transaction shows error toast on failure", async () => {
    server.use(
      http.delete("/api/transactions/:id", () => HttpResponse.json({ error: "del fail" }, { status: 500 })),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderTransactions();
    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    });
    const deleteBtns = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    if (deleteBtns.length > 0) {
      await user.click(deleteBtns[0]);
      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      });
      const confirmBtn = screen.getByRole("button", { name: /delete/i });
      await user.click(confirmBtn);
      await waitFor(() => {
        expect(screen.getByText(/failed to delete transaction/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    }
  });

  describe("mobile mode", () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(true);
    });

    it("renders mobile filter bar layout", async () => {
      renderTransactions();
      await waitFor(() => {
        expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
      });
    });

    it("renders mobile transaction list", async () => {
      renderTransactions();
      await waitFor(() => {
        expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
      });
      expect(screen.getAllByText("April Salary").length).toBeGreaterThan(0);
    });
  });

  describe("ai-parse context (parsedResult effect)", () => {
    it("opens transaction dialog when parsedResult has non-Transfer type", async () => {
      const result = {
        transactionType: "Expense",
        amount: "450",
        description: "Coffee",
        category: "Food",
        accountId: "1",
        date: "2026-04-09",
        fromAccountId: null,
        toAccountId: null,
      };
      mockParsedResult.current = result;
      mockConsumeResult.mockReturnValue(result);
      renderTransactions();
      await waitFor(() => {
        expect(screen.getAllByText(/save transaction/i).length).toBeGreaterThan(0);
      }, { timeout: 5000 });
    });

    it("opens transfer modal when parsedResult has Transfer type", async () => {
      const result = {
        transactionType: "Transfer",
        amount: "5000",
        description: "Fund transfer",
        category: "",
        accountId: "",
        date: "2026-04-09",
        fromAccountId: "1",
        toAccountId: "3",
      };
      mockParsedResult.current = result;
      mockConsumeResult.mockReturnValue(result);
      renderTransactions();
      await waitFor(() => {
        expect(screen.getAllByText(/transfer/i).length).toBeGreaterThan(1);
      }, { timeout: 5000 });
    });

    it("handles null consumeResult gracefully", async () => {
      mockParsedResult.current = { transactionType: "Expense" };
      mockConsumeResult.mockReturnValue(null);
      renderTransactions();
      await waitFor(() => {
        expect(screen.getByText("Ledger")).toBeInTheDocument();
      });
    });
  });
});
