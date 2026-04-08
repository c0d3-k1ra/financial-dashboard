import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
});
