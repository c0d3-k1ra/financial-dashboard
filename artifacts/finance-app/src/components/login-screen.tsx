import { IndianRupee } from "lucide-react";

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 p-8 max-w-sm w-full">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
          <IndianRupee className="w-9 h-9 text-primary-foreground" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">SurplusEngine</h1>
          <p className="text-muted-foreground text-sm">
            Sign in to manage your finances
          </p>
        </div>
        <button
          onClick={onLogin}
          className="w-full py-3 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          Log in
        </button>
      </div>
    </div>
  );
}
