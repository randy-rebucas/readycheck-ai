import { afterEach, describe, expect, it } from "vitest";
import { getAIProvider } from "./get-provider";

describe("getAIProvider", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("returns undefined when no API key is configured", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(getAIProvider()).toBeUndefined();
  });

  it("returns an Anthropic provider when a key is present", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const provider = getAIProvider();
    expect(provider?.name).toBe("anthropic");
  });
});
