import { IndianRupee, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  return (
    <div className="min-h-[100dvh] glass-ui text-foreground flex flex-col items-center justify-center relative overflow-hidden">
      <div className="frost-wash-mint" aria-hidden="true" />
      <div className="frost-wash-peach" aria-hidden="true" />
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

      <div className="glass-card rounded-2xl p-8 md:p-12 max-w-md w-full mx-4 text-center space-y-8 glass-animate-in relative z-10">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <IndianRupee className="w-9 h-9 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">SurplusEngine</h1>
            <p className="text-muted-foreground text-sm mt-2">
              Track expenses, plan budgets, and grow your savings
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Button
            onClick={onLogin}
            size="lg"
            className="w-full font-semibold text-base gap-2"
          >
            <LogIn className="w-5 h-5" />
            Log in
          </Button>
          <p className="text-xs text-muted-foreground">
            Sign in to access your financial dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
