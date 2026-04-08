import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { SettingsProvider } from "@/lib/settings-provider";
import { AiParseProvider } from "@/lib/ai-parse-context";
import { ThemeProvider } from "@/lib/theme-context";
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import Budget from "@/pages/budget";
import Goals from "@/pages/goals";
import Accounts from "@/pages/accounts";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <AppLayout>
      <ErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/budget" component={Budget} />
          <Route path="/goals" component={Goals} />
          <Route path="/accounts" component={Accounts} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SettingsProvider>
          <AiParseProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </AiParseProvider>
        </SettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
