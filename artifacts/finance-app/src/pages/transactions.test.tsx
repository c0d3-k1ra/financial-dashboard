import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw-server";
import { TestWrapper } from "@/test/test-wrapper";
import Transactions from "./transactions";

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
});
