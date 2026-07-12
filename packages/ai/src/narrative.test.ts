import { describe, expect, it } from "vitest";
import type { RepoFacts } from "@readycheck/scanner";
import type { AIProvider } from "./provider";
import { generateNarrative } from "./narrative";

const facts: RepoFacts = {
  rootPath: "/repo",
  languages: [],
  packageManager: "unknown",
  frameworks: [],
  hasDocker: false,
  hasKubernetes: false,
  hasTerraform: false,
  ciProviders: [],
  hasTests: false,
  hasEnvFiles: false,
  hasLicense: false,
};

const ctx = { facts, issues: [], categoryScores: [], overallScore: 100, verdict: "Ready" as const };

describe("generateNarrative", () => {
  it("returns null when no provider is configured", async () => {
    expect(await generateNarrative(ctx, undefined)).toBeNull();
  });

  it("returns null instead of throwing when the provider fails", async () => {
    const failingProvider: AIProvider = {
      name: "failing",
      complete: async () => {
        throw new Error("network error");
      },
    };

    expect(await generateNarrative(ctx, failingProvider)).toBeNull();
  });

  it("returns the trimmed provider response on success", async () => {
    const okProvider: AIProvider = {
      name: "ok",
      complete: async () => "  Looks solid.  ",
    };

    expect(await generateNarrative(ctx, okProvider)).toBe("Looks solid.");
  });
});
