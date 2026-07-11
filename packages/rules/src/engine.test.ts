import { describe, expect, it } from "vitest";
import type { RepoFacts } from "@readycheck/scanner";
import { coreRules } from "./core-rules";
import { evaluateRules } from "./engine";

const baseFacts: RepoFacts = {
  rootPath: "/repo",
  languages: ["typescript-or-javascript"],
  packageManager: "pnpm",
  frameworks: [],
  hasDocker: true,
  hasKubernetes: false,
  hasTerraform: false,
  ciProviders: ["github-actions"],
  hasTests: true,
  hasEnvFiles: false,
  hasLicense: true,
};

describe("evaluateRules", () => {
  it("produces no issues when a repo satisfies every core rule", () => {
    const issues = evaluateRules(coreRules, baseFacts);
    expect(issues).toHaveLength(0);
  });

  it("flags a critical issue for missing tests", () => {
    const issues = evaluateRules(coreRules, { ...baseFacts, hasTests: false });
    expect(issues).toContainEqual(
      expect.objectContaining({ ruleId: "TEST-001", severity: "critical" })
    );
  });

  it("flags a critical security issue when .env files are committed", () => {
    const issues = evaluateRules(coreRules, { ...baseFacts, hasEnvFiles: true });
    expect(issues).toContainEqual(
      expect.objectContaining({ ruleId: "SEC-001", severity: "critical" })
    );
  });
});
