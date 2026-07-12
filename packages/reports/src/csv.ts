import type { ReportInput } from "./types";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** One row per issue -- the CSV export is meant for spreadsheet triage, not the score summary. */
export function generateCsvReport(scan: ReportInput): string {
  const header = ["ruleId", "category", "severity", "message", "recommendation", "estimatedEffort"];
  const rows = scan.issues.map((issue) =>
    [issue.ruleId, issue.category, issue.severity, issue.message, issue.recommendation, issue.estimatedEffort]
      .map(csvEscape)
      .join(",")
  );

  return [header.join(","), ...rows].join("\n");
}
