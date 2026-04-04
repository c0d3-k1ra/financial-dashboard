import { Link, useLocation } from "wouter";
import { DollarSign, LayoutDashboard, List, PieChart, ShieldCheck, Landmark, Settings } from "lucide-react";
import { AiParseBubble } from "@/components/ai-parse-bubble";
import { useTheme } from "@/lib/theme-context";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme } = useTheme();

  const mainNavItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/transactions", label: "Transactions", icon: List },
    { href: "/budget", label: "Budget", icon: PieChart },
    { href: "/goals", label: "Goals", icon: ShieldCheck },
    { href: "/accounts", label: "Accounts", icon: Landmark },
  ];

  const allNavItems = [
    ...mainNavItems,
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className={`min-h-[100dvh] ${theme.rootClassName} text-foreground flex flex-col relative`}>
      <div className="frost-wash-mint" aria-hidden="true" />
      <div className="frost-wash-peach" aria-hidden="true" />
      {theme.id === "glass-ui" && (
        <div className="ambient-orb-teal" aria-hidden="true" style={{
          position: "fixed",
          width: "20vw",
          height: "20vw",
          left: "10%",
          top: "50%",
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: -1,
          filter: "blur(120px)",
          background: "radial-gradient(circle, rgba(45, 212, 191, 0.05) 0%, transparent 70%)",
        }} />
      )}
      <header className={`sticky top-0 z-40 w-full ${theme.navClassName}`} style={{ isolation: "isolate", paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">SurplusEngine</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-1">
            {allNavItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    isActive 
                      ? "nav-link-active text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground nav-link-hover"
                  }`}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/settings"
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            data-testid="nav-mobile-settings"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8 relative z-10" style={{ isolation: "isolate" }}>
        {children}
      </main>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 mobile-bottom-tab-bar"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around h-16 px-1">
          {mainNavItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
                data-testid={`nav-mobile-${item.label.toLowerCase()}`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "drop-shadow-sm" : ""}`} />
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <AiParseBubble />
    </div>
  );
}
