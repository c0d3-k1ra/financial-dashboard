import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw-server";
import { ApiHealthIndicator } from "./api-health-indicator";

describe("ApiHealthIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows loading state initially", () => {
    server.use(
      http.get("/api/healthz", async () => {
        await new Promise(() => {});
        return HttpResponse.json({ status: "ok" });
      }),
    );
    render(<ApiHealthIndicator />);
    expect(screen.getByText("Checking…")).toBeInTheDocument();
  });

  it("shows connected status when API responds ok", async () => {
    render(<ApiHealthIndicator />);
    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });
  });

  it("shows disconnected status when API fails", async () => {
    server.use(
      http.get("/api/healthz", () => HttpResponse.error()),
    );
    render(<ApiHealthIndicator />);
    await waitFor(() => {
      expect(screen.getByText("Disconnected")).toBeInTheDocument();
    });
  });

  it("shows disconnected status on non-ok response", async () => {
    server.use(
      http.get("/api/healthz", () => HttpResponse.json({ status: "error" }, { status: 500 })),
    );
    render(<ApiHealthIndicator />);
    await waitFor(() => {
      expect(screen.getByText("Disconnected")).toBeInTheDocument();
    });
  });

  it("re-polls periodically", async () => {
    let callCount = 0;
    server.use(
      http.get("/api/healthz", () => {
        callCount++;
        return HttpResponse.json({ status: "ok" });
      }),
    );
    render(<ApiHealthIndicator pollIntervalMs={1000} />);
    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });
    expect(callCount).toBe(1);

    vi.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(callCount).toBeGreaterThanOrEqual(2);
    });
  });

  it("aborts in-flight fetch on unmount", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    const { unmount } = render(<ApiHealthIndicator />);
    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });
    unmount();
    expect(abortSpy).toHaveBeenCalled();
    abortSpy.mockRestore();
  });
});
