import { useState, useEffect } from "react";

type HealthStatus = "loading" | "connected" | "disconnected";

const DEFAULT_POLL_INTERVAL_MS = 30_000;

interface ApiHealthIndicatorProps {
  pollIntervalMs?: number;
}

export function ApiHealthIndicator({ pollIntervalMs = DEFAULT_POLL_INTERVAL_MS }: ApiHealthIndicatorProps) {
  const [status, setStatus] = useState<HealthStatus>("loading");

  useEffect(() => {
    const controller = new AbortController();

    async function checkHealth() {
      try {
        const res = await fetch("/api/healthz", { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status === "ok" ? "connected" : "disconnected");
        } else {
          setStatus("disconnected");
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setStatus("disconnected");
      }
    }

    checkHealth();
    const id = setInterval(checkHealth, pollIntervalMs);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [pollIntervalMs]);

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          status === "connected"
            ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
            : status === "disconnected"
              ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
              : "bg-muted-foreground animate-pulse"
        }`}
      />
      <span className="text-xs text-muted-foreground">
        {status === "connected"
          ? "Connected"
          : status === "disconnected"
            ? "Disconnected"
            : "Checking…"}
      </span>
    </div>
  );
}
