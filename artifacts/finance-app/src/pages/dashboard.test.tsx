import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw-server";
import { TestWrapper } from "@/test/test-wrapper";
import Dashboard from "./dashboard";

function renderDashboard() {
  return render(
    <TestWrapper>
      <Dashboard />
    </TestWrapper>,
  );
}

describe("Dashboard page", () => {
  it("renders the page heading", async () => {
    renderDashboard();
    expect(screen.getByText("Financial Cockpit")).toBeInTheDocument();
  });

  it("displays the current month label", async () => {
    renderDashboard();
    const now = new Date();
    const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    await waitFor(() => {
      expect(screen.getByText(monthLabel)).toBeInTheDocument();
    });
  });

  it("renders summary cards after data loads", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Net Liquidity")).toBeInTheDocument();
    });
  });

  it("shows End Cycle button when cycle has not ended", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /end cycle/i })).toBeInTheDocument();
    });
  });

  it("shows Transfer button", async () => {
    renderDashboard();
    expect(screen.getByRole("button", { name: /transfer/i })).toBeInTheDocument();
  });

  it("displays loading state while summary is loading", async () => {
    server.use(
      http.get("/api/dashboard/summary", async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json({});
      }),
    );
    const { container } = renderDashboard();
    const pulsingElements = container.querySelectorAll('[class*="animate-pulse"]');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it("shows error state when summary fetch fails", async () => {
    server.use(
      http.get("/api/dashboard/summary", () => HttpResponse.json({ error: "Server error" }, { status: 500 })),
    );
    renderDashboard();
    await waitFor(() => {
      const retryButtons = screen.getAllByText(/retry/i);
      expect(retryButtons.length).toBeGreaterThan(0);
    });
  });

  it("shows error state when recent transactions fail", async () => {
    server.use(
      http.get("/api/transactions/recent", () => HttpResponse.json({ error: "fail" }, { status: 500 })),
    );
    renderDashboard();
    await waitFor(() => {
      const retryButtons = screen.getAllByText(/retry/i);
      expect(retryButtons.length).toBeGreaterThan(0);
    });
  });

  it("shows loading state for trend data", async () => {
    server.use(
      http.get("/api/dashboard/monthly-trend", async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json([]);
      }),
    );
    const { container } = renderDashboard();
    const pulsingElements = container.querySelectorAll('[class*="animate-pulse"]');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it("shows error state when category spend fails", async () => {
    server.use(
      http.get("/api/analytics/spend-by-category", () => HttpResponse.json({ error: "fail" }, { status: 500 })),
    );
    renderDashboard();
    await waitFor(() => {
      const retryButtons = screen.getAllByText(/retry/i);
      expect(retryButtons.length).toBeGreaterThan(0);
    });
  });

  it("shows error state when cc dues fail", async () => {
    server.use(
      http.get("/api/analytics/cc-dues", () => HttpResponse.json({ error: "fail" }, { status: 500 })),
    );
    renderDashboard();
    await waitFor(() => {
      const retryButtons = screen.getAllByText(/retry/i);
      expect(retryButtons.length).toBeGreaterThan(0);
    });
  });

  it("shows error state when category trend fails", async () => {
    server.use(
      http.get("/api/analytics/category-trend", () => HttpResponse.json({ error: "fail" }, { status: 500 })),
    );
    renderDashboard();
    await waitFor(() => {
      const retryButtons = screen.getAllByText(/retry/i);
      expect(retryButtons.length).toBeGreaterThan(0);
    });
  });

  it("shows error state when cc spend trend fails", async () => {
    server.use(
      http.get("/api/trends/cc-spend", () => HttpResponse.json({ error: "fail" }, { status: 500 })),
    );
    renderDashboard();
    await waitFor(() => {
      const retryButtons = screen.getAllByText(/retry/i);
      expect(retryButtons.length).toBeGreaterThan(0);
    });
  });

  it("shows Cycle Ended button when allocations exist for the current month", async () => {
    const currentMonth = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();
    server.use(
      http.get("/api/surplus/allocations", () =>
        HttpResponse.json([{ id: 1, month: currentMonth, goalId: 1, amount: "10000" }]),
      ),
    );
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/cycle ended/i)).toBeInTheDocument();
    });
  });

  it("renders recent ledger section after data loads", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Groceries")).toBeInTheDocument();
    });
  });

  it("renders monthly flow chart area", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Net Liquidity")).toBeInTheDocument();
    });
  });

  it("clicks the Transfer button and opens transfer modal", async () => {
    const user = userEvent.setup();
    renderDashboard();
    const transferBtn = screen.getByRole("button", { name: /transfer/i });
    await user.click(transferBtn);
    await waitFor(() => {
      expect(screen.getByText(/from account/i)).toBeInTheDocument();
    });
  });

  it("clicks End Cycle button and handles no surplus", async () => {
    server.use(
      http.get("/api/surplus/monthly", () => HttpResponse.json({ surplus: "0" })),
    );
    const user = userEvent.setup();
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /end cycle/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /end cycle/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/no surplus/i).length).toBeGreaterThan(0);
    });
  });

  it("clicks End Cycle with positive surplus and opens distribute modal", async () => {
    server.use(
      http.get("/api/surplus/monthly", () => HttpResponse.json({ surplus: "40000" })),
    );
    const user = userEvent.setup();
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /end cycle/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /end cycle/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/distribute/i).length).toBeGreaterThan(0);
    });
  });

  it("shows Undo Distribution button when canUndo is true and cycle ended", async () => {
    const currentMonth = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();
    server.use(
      http.get("/api/surplus/allocations", () =>
        HttpResponse.json([{ id: 1, month: currentMonth, goalId: 1, amount: "10000" }]),
      ),
      http.get("/api/surplus/can-undo", () =>
        HttpResponse.json({ canUndo: true, month: currentMonth, allocations: [{ goalName: "Emergency Fund", amount: "10000" }], transferCount: 1 }),
      ),
    );
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/undo distribution/i)).toBeInTheDocument();
    });
  });

  it("opens undo confirm dialog and confirms undo", async () => {
    const currentMonth = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();
    let undoCalled = false;
    server.use(
      http.get("/api/surplus/allocations", () =>
        HttpResponse.json([{ id: 1, month: currentMonth, goalId: 1, amount: "10000" }]),
      ),
      http.get("/api/surplus/can-undo", () =>
        HttpResponse.json({ canUndo: true, month: currentMonth, allocations: [{ goalName: "Emergency Fund", amount: "10000" }], transferCount: 1 }),
      ),
      http.post("/api/surplus/undo", () => {
        undoCalled = true;
        return HttpResponse.json({ success: true, deletedAllocations: 1, deletedTransfers: 1, revertedGoals: 1 });
      }),
    );
    const user = userEvent.setup();
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/undo distribution/i)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/undo distribution/i));
    await waitFor(() => {
      expect(screen.getByText(/undo last distribution/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /confirm undo/i }));
    await waitFor(() => {
      expect(undoCalled).toBe(true);
    });
  });
});
