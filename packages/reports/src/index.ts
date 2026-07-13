export * from "./types";
export * from "./markdown";
export * from "./csv";
export * from "./html";
export * from "./pdf";

import type { ReportInput } from "./types";
import { generateMarkdownReport } from "./markdown";
import { generateCsvReport } from "./csv";
import { generateHtmlReport } from "./html";
import { generatePdfReport } from "./pdf";

export type ReportFormat = "json" | "markdown" | "csv" | "html" | "pdf";

export const REPORT_CONTENT_TYPES: Record<ReportFormat, string> = {
  json: "application/json",
  markdown: "text/markdown",
  csv: "text/csv",
  html: "text/html",
  pdf: "application/pdf",
};

export async function generateReport(scan: ReportInput, format: ReportFormat): Promise<string | Buffer> {
  switch (format) {
    case "json":
      return JSON.stringify(scan, null, 2);
    case "markdown":
      return generateMarkdownReport(scan);
    case "csv":
      return generateCsvReport(scan);
    case "html":
      return generateHtmlReport(scan);
    case "pdf":
      return generatePdfReport(scan);
  }
}
