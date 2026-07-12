import Link from "next/link";
import { notFound } from "next/navigation";
import { getScan } from "../../../lib/api";
import { severityColor, statusColor, verdictColor } from "../../../lib/styles";

export default async function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let scan;
  try {
    scan = await getScan(id);
  } catch {
    notFound();
  }

  const isPending = scan.status === "queued" || scan.status === "active";

  return (
    <main style={{ padding: "3rem", maxWidth: 860, margin: "0 auto" }}>
      <Link href="/" style={{ color: "#666", fontSize: "0.9rem" }}>
        ← All scans
      </Link>

      <h1 style={{ fontFamily: "monospace", fontSize: "1.1rem", marginTop: "0.5rem" }}>
        {scan.path}
      </h1>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1rem 0 2rem" }}>
        <span
          style={{
            fontSize: "0.8rem",
            padding: "0.2rem 0.6rem",
            borderRadius: 999,
            background: statusColor[scan.status] ?? "#666",
            color: "#fff",
          }}
        >
          {scan.status}
        </span>
        {scan.overallScore !== null && (
          <span style={{ fontSize: "1.5rem", fontWeight: 700 }}>{scan.overallScore}%</span>
        )}
        {scan.verdict && (
          <span style={{ color: verdictColor[scan.verdict] ?? "#333", fontWeight: 600 }}>
            {scan.verdict}
          </span>
        )}
      </div>

      {isPending && (
        <p style={{ color: "#666" }}>
          Scan is still {scan.status}. Refresh this page to check for updates.
        </p>
      )}

      {scan.status === "failed" && (
        <p style={{ color: "#dc2626" }}>
          Scan failed{scan.errorMessage ? `: ${scan.errorMessage}` : "."}
        </p>
      )}

      {scan.categoryScores.length > 0 && (
        <>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Category Scores</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginBottom: "2rem" }}>
            {scan.categoryScores.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.5rem 0.75rem",
                  border: "1px solid #eee",
                  borderRadius: 6,
                  fontSize: "0.9rem",
                }}
              >
                <span style={{ textTransform: "capitalize" }}>{c.category}</span>
                <span style={{ fontWeight: 600 }}>{c.score}%</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
        Issues {scan.issues.length > 0 ? `(${scan.issues.length})` : ""}
      </h2>

      {scan.issues.length === 0 && !isPending && (
        <p style={{ color: "#16a34a" }}>No issues found.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {scan.issues.map((issue) => (
          <div key={issue.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: "0.75rem 1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>
                {issue.ruleId} — {issue.message}
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "0.15rem 0.5rem",
                  borderRadius: 999,
                  background: severityColor[issue.severity] ?? "#666",
                  color: "#fff",
                }}
              >
                {issue.severity}
              </span>
            </div>
            <p style={{ color: "#555", fontSize: "0.9rem", margin: "0.4rem 0 0" }}>
              {issue.recommendation}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
