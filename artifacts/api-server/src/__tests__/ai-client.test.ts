import { describe, it, expect, vi } from "vitest";

const mockAnthropic = { messages: { create: vi.fn() } };

vi.mock("@workspace/integrations-anthropic-ai", () => ({
  anthropic: mockAnthropic,
}));

describe("getAnthropicClient", () => {
  it("returns the anthropic client", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    const client = await getAnthropicClient();
    expect(client).toBeDefined();
    expect(client).toBe(mockAnthropic);
  });

  it("returns cached client on second call", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    const first = await getAnthropicClient();
    const second = await getAnthropicClient();
    expect(first).toBe(second);
  });
});
