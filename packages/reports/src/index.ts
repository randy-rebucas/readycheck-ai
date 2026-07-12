export * from "./types";
export * from "./markdown";
export * from "./csv";
export * from "./html";

import type { ReportInput } from "./types";
import { generateMarkdownReport } from "./markdown";
import { generateCsvReport } from "./csv";
import { generateHtmlReport } from "./html";

export type ReportFormat = "json" | "markdown" | "csv" | "html";

export const REPORT_CONTENT_TYPES: Record<ReportFormat, string> = {
  json: "application/json",
  markdown: "text/markdown",
  csv: "text/csv",
  html: "text/html",
};

export function generateReport(scan: ReportInput, format: ReportFormat): string {
  switch (format) {
    case "json":
      return JSON.stringify(scan, null, 2);
    case "markdown":
      return generateMarkdownReport(scan);
    case "csv":
      return generateCsvReport(scan);
    case "html":
      return generateHtmlReport(scan);
  }
}
