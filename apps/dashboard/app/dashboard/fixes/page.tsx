import Link from "next/link";
import {
  getRules,
  getScan,
  listFixes,
  listMembers,
  listScans,
  listTriage,
  type FixRequest,
  type Issue,
  type ScanDetail,
  type Triage,
} from "../../../lib/api";
import { getCurrentUser } from "../../../lib/get-current-user";
import {
  SEVERITIES,
  SEVERITY_LABEL,
  categoryName,
  countIssues,
  describePath,
  groupProjects,
  relativeTime,
  sortBySeverity,
} from "../../../lib/projects";
import { ExternalLinkIcon } from "../../landing-icons";
import AutoRefresh from "../AutoRefresh";
import ui from "../ui.module.css";
import styles from "./fixes.module.css";

export const metadata = {
  title: "Fix Center — ReadyCheck AI",
};

const SEVERITY_CLASS: Record<Issue["severity"], string> = {
  critical: ui.sevCritical,
  high: ui.sevHigh,
  medium: ui.sevMedium,
  low: ui.sevLow,
};

/** Detail requests are one per project; cap them so a big workspace stays fast. */
const MAX_PROJECTS = 25;

interface FixesPageProps {
  searchParams: Promise<{ severity?: string; mine?: string; dismissed?: string }>;
}

interface Row extends Issue {
  scanId: string;
  repoPath: string;
  projectName: string;
  triage: Triage | undefined;
}

function PrStatus({ fix }: { fix: FixRequest }) {
  const checks = fix.pull?.checks;
  switch (fix.status) {
    case "queued":
    case "working":
      return <span className={`${ui.badge} ${ui["tone-blue"]}`}>Writing the fix</span>;
    case "failed":
      return <span className={`${ui.badge} ${ui["tone-red"]}`}>Failed</span>;
    case "merged":
      return <span className={`${ui.badge} ${ui["tone-green"]}`}>Merged</span>;
    case "closed":
      return <span className={`${ui.badge} ${ui["tone-neutral"]}`}>Closed</span>;
    default:
      return checks && checks.failed > 0 ? (
        <span className={`${ui.badge} ${ui["tone-red"]}`}>Checks failing</span>
      ) : (
        <span className={`${ui.badge} ${ui["tone-amber"]}`}>Needs review</span>
      );
  }
}

export default async function FixesPage({ searchParams }: FixesPageProps) {
  const { severity: severityParam, mine, dismissed: showDismissed } = await searchParams;
  const activeSeverity = SEVERITIES.find((s) => s === severityParam) ?? "all";

  let apiError: string | null = null;
  let rows: Row[] = [];
  let truncated = false;
  const [user, fixes, triage, members, rules] = await Promise.all([
    getCurrentUser(),
    listFixes().catch(() => [] as FixRequest[]),
    listTriage().catch(() => [] as Triage[]),
    listMembers().catch(() => []),
    getRules().catch(() => null),
  ]);
  try {
    const projects = groupProjects(await listScans()).filter((p) => p.latestCompleted && p.latestCompleted.issueCounts);
    truncated = projects.length > MAX_PROJECTS;
    const details = await Promise.all(
      projects.slice(0, MAX_PROJECTS).map((p) =>
        getScan(p.latestCompleted!.id).then(
          (scan): [string, ScanDetail] => [p.name, scan],
          () => null
        )
      )
    );
    rows = details.flatMap((entry) =>
      entry
        ? entry[1].issues.map((issue) => ({
            ...issue,
            scanId: entry[1].id,
            repoPath: entry[1].path,
            projectName: entry[0],
            triage: triage.find((t) => t.repoPath === entry[1].path && t.ruleId === issue.ruleId),
          }))
        : []
    );
  } catch (err) {
    apiError = err instanceof Error ? err.message : "Failed to reach the ReadyCheck API";
  }

  const memberName = new Map(members.map((m) => [m.userId, m.name ?? m.email ?? "Someone"]));
  const fixKind = new Map((rules?.rules ?? []).map((r) => [r.id, r.fix]));
  const dismissedCount = rows.filter((r) => r.triage?.dismissedAt).length;
  const open = rows.filter((r) => (showDismissed ? r.triage?.dismissedAt : !r.triage?.dismissedAt));
  const scoped = mine ? open.filter((r) => r.triage?.assigneeId === user?.id) : open;
  const sorted = sortBySeverity(scoped);
  const counts = countIssues(scoped);
  const visible = activeSeverity === "all" ? sorted : sorted.filter((r) => r.severity === activeSeverity);
  const activeFixes = fixes.filter((f) => f.status !== "closed").slice(0, 10);
  const busy = fixes.some((f) => f.status === "queued" || f.status === "working");

  const href = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const next = { severity: severityParam, mine, dismissed: showDismissed, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    const qs = params.toString();
    return `/dashboard/fixes${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className={ui.page}>
      <AutoRefresh active={busy} />
      <div className={ui.pageHead}>
        <div>
          <h1 className={ui.pageTitle}>Fix Center</h1>
          <p className={ui.pageSub}>Open findings from each project&apos;s latest scan, and the pull requests fixing them</p>
        </div>
      </div>

      {apiError && (
        <p className={ui.error}>
          Could not reach the API ({apiError}). Is <code>apps/api</code> running?
        </p>
      )}

      {activeFixes.length > 0 && (
        <section className={ui.card} aria-labelledby="prs-title">
          <div className={ui.cardHead}>
            <h2 id="prs-title" className={ui.cardTitle}>
              Pull requests
            </h2>
            <span className={ui.muted}>Opened by ReadyCheck · nothing is pushed to main</span>
          </div>
          <ul className={styles.list}>
            {activeFixes.map((fix) => (
              <li key={fix.id} className={styles.row}>
                <span className={styles.body}>
                  <span className={ui.rowTitle}>
                    {fix.ruleIds.length === 1 ? `Fix ${fix.ruleIds[0]}` : `Fix ${fix.ruleIds.length} findings`}
                    {fix.prNumber ? ` · PR #${fix.prNumber}` : ""}
                  </span>
                  <span className={ui.rowSub} suppressHydrationWarning>
                    {describePath(fix.repoPath).name} · {fix.ruleIds.join(", ")} · {relativeTime(fix.createdAt)}
                    {fix.status === "failed" && fix.error ? ` · ${fix.error}` : ""}
                  </span>
                </span>
                <PrStatus fix={fix} />
                {fix.prUrl ? (
                  <a href={fix.prUrl} target="_blank" rel="noreferrer" className={`${ui.btn} ${ui.btnSm}`}>
                    {fix.status === "opened" ? "Review" : "View"} <ExternalLinkIcon size={13} />
                  </a>
                ) : (
                  <Link href={`/dashboard/scans/${fix.scanId}`} className={`${ui.btn} ${ui.btnSm}`}>
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={ui.card}>
        <div className={ui.cardHead}>
          <div className={ui.chips}>
            <Link href={href({ severity: undefined })} className={`${ui.chip} ${activeSeverity === "all" ? ui.chipActive : ""}`}>
              All {scoped.length}
            </Link>
            {SEVERITIES.map((s) =>
              counts[s] === 0 ? null : (
                <Link key={s} href={href({ severity: s })} className={`${ui.chip} ${activeSeverity === s ? ui.chipActive : ""}`}>
                  {SEVERITY_LABEL[s]} {counts[s]}
                </Link>
              )
            )}
            <span className={ui.chipDivider} aria-hidden="true" />
            <Link href={href({ mine: mine ? undefined : "1" })} className={`${ui.chip} ${mine ? ui.chipActive : ""}`}>
              Assigned to me
            </Link>
            {dismissedCount > 0 && (
              <Link
                href={href({ dismissed: showDismissed ? undefined : "1" })}
                className={`${ui.chip} ${showDismissed ? ui.chipActive : ""}`}
              >
                Doesn&apos;t apply {dismissedCount}
              </Link>
            )}
          </div>
        </div>

        {visible.length === 0 && !apiError ? (
          <div className={ui.empty}>
            {rows.length === 0
              ? "Nothing to fix. Every scanned project is clean."
              : mine
                ? "Nothing assigned to you."
                : "No findings here."}
          </div>
        ) : (
          <ul className={styles.list}>
            {visible.map((row) => {
              const fix = fixKind.get(row.ruleId);
              const due = row.triage?.dueDate ? new Date(row.triage.dueDate) : null;
              const overdue = due && due.getTime() < Date.now();
              return (
                <li key={row.id}>
                  <Link
                    href={`/dashboard/scans/${row.scanId}/findings/${row.id}`}
                    className={`${styles.row} ${row.severity === "critical" && !showDismissed ? styles.rowCritical : ""}`}
                  >
                    <span className={`${ui.badge} ${styles.sev} ${SEVERITY_CLASS[row.severity]}`}>
                      {SEVERITY_LABEL[row.severity]}
                    </span>
                    <span className={styles.body}>
                      <span className={ui.rowTitle}>{row.message}</span>
                      <span className={ui.rowSub}>
                        {row.projectName} · {categoryName(row.category)} · {row.ruleId}
                        {row.triage?.dismissedAt ? ` · ${row.triage.dismissReason}` : ""}
                      </span>
                    </span>
                    {row.triage?.assigneeId && (
                      <span className={styles.meta}>{memberName.get(row.triage.assigneeId) ?? "Assigned"}</span>
                    )}
                    {due && (
                      <span className={styles.meta} suppressHydrationWarning>
                        <span className={overdue ? ui["text-red"] : undefined}>
                          Due {due.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                        </span>
                      </span>
                    )}
                    {fix && fix.kind !== "guided" && (
                      <span className={styles.meta}>
                        <span className={fix.confidence === "high" ? ui["text-green"] : ui["text-amber"]}>Auto-fix</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {truncated && <p className={ui.muted}>Showing findings from the {MAX_PROJECTS} most recently scanned projects.</p>}
    </main>
  );
}
