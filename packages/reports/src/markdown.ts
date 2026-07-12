import type { ReportInput } from "./types";

const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

export function generateMarkdownReport(scan: ReportInput): string {
  const lines: string[] = [];

  lines.push(`# ReadyCheck AI — Production Readiness Report`);
  lines.push("");
  lines.push(`**Target:** \`${scan.path}\``);
  lines.push(`**Scan ID:** ${scan.id}`);
  lines.push(`**Status:** ${scan.status}`);
  lines.push(`**Generated:** ${new Date(scan.createdAt).toISOString()}`);
  lines.push("");

  if (scan.overallScore !== null && scan.verdict) {
    lines.push(`## Overall Score: ${scan.overallScore}% — ${scan.verdict}`);
    lines.push("");
  }

  if (scan.errorMessage) {
    lines.push(`## Error`);
    lines.push("");
    lines.push("```");
    lines.push(scan.errorMessage);
    lines.push("```");
    lines.push("");
  }

  if (scan.aiNarrative) {
    lines.push(`## AI Assessment`);
    lines.push("");
    lines.push(scan.aiNarrative);
    lines.push("");
  }

  if (scan.categoryScores.length > 0) {
    lines.push(`## Category Scores`);
    lines.push("");
    lines.push("| Category | Score |");
    lines.push("|---|---|");
    for (const c of scan.categoryScores) {
      lines.push(`| ${c.category} | ${c.score}% |`);
    }
    lines.push("");
  }

  lines.push(`## Issues (${scan.issues.length})`);
  lines.push("");

  if (scan.issues.length === 0) {
    lines.push("No issues found.");
  } else {
    const sorted = [...scan.issues].sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
    );
    for (const issue of sorted) {
      lines.push(`### [${issue.severity.toUpperCase()}] ${issue.ruleId} — ${issue.message}`);
      lines.push("");
      lines.push(`- **Category:** ${issue.category}`);
      lines.push(`- **Estimated effort:** ${issue.estimatedEffort}`);
      lines.push(`- **Recommendation:** ${issue.recommendation}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}
