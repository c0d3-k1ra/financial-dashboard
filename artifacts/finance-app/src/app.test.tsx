import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router as WouterRouter, Switch, Route } from "wouter";
import { ThemeProvider } from "@/lib/theme-context";
import { SettingsProvider } from "@/lib/settings-provider";
import { AiParseProvider } from "@/lib/ai-parse-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { AppLayout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import Accounts from "@/pages/accounts";

function renderAppWithRouter(initialPath = "/") {
  window.history.pushState({}, "", initialPath);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  const setLocation = (path: string) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const result = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SettingsProvider>
          <AiParseProvider>
            <TooltipProvider>
              <WouterRouter base="">
                <AppLayout>
                  <Switch>
                    <Route path="/" component={Dashboard} />
                    <Route path="/transactions" component={Transactions} />
                    <Route path="/accounts" component={Accounts} />
                  </Switch>
                </AppLayout>
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </AiParseProvider>
        </SettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );

  return { ...result, setLocation };
}

describe("App navigation", () => {
  it("renders the dashboard page by default at /", async () => {
    renderAppWithRouter("/");
    await waitFor(() => {
      expect(screen.getByText("Financial Cockpit")).toBeInTheDocument();
    });
  });

  it("renders the navigation sidebar/bar with key links", async () => {
    renderAppWithRouter("/");
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Transactions").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Accounts").length).toBeGreaterThan(0);
  });

  it("navigates to transactions page when clicking the Transactions nav link", async () => {
    const user = userEvent.setup();
    renderAppWithRouter("/");
    const transactionsLinks = screen.getAllByText("Transactions");
    const navLink = transactionsLinks.find((el) => el.closest("a"));
    expect(navLink).toBeDefined();
    await user.click(navLink!);
    await waitFor(() => {
      expect(screen.getByText("Ledger")).toBeInTheDocument();
    });
  });

  it("navigates to accounts page when clicking the Accounts nav link", async () => {
    const user = userEvent.setup();
    renderAppWithRouter("/");
    const accountsLinks = screen.getAllByText("Accounts");
    const navLink = accountsLinks.find((el) => el.closest("a"));
    expect(navLink).toBeDefined();
    await user.click(navLink!);
    await waitFor(() => {
      expect(screen.getByText("Manage Accounts")).toBeInTheDocument();
    });
  });

  it("navigates back to dashboard from transactions", async () => {
    const user = userEvent.setup();
    renderAppWithRouter("/");
    const txLinks = screen.getAllByText("Transactions");
    await user.click(txLinks.find((el) => el.closest("a"))!);
    await waitFor(() => {
      expect(screen.getByText("Ledger")).toBeInTheDocument();
    });
    const dashLinks = screen.getAllByText("Dashboard");
    await user.click(dashLinks.find((el) => el.closest("a"))!);
    await waitFor(() => {
      expect(screen.getByText("Financial Cockpit")).toBeInTheDocument();
    });
  });
});

describe("App component (actual)", () => {
  it("renders the actual App component without errors and shows Financial Cockpit", async () => {
    const { default: App } = await import("./App");
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Financial Cockpit")).toBeInTheDocument();
    });
  });
});
