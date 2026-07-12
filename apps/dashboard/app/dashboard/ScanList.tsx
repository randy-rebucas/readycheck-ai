import Link from "next/link";
import type { Scan } from "../../lib/api";
import styles from "./dashboard.module.css";
import { CalendarIcon, CheckCircleIcon, GitHubIcon } from "../landing-icons";

const VERDICT_COLORS: Record<string, string> = {
  Ready: "#34d399",
  "Ready with Minor Improvements": "#fbbf24",
  "Not Ready": "#fb923c",
  "High Risk": "#f87171",
};

const STATUS_META: Record<Scan["status"], { color: string; live?: boolean }> = {
  queued: { color: "#9aa1b1", live: true },
  active: { color: "#818cf8", live: true },
  completed: { color: "#34d399" },
  failed: { color: "#f87171" },
  cancelled: { color: "#9aa1b1" },
};

function accentColor(scan: Scan): string {
  if (scan.status === "active" || scan.status === "queued") return "#6366f1";
  if (scan.status === "failed") return "#ef4444";
  if (scan.status === "cancelled") return "#6b7280";
  return (scan.verdict && VERDICT_COLORS[scan.verdict]) || "#34d399";
}

export default function ScanList({ scans }: { scans: Scan[] }) {
  return (
    <div className={styles.scanList}>
      {scans.map((scan) => {
        const status = STATUS_META[scan.status] ?? STATUS_META.queued;
        const verdictText =
          scan.verdict ??
          (scan.status === "active" || scan.status === "queued"
            ? "Scanning in progress..."
            : scan.status === "failed"
              ? "Scan failed"
              : scan.status === "cancelled"
                ? "Scan cancelled"
                : null);
        const verdictColor =
          (scan.verdict && VERDICT_COLORS[scan.verdict]) ||
          (scan.status === "failed"
            ? "#f87171"
            : scan.status === "cancelled"
              ? "#9aa1b1"
              : "#818cf8");

        return (
          <Link key={scan.id} href={`/dashboard/scans/${scan.id}`} className={styles.scanRow}>
            <span className={styles.accent} style={{ background: accentColor(scan) }} />
            <span className={styles.repoTile}>
              <GitHubIcon size={20} />
            </span>
            <span className={styles.scanInfo}>
              <span className={styles.scanPath}>{scan.path}</span>
              <span className={styles.scanDate}>
                <CalendarIcon size={12} />
                {new Date(scan.createdAt).toLocaleString("en-US")}
              </span>
            </span>
            <span className={styles.scanRight}>
              <span className={styles.score}>
                {scan.overallScore !== null ? `${scan.overallScore}%` : "—"}
              </span>
              <span className={styles.verdict} style={{ color: verdictColor }}>
                {verdictText}
              </span>
              <span
                className={styles.statusPill}
                style={{
                  color: status.color,
                  borderColor: `${status.color}55`,
                  background: `${status.color}14`,
                }}
              >
                {status.live ? (
                  <span className={styles.pulseDot} />
                ) : scan.status === "completed" ? (
                  <CheckCircleIcon size={13} />
                ) : null}
                {scan.status}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
