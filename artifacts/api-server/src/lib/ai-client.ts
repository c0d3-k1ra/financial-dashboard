let anthropicClient: Awaited<ReturnType<typeof import("@workspace/integrations-anthropic-ai")>>["anthropic"] | null = null;

export async function getAnthropicClient() {
  if (!anthropicClient) {
    try {
      const mod = await import("@workspace/integrations-anthropic-ai");
      anthropicClient = mod.anthropic;
    } catch {
      throw new Error("AI integration is not configured. Please ensure Anthropic environment variables are set.");
    }
  }
  return anthropicClient;
}
