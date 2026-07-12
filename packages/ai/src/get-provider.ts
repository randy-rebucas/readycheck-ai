import type { AIProvider } from "./provider";
import { AnthropicProvider } from "./providers/anthropic";

/**
 * Returns a configured AI provider, or undefined if none is configured.
 * Callers must treat AI narrative generation as best-effort: the platform's
 * deterministic score/verdict never depends on this being available.
 */
export function getAIProvider(): AIProvider | undefined {
  const provider = process.env.AI_PROVIDER ?? "anthropic";

  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return undefined;
    return new AnthropicProvider(apiKey, process.env.AI_MODEL);
  }

  return undefined;
}
