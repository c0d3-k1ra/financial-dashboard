import { Link, useLocation } from "wouter";
import { DollarSign, LayoutDashboard, List, PieChart, ShieldCheck, Landmark, Settings } from "lucide-react";
import { AiParseBubble } from "@/components/ai-parse-bubble";
import { useTheme } from "@/lib/theme-context";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme } = useTheme();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/transactions", label: "Transactions", icon: List },
    { href: "/budget", label: "Budget", icon: PieChart },
    { href: "/goals", label: "Goals", icon: ShieldCheck },
    { href: "/accounts", label: "Accounts", icon: Landmark },
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
      <header className={`sticky top-0 z-40 w-full ${theme.navClassName}`} style={{ isolation: "isolate" }}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">SurplusEngine</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
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
        </div>
        
        <div className="md:hidden border-t nav-mobile-border overflow-x-auto scrollbar-hide" style={{ isolation: "isolate" }}>
          <nav className="flex px-4 py-2 gap-2 min-w-max">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                    isActive 
                      ? "nav-link-active text-foreground nav-link-active-border shadow-sm" 
                      : "text-muted-foreground bg-transparent border border-transparent hover:text-foreground nav-link-hover nav-link-hover-border"
                  }`}
                  data-testid={`nav-mobile-${item.label.toLowerCase()}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8 relative z-10" style={{ isolation: "isolate" }}>
        {children}
      </main>

      <AiParseBubble />
    </div>
  );
}
