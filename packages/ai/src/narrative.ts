import type { AIProvider } from "./provider";
import { buildNarrativePrompt, type ScanContext } from "./context-builder";

/**
 * Best-effort: returns null if no provider is configured or the call fails.
 * Never throws — the deterministic scan result must not depend on this.
 */
export async function generateNarrative(
  ctx: ScanContext,
  provider: AIProvider | undefined
): Promise<string | null> {
  if (!provider) return null;

  try {
    const prompt = buildNarrativePrompt(ctx);
    const text = await provider.complete(prompt);
    return text.trim() || null;
  } catch {
    return null;
  }
}
