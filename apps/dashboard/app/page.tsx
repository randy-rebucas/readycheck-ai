import Link from "next/link";
import { listScans } from "../lib/api";
import { statusColor, verdictColor } from "../lib/styles";
import { triggerScanAction } from "./actions";

export default async function HomePage() {
  let scans: Awaited<ReturnType<typeof listScans>> = [];
  let apiError: string | null = null;

  try {
    scans = await listScans();
  } catch (err) {
    apiError = err instanceof Error ? err.message : "Failed to reach the ReadyCheck API";
  }

  return (
    <main style={{ padding: "3rem", maxWidth: 860, margin: "0 auto" }}>
      <h1>ReadyCheck AI</h1>
      <p style={{ color: "#666" }}>
        AI-powered production readiness platform. Trigger a scan of a public
        git repository (or a local path) to get a scored readiness verdict.
      </p>

      <form
        action={triggerScanAction}
        style={{ display: "flex", gap: "0.5rem", margin: "1.5rem 0 2.5rem" }}
      >
        <input
          name="path"
          placeholder="https://github.com/org/repo.git or a local path"
          required
          style={{
            flex: 1,
            padding: "0.6rem 0.8rem",
            border: "1px solid #ccc",
            borderRadius: 6,
            fontSize: "0.95rem",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "0.6rem 1.2rem",
            border: "none",
            borderRadius: 6,
            background: "#111",
            color: "#fff",
            fontSize: "0.95rem",
            cursor: "pointer",
          }}
        >
          Run Scan
        </button>
      </form>

      {apiError && (
        <p style={{ color: "#dc2626" }}>
          Could not reach the API ({apiError}). Is <code>apps/api</code> running?
        </p>
      )}

      <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Recent Scans</h2>

      {scans.length === 0 && !apiError && (
        <p style={{ color: "#666" }}>No scans yet — run one above.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {scans.map((scan) => (
          <Link
            key={scan.id}
            href={`/scans/${scan.id}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.75rem 1rem",
              border: "1px solid #e5e5e5",
              borderRadius: 8,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div>
              <div style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{scan.path}</div>
              <div style={{ fontSize: "0.75rem", color: "#888" }}>
                {new Date(scan.createdAt).toLocaleString()}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {scan.overallScore !== null && (
                <span style={{ fontWeight: 600 }}>{scan.overallScore}%</span>
              )}
              {scan.verdict && (
                <span style={{ color: verdictColor[scan.verdict] ?? "#333", fontSize: "0.85rem" }}>
                  {scan.verdict}
                </span>
              )}
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "0.15rem 0.5rem",
                  borderRadius: 999,
                  background: statusColor[scan.status] ?? "#666",
                  color: "#fff",
                }}
              >
                {scan.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
