import PDFDocument from "pdfkit";
import type { ReportInput } from "./types";

const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#d97706",
  low: "#2563eb",
};

export function generatePdfReport(scan: ReportInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("ReadyCheck AI — Production Readiness Report", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#444444");
    doc.text(`Target: ${scan.path}`);
    doc.text(`Scan ID: ${scan.id}`);
    doc.text(`Status: ${scan.status}`);
    doc.text(`Generated: ${new Date(scan.createdAt).toISOString()}`);
    doc.fillColor("#000000");
    doc.moveDown();

    if (scan.overallScore !== null && scan.verdict) {
      doc.fontSize(16).text(`Overall Score: ${scan.overallScore}% — ${scan.verdict}`);
      doc.moveDown();
    }

    if (scan.errorMessage) {
      doc.fontSize(14).text("Error");
      doc.fontSize(10).text(scan.errorMessage);
      doc.moveDown();
    }

    if (scan.aiNarrative) {
      doc.fontSize(14).text("AI Assessment");
      doc.fontSize(10).text(scan.aiNarrative);
      doc.moveDown();
    }

    if (scan.categoryScores.length > 0) {
      doc.fontSize(14).text("Category Scores");
      doc.fontSize(10);
      for (const c of scan.categoryScores) {
        doc.text(`${c.category}: ${c.score}%`);
      }
      doc.moveDown();
    }

    doc.fontSize(14).text(`Issues (${scan.issues.length})`);
    doc.moveDown(0.3);

    if (scan.issues.length === 0) {
      doc.fontSize(10).text("No issues found.");
    } else {
      const sorted = [...scan.issues].sort(
        (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      );
      for (const issue of sorted) {
        doc
          .fontSize(11)
          .fillColor(SEVERITY_COLORS[issue.severity] ?? "#000000")
          .text(`[${issue.severity.toUpperCase()}] ${issue.ruleId} — ${issue.message}`);
        doc.fillColor("#000000").fontSize(9);
        doc.text(`Category: ${issue.category}`);
        doc.text(`Estimated effort: ${issue.estimatedEffort}`);
        doc.text(`Recommendation: ${issue.recommendation}`);
        doc.moveDown(0.5);
      }
    }

    doc.end();
  });
}
