import type { ReportInput } from "./types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function generateHtmlReport(scan: ReportInput): string {
  const issueRows = scan.issues
    .map(
      (i) => `
        <tr>
          <td>${escapeHtml(i.severity)}</td>
          <td>${escapeHtml(i.ruleId)}</td>
          <td>${escapeHtml(i.category)}</td>
          <td>${escapeHtml(i.message)}</td>
          <td>${escapeHtml(i.recommendation)}</td>
        </tr>`
    )
    .join("");

  const scoreRows = scan.categoryScores
    .map((c) => `<tr><td>${escapeHtml(c.category)}</td><td>${c.score}%</td></tr>`)
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>ReadyCheck AI Report — ${escapeHtml(scan.path)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 2rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; font-size: 0.9rem; }
    th { background: #f5f5f5; }
    h1 { font-size: 1.4rem; }
  </style>
</head>
<body>
  <h1>ReadyCheck AI — Production Readiness Report</h1>
  <p><strong>Target:</strong> <code>${escapeHtml(scan.path)}</code></p>
  <p><strong>Status:</strong> ${escapeHtml(scan.status)}</p>
  ${scan.overallScore !== null && scan.verdict ? `<h2>Overall Score: ${scan.overallScore}% — ${escapeHtml(scan.verdict)}</h2>` : ""}
  ${scan.aiNarrative ? `<h2>AI Assessment</h2><p>${escapeHtml(scan.aiNarrative)}</p>` : ""}
  ${scan.categoryScores.length > 0 ? `<h2>Category Scores</h2><table><tr><th>Category</th><th>Score</th></tr>${scoreRows}</table>` : ""}
  <h2>Issues (${scan.issues.length})</h2>
  ${
    scan.issues.length === 0
      ? "<p>No issues found.</p>"
      : `<table><tr><th>Severity</th><th>Rule</th><th>Category</th><th>Message</th><th>Recommendation</th></tr>${issueRows}</table>`
  }
</body>
</html>`;
}
