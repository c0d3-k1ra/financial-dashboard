import { Eye, EyeOff } from "lucide-react";
import { usePrivacy } from "@/lib/privacy-context";

interface PrivacyToggleProps {
  className?: string;
}

export function PrivacyToggle({ className = "" }: PrivacyToggleProps) {
  const { isHidden, toggleVisibility } = usePrivacy();

  return (
    <button
      onClick={toggleVisibility}
      className={`inline-flex items-center justify-center w-9 h-9 min-w-[44px] min-h-[44px] rounded-lg transition-colors bg-black/5 dark:bg-white/10 backdrop-blur-sm hover:bg-black/10 dark:hover:bg-white/15 active:bg-black/15 dark:active:bg-white/20 text-muted-foreground hover:text-foreground ${className}`}
      aria-label={isHidden ? "Show sensitive values" : "Hide sensitive values"}
      data-testid="privacy-toggle"
      title={isHidden ? "Show values" : "Hide values"}
    >
      {isHidden ? (
        <EyeOff className="w-4.5 h-4.5" />
      ) : (
        <Eye className="w-4.5 h-4.5" />
      )}
    </button>
  );
}
