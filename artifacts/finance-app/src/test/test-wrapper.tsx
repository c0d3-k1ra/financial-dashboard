import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router as WouterRouter } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-context";
import { SettingsProvider } from "@/lib/settings-provider";
import { AiParseProvider } from "@/lib/ai-parse-context";
import { Toaster } from "@/components/ui/toaster";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SettingsProvider>
          <AiParseProvider>
            <TooltipProvider>
              <WouterRouter base="">
                {children}
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </AiParseProvider>
        </SettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
