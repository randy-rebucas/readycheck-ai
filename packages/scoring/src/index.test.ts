import { describe, expect, it } from "vitest";
import type { Issue } from "@readycheck/rules";
import { scoreIssues } from "./index";

describe("scoreIssues", () => {
  it("scores a clean repo as 100 and Ready", () => {
    const result = scoreIssues([]);
    expect(result.overallScore).toBe(100);
    expect(result.verdict).toBe("Ready");
  });

  it("penalizes a category for a critical issue and lowers the overall score", () => {
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

    const result = scoreIssues(issues);
    const testingScore = result.categoryScores.find((c) => c.category === "testing");

    expect(testingScore?.score).toBe(60);
    expect(result.overallScore).toBeLessThan(100);
  });

  it("drops the verdict below Ready once enough categories are critically broken", () => {
    const issues: Issue[] = [
      {
        ruleId: "TEST-001",
        category: "testing",
        severity: "critical",
        message: "No tests",
        recommendation: "Add tests",
        estimatedEffort: "M",
      },
      {
        ruleId: "SEC-001",
        category: "security",
        severity: "critical",
        message: ".env committed",
        recommendation: "Remove and rotate secrets",
        estimatedEffort: "XS",
      },
    ];

    const result = scoreIssues(issues);

    expect(result.overallScore).toBeLessThan(90);
    expect(result.verdict).not.toBe("Ready");
  });

  it("never lets a category score drop below zero", () => {
    const manyIssues: Issue[] = Array.from({ length: 5 }, (_, i) => ({
      ruleId: `SEC-00${i}`,
      category: "security",
      severity: "critical",
      message: "issue",
      recommendation: "fix",
      estimatedEffort: "S",
    }));

    const result = scoreIssues(manyIssues);
    const securityScore = result.categoryScores.find((c) => c.category === "security");

    expect(securityScore?.score).toBe(0);
  });
});
