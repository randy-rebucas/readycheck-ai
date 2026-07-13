import { describe, expect, it } from "vitest";
import type { ReportInput } from "./types";
import { generateMarkdownReport } from "./markdown";
import { generateCsvReport } from "./csv";
import { generateHtmlReport } from "./html";
import { generateReport } from "./index";

const scan: ReportInput = {
  id: "scan-1",
  path: "https://github.com/org/repo.git",
  sourceType: "git",
  status: "completed",
  overallScore: 86,
  verdict: "Ready with Minor Improvements",
  aiNarrative: "Looks solid overall, tests are the main gap.",
  errorMessage: null,
  createdAt: "2026-07-12T00:00:00.000Z",
  completedAt: "2026-07-12T00:00:05.000Z",
  issues: [
    {
      ruleId: "TEST-001",
      category: "testing",
      severity: "critical",
      message: "No tests",
      recommendation: "Add tests",
      estimatedEffort: "M",
    },
    {
      ruleId: "DOC-001",
      category: "documentation",
      severity: "low",
      message: "No license",
      recommendation: "Add a LICENSE",
      estimatedEffort: "XS",
    },
  ],
  categoryScores: [
    { category: "testing", score: 60 },
    { category: "documentation", score: 96 },
  ],
};

const emptyScan: ReportInput = { ...scan, issues: [], categoryScores: [], aiNarrative: null };

describe("generateMarkdownReport", () => {
  it("includes score, narrative, and issues sorted by severity", () => {
    const md = generateMarkdownReport(scan);
    expect(md).toContain("86% — Ready with Minor Improvements");
    expect(md).toContain("Looks solid overall");
    expect(md.indexOf("TEST-001")).toBeLessThan(md.indexOf("DOC-001"));
  });

  it("renders a 'no issues' placeholder for a clean scan", () => {
    expect(generateMarkdownReport(emptyScan)).toContain("No issues found.");
  });
});

describe("generateCsvReport", () => {
  it("produces one row per issue with escaped fields", () => {
    const csv = generateCsvReport(scan);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("ruleId,category,severity,message,recommendation,estimatedEffort");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("TEST-001");
  });

  it("escapes commas and quotes in fields", () => {
    const withComma: ReportInput = {
      ...scan,
      issues: [
        {
          ruleId: "X-1",
          category: "security",
          severity: "high",
          message: 'Has, a comma and "quotes"',
          recommendation: "Fix it",
          estimatedEffort: "S",
        },
      ],
    };
    const csv = generateCsvReport(withComma);
    expect(csv).toContain('"Has, a comma and ""quotes"""');
  });
});

describe("generateHtmlReport", () => {
  it("escapes HTML-sensitive characters in issue content", () => {
    const withHtml: ReportInput = {
      ...scan,
      issues: [
        {
          ruleId: "X-2",
          category: "security",
          severity: "high",
          message: "<script>alert(1)</script>",
          recommendation: "Sanitize",
          estimatedEffort: "S",
        },
      ],
    };
    const html = generateHtmlReport(withHtml);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("generateReport", () => {
  it("dispatches to the correct format", async () => {
    expect(await generateReport(scan, "json")).toContain('"id": "scan-1"');
    expect(await generateReport(scan, "markdown")).toContain("# ReadyCheck AI");
    expect(await generateReport(scan, "csv")).toContain("ruleId,category");
    expect(await generateReport(scan, "html")).toContain("<!doctype html>");
  });

  it("generates a non-empty PDF buffer", async () => {
    const pdf = await generateReport(scan, "pdf");
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect((pdf as Buffer).length).toBeGreaterThan(0);
    // PDF magic bytes.
    expect((pdf as Buffer).subarray(0, 4).toString()).toBe("%PDF");
  });
});
