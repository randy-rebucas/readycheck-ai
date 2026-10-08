import Link from "next/link";
import { listScans, type Scan } from "../../../lib/api";
import { describePath, relativeTime, verdictBadge, type Tone } from "../../../lib/projects";
import Pagination from "../Pagination";
import styles from "../projects.module.css";
import ui from "../ui.module.css";

export const metadata = {
  title: "Scans — ReadyCheck AI",
};

const STATUS_FILTERS: { key: Scan["status"] | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "queued", label: "Queued" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_BADGE: Record<Scan["status"], { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "neutral" },
  active: { label: "Scanning", tone: "blue" },
  completed: { label: "Completed", tone: "green" },
  failed: { label: "Failed", tone: "red" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const PAGE_SIZE = 10;

interface ScansPageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function ScansPage({ searchParams }: ScansPageProps) {
  const { status: statusParam, page: pageParam } = await searchParams;
  const activeFilter = STATUS_FILTERS.find((f) => f.key === statusParam)?.key ?? "all";

  let scans: Scan[] = [];
  let apiError: string | null = null;
  try {
    scans = await listScans();
  } catch (err) {
    apiError = err instanceof Error ? err.message : "Failed to reach the ReadyCheck API";
  }

  const filteredScans =
    activeFilter === "all" ? scans : scans.filter((scan) => scan.status === activeFilter);

  const totalPages = Math.max(1, Math.ceil(filteredScans.length / PAGE_SIZE));
  const requestedPage = Number.parseInt(pageParam ?? "1", 10);
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, requestedPage), totalPages)
    : 1;
  const visibleScans = filteredScans.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <main className={ui.page}>
      <div className={ui.pageHead}>
        <div>
          <h1 className={ui.pageTitle}>Scans</h1>
          <p className={ui.pageSub}>
            Every check run in this workspace · {scans.length} {scans.length === 1 ? "scan" : "scans"}
          </p>
        </div>
        <div className={ui.actions}>
          <Link href="/dashboard#repo-url" className={ui.btnPrimary}>
            + Check a repository
          </Link>
        </div>
      </div>

      <section className={ui.card}>
        {scans.length > 0 && (
          <div className={ui.cardHead}>
            <div className={ui.chips}>
              {STATUS_FILTERS.map((filter) => {
                const count =
                  filter.key === "all"
                    ? scans.length
                    : scans.filter((scan) => scan.status === filter.key).length;
                if (filter.key !== "all" && count === 0) return null;
                const href =
                  filter.key === "all" ? "/dashboard/scans" : `/dashboard/scans?status=${filter.key}`;
                return (
                  <Link
                    key={filter.key}
                    href={href}
                    className={`${ui.chip} ${filter.key === activeFilter ? ui.chipActive : ""}`}
                    aria-current={filter.key === activeFilter ? "page" : undefined}
                  >
                    {filter.label} {count}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {apiError && (
          <div className={ui.cardPad}>
            <p className={ui.error}>
              Could not reach the API ({apiError}). Is <code>apps/api</code> running?
            </p>
          </div>
        )}

        {scans.length === 0 && !apiError && (
          <div className={ui.empty}>No scans yet. Check a repository from Projects.</div>
        )}
        {scans.length > 0 && visibleScans.length === 0 && (
          <div className={ui.empty}>No scans match this filter.</div>
        )}

        {visibleScans.length > 0 && (
          <div className={ui.table} role="table" aria-label="Scans">
            <div className={`${ui.tableHead} ${styles.cols}`} role="row">
              <span role="columnheader">Repository</span>
              <span role="columnheader">Readiness</span>
              <span role="columnheader">Findings</span>
              <span role="columnheader" className={styles.hideSm}>
                Status
              </span>
              <span role="columnheader">Started</span>
            </div>
            {visibleScans.map((scan) => {
              const { name, location } = describePath(scan.path);
              const verdict = verdictBadge(scan.verdict);
              const status = STATUS_BADGE[scan.status] ?? STATUS_BADGE.queued;
              const c = scan.issueCounts;
              const total = c ? c.critical + c.high + c.medium + c.low : null;
              return (
                <Link
                  key={scan.id}
                  href={`/dashboard/scans/${scan.id}`}
                  className={`${ui.tableRow} ${styles.cols}`}
                  role="row"
                >
                  <span role="cell" className={styles.nameCell}>
                    <span className={ui.rowTitle}>{name}</span>
                    <span className={ui.rowSub}>{location}</span>
                  </span>
                  <span role="cell">
                    {scan.overallScore != null ? (
                      <span className={ui.scoreCell}>
                        {scan.overallScore}
                        <span className={`${ui.badge} ${ui[`tone-${verdict.tone}`]}`}>{verdict.label}</span>
                      </span>
                    ) : (
                      <span className={ui.muted}>—</span>
                    )}
                  </span>
                  <span role="cell">
                    {scan.status !== "completed" || total === null ? (
                      <span className={ui.muted}>—</span>
                    ) : c && c.critical + c.high > 0 ? (
                      <span className={ui["text-red"]}>
                        {total} · {c.critical} critical, {c.high} high
                      </span>
                    ) : (
                      <span>{total}</span>
                    )}
                  </span>
                  <span role="cell" className={styles.hideSm}>
                    {scan.status === "active" || scan.status === "queued" ? (
                      <span className={ui.live}>{status.label}</span>
                    ) : (
                      <span className={`${ui.badge} ${ui[`tone-${status.tone}`]}`}>{status.label}</span>
                    )}
                  </span>
                  <span role="cell" className={ui.muted}>
                    {relativeTime(scan.createdAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/dashboard/scans"
          extraParams={activeFilter === "all" ? {} : { status: activeFilter }}
        />
      </section>
    </main>
  );
}
