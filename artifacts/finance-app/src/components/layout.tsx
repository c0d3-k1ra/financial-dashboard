import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { DollarSign, LayoutDashboard, List, PieChart, ShieldCheck, Landmark, Settings } from "lucide-react";
import { AiParseBubble } from "@/components/ai-parse-bubble";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/transactions", label: "Transactions", icon: List },
    { href: "/budget", label: "Budget", icon: PieChart },
    { href: "/goals", label: "Goals", icon: ShieldCheck },
    { href: "/accounts", label: "Accounts", icon: Landmark },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-[100dvh] mesh-gradient-bg text-foreground flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive 
                      ? "bg-secondary text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 hover:shadow-sm"
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
        
        <div className="md:hidden border-t border-border/40 overflow-x-auto scrollbar-hide">
          <nav className="flex px-4 py-2 gap-2 min-w-max">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive 
                      ? "bg-secondary text-foreground border border-border" 
                      : "text-muted-foreground bg-transparent border border-transparent hover:text-foreground hover:bg-secondary/40 hover:border-border/50"
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

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        {children}
      </main>

      <AiParseBubble />
    </div>
  );
}
