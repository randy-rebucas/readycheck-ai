import { describe, expect, it } from "vitest";
import type { RepoFacts } from "@readycheck/scanner";
import type { Issue } from "@readycheck/rules";
import { buildScanSummary, buildNarrativePrompt } from "./context-builder";

const facts: RepoFacts = {
  rootPath: "/repo",
  languages: ["typescript-or-javascript"],
  packageManager: "pnpm",
  frameworks: ["nextjs"],
  hasDocker: false,
  hasKubernetes: false,
  hasTerraform: false,
  ciProviders: [],
  hasTests: false,
  hasEnvFiles: false,
  hasLicense: true,
};

const issues: Issue[] = [
  {
    ruleId: "TEST-001",
    category: "testing",
    severity: "critical",
    message: "No tests",
    recommendation: "Add tests",
    estimatedEffort: "M",
  },
];

describe("buildScanSummary", () => {
  it("includes facts, scores, and issues without leaking raw source", () => {
    const summary = buildScanSummary({
      facts,
      issues,
      categoryScores: [{ category: "testing", score: 60 }],
      overallScore: 92,
      verdict: "Ready",
    });

    expect(summary).toContain("nextjs");
    expect(summary).toContain("testing: 60%");
    expect(summary).toContain("TEST-001");
    expect(summary).toContain("Overall: 92% — Ready");
  });

  it("renders a placeholder when there are no issues", () => {
    const summary = buildScanSummary({
      facts,
      issues: [],
      categoryScores: [],
      overallScore: 100,
      verdict: "Ready",
    });

    expect(summary).toContain("(none)");
  });
});

describe("buildNarrativePrompt", () => {
  it("wraps the summary with CTO-review framing instructions", () => {
    const prompt = buildNarrativePrompt({
      facts,
      issues,
      categoryScores: [],
      overallScore: 80,
      verdict: "Ready with Minor Improvements",
    });

    expect(prompt).toContain("production-readiness review");
    expect(prompt).toContain("TEST-001");
  });
});
