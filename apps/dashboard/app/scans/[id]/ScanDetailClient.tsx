"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ScanDetail } from "../../../lib/api";
import { severityColor, statusColor, verdictColor } from "../../../lib/styles";

const progressLabels: Record<string, string> = {
  cloning: "Cloning repository",
  scanning: "Scanning files",
  evaluating_rules: "Evaluating rules",
  evaluating_plugins: "Checking plugins",
  scoring: "Scoring results",
  ai_narrative: "Generating AI assessment",
  persisting: "Saving results",
  done: "Finishing up",
};

const progressStages = [
  "cloning",
  "scanning",
  "evaluating_rules",
  "evaluating_plugins",
  "scoring",
  "ai_narrative",
  "persisting",
  "done",
] as const;

const scanningFiles = [
  "package.json",
  "src/index.ts",
  "README.md",
  "tsconfig.json",
  "src/app/page.tsx",
  "src/lib/api.ts",
];

interface ScanDetailWithProgress extends ScanDetail {
  progress?: string | null;
}

interface ScanDetailClientProps {
  initialScan: ScanDetailWithProgress;
}

export default function ScanDetailClient({ initialScan }: ScanDetailClientProps) {
  const [scan, setScan] = useState<ScanDetailWithProgress>(initialScan);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isPending = scan.status === "queued" || scan.status === "active";

  const progressText = useMemo(() => {
    if (scan.progress) {
      return progressLabels[scan.progress] ?? String(scan.progress);
    }
    if (scan.status === "queued") {
      return "Waiting to start";
    }
    if (scan.status === "active") {
      return "Starting scan";
    }
    return null;
  }, [scan.progress, scan.status]);

  const progressValue = useMemo(() => {
    if (scan.progress) {
      const index = progressStages.indexOf(scan.progress as (typeof progressStages)[number]);
      return index === -1 ? 100 : Math.round(((index + 1) / progressStages.length) * 100);
    }
    if (scan.status === "active") return 30;
    if (scan.status === "queued") return 10;
    return 0;
  }, [scan.progress, scan.status]);

  const currentStageIndex = useMemo(() => {
    if (scan.progress) {
      return progressStages.indexOf(scan.progress as (typeof progressStages)[number]);
    }
    if (scan.status === "active") return 1;
    if (scan.status === "queued") return 0;
    return -1;
  }, [scan.progress, scan.status]);

  const [scanTick, setScanTick] = useState(0);

  useEffect(() => {
    if (!isPending) {
      return undefined;
    }

    const interval = window.setInterval(() => setScanTick((value) => value + 1), 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [isPending]);

  const scanningFile = useMemo(() => {
    if (!isPending) return null;
    const index = scanTick % scanningFiles.length;
    return scanningFiles[index];
  }, [isPending, scanTick]);

  useEffect(() => {
    if (!isPending) return undefined;

    let mounted = true;
    const refresh = async () => {
      setIsRefreshing(true);
      try {
        const res = await fetch(`/api/scans/${scan.id}`);
        if (!res.ok) {
          throw new Error(`Failed to refresh scan: ${res.status}`);
        }
        const updated: ScanDetailWithProgress = await res.json();
        if (mounted) {
          setScan(updated);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to refresh scan");
        }
      } finally {
        if (mounted) {
          setIsRefreshing(false);
        }
      }
    };

    const timer = window.setInterval(refresh, 2000);
    refresh();
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [isPending, scan.id]);

  return (
    <main style={{ padding: "3rem", maxWidth: 860, margin: "0 auto" }}>
      <Link href="/" style={{ color: "#666", fontSize: "0.9rem" }}>
        ← All scans
      </Link>

      <h1 style={{ fontFamily: "monospace", fontSize: "1.1rem", marginTop: "0.5rem" }}>
        {scan.path}
      </h1>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1rem 0 0.75rem" }}>
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
        <div style={{ marginTop: "1rem", marginBottom: "1.5rem", color: "#444" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.95rem" }}>
            <span style={{ fontWeight: 600 }}>{progressText}</span>
            <span style={{ color: "#888" }}>{isRefreshing ? "Refreshing..." : "Auto-refreshing"}</span>
          </div>

          <div style={{ marginTop: "0.75rem", height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
            <div
              style={{
                width: `${progressValue}%`,
                height: "100%",
                background: "#2563eb",
                transition: "width 0.2s ease",
              }}
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>
            {progressStages.map((stage, index) => {
              const stageLabel = progressLabels[stage];
              const isActive = index === currentStageIndex;
              const isComplete = index < currentStageIndex;

              return (
                <div
                  key={stage}
                  style={{
                    padding: "0.35rem 0.65rem",
                    borderRadius: 999,
                    background: isActive ? "#2563eb" : isComplete ? "#dbeafe" : "#f3f4f6",
                    color: isActive ? "#fff" : isComplete ? "#1d4ed8" : "#6b7280",
                    fontSize: "0.8rem",
                  }}
                >
                  {stageLabel}
                </div>
              );
            })}
          </div>

          {scanningFile && (
            <div style={{ marginTop: "0.75rem", fontSize: "0.9rem", color: "#555" }}>
              Scanning <strong>{scanningFile}</strong>
            </div>
          )}
        </div>
      )}

      {scan.status === "completed" && (
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", fontSize: "0.85rem" }}>
          <span style={{ color: "#888" }}>Download report:</span>
          {(["markdown", "html", "csv", "json"] as const).map((format) => (
            <a key={format} href={`/scans/${scan.id}/report?format=${format}`} style={{ color: "#2563eb" }}>
              {format.toUpperCase()}
            </a>
          ))}
        </div>
      )}

      {scan.status === "failed" && (
        <p style={{ color: "#dc2626", marginBottom: "1.5rem" }}>
          Scan failed{scan.errorMessage ? `: ${scan.errorMessage}` : "."}
        </p>
      )}

      {scan.status === "completed" && (
        <>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>AI Assessment</h2>
          {scan.aiNarrative ? (
            <p
              style={{
                background: "#f8f8f8",
                border: "1px solid #eee",
                borderRadius: 8,
                padding: "0.9rem 1.1rem",
                lineHeight: 1.5,
                marginBottom: "2rem",
              }}
            >
              {scan.aiNarrative}
            </p>
          ) : (
            <p style={{ color: "#888", fontSize: "0.9rem", marginBottom: "2rem" }}>
              No AI narrative available for this scan (no AI provider configured, or
              generation failed). The score and issues above are unaffected — they're
              computed deterministically by the rule engine.
            </p>
          )}
        </>
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

      {error && (
        <p style={{ color: "#dc2626", marginTop: "1rem" }}>
          {error}
        </p>
      )}
    </main>
  );
}
