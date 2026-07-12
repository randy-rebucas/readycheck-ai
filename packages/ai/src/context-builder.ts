import type { RepoFacts } from "@readycheck/scanner";
import type { Issue } from "@readycheck/rules";
import type { CategoryScore, Verdict } from "@readycheck/scoring";

export interface ScanContext {
  facts: RepoFacts;
  issues: Issue[];
  categoryScores: CategoryScore[];
  overallScore: number;
  verdict: Verdict;
}

/**
 * Condenses scan results into a compact, structured summary for the LLM.
 * Never includes raw source — only the already-extracted facts/issues, so
 * token usage stays flat regardless of repo size.
 */
export function buildScanSummary(ctx: ScanContext): string {
  const { facts, issues, categoryScores, overallScore, verdict } = ctx;

  const factLines = [
    `Languages: ${facts.languages.join(", ") || "unknown"}`,
    `Package manager: ${facts.packageManager}`,
    `Frameworks: ${facts.frameworks.join(", ") || "none detected"}`,
    `CI providers: ${facts.ciProviders.join(", ") || "none"}`,
    `Docker: ${facts.hasDocker}, Kubernetes: ${facts.hasKubernetes}, Terraform: ${facts.hasTerraform}`,
    `Tests configured: ${facts.hasTests}`,
    `License present: ${facts.hasLicense}`,
    `Committed .env files: ${facts.hasEnvFiles}`,
  ];

  const scoreLines = categoryScores.map((c) => `${c.category}: ${c.score}%`);

  const issueLines =
    issues.length === 0
      ? ["(none)"]
      : issues.map(
          (i) => `[${i.severity.toUpperCase()}] ${i.ruleId} (${i.category}) — ${i.message}`
        );

  return [
    "# Repository Facts",
    ...factLines,
    "",
    "# Category Scores",
    ...scoreLines,
    "",
    `# Overall: ${overallScore}% — ${verdict}`,
    "",
    "# Open Issues",
    ...issueLines,
  ].join("\n");
}

export function buildNarrativePrompt(ctx: ScanContext): string {
  const summary = buildScanSummary(ctx);
  return [
    "You are a CTO performing a production-readiness review. Given the following",
    "automated scan summary (facts, category scores, and open issues — not raw",
    "source code), write a concise narrative (3-6 sentences) that:",
    "1. States the overall readiness verdict and why.",
    "2. Calls out the single highest-priority fix and its business risk.",
    "3. Notes anything encouraging the scan found.",
    "Do not repeat the raw data verbatim — synthesize it.",
    "",
    summary,
  ].join("\n");
}
