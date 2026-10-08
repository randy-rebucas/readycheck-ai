import Link from "next/link";
import { getScan, listProjects, listScans, type Project as BuiltProject, type Scan } from "../../lib/api";
import { intakeProgress, kindLabel } from "../../lib/intake";
import { buildLifecycle, stageLabel } from "../../lib/lifecycle";
import {
  groupProjects,
  relativeTime,
  stackSummary,
  verdictBadge,
  type Project as RepoGroup,
} from "../../lib/projects";
import { triggerScanAction } from "../actions";
import { GitHubIcon, LightbulbIcon, LockIcon, SearchIcon, ShieldCheckIcon } from "../landing-icons";
import styles from "./projects.module.css";
import ui from "./ui.module.css";

export const metadata = {
  title: "Projects — ReadyCheck AI",
};

interface DashboardPageProps {
  searchParams: Promise<{ scanError?: string; q?: string }>;
}

/** One table row: an app built here, an audited repository, or both. */
interface Row {
  key: string;
  href: string;
  name: string;
  sub: string;
  stage: string;
  repo: RepoGroup | null;
  /** Set while a built project's intake is unfinished. */
  intake: { answered: number; total: number } | null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function OpenIssues({ repo }: { repo: RepoGroup | null }) {
  const counts = repo?.latestCompleted?.issueCounts;
  if (!counts) return <span className={ui.muted}>—</span>;
  const urgent = counts.critical + counts.high;
  if (urgent > 0) {
    return (
      <span className={`${styles.issues} ${ui["text-red"]}`}>
        {counts.critical} critical · {counts.high} high
      </span>
    );
  }
  const rest = counts.medium + counts.low;
  if (rest === 0) return <span>None</span>;
  return (
    <span>
      0 critical · {counts.medium > 0 ? `${counts.medium} medium` : `${counts.low} low`}
    </span>
  );
}

function LastCheck({ row }: { row: Row }) {
  if (row.intake) {
    return (
      <span className={styles.resume}>
        Resume intake · {row.intake.answered} of {row.intake.total}
      </span>
    );
  }
  const latest = row.repo?.latest;
  if (!latest) return <span className={ui.muted}>No checks yet</span>;
  if (latest.status === "queued" || latest.status === "active") {
    return <span className={ui.live}>Checking now</span>;
  }
  if (latest.status === "failed") {
    return <span className={ui["text-red"]}>Last check failed · {relativeTime(latest.createdAt)}</span>;
  }
  return <span className={ui.muted}>{relativeTime(latest.completedAt ?? latest.createdAt)}</span>;
}

async function builtRow(project: BuiltProject, repo: RepoGroup | null): Promise<Row> {
  const intake = intakeProgress(project.answers);
  const latest = repo?.latestCompleted ? await getScan(repo.latestCompleted.id).catch(() => null) : null;
  const scanning = repo && (repo.latest.status === "queued" || repo.latest.status === "active") ? repo.latest : null;
  const stack = stackSummary(repo?.latestCompleted ?? null);
  const kind = kindLabel(project.answers);
  return {
    key: project.id,
    href: intake.complete ? `/dashboard/projects/${project.id}` : `/dashboard/projects/${project.id}/intake`,
    name: project.name,
    sub: intake.complete ? [kind, stack, "built here"].filter(Boolean).join(" · ") : `${kind} · intake in progress`,
    stage: stageLabel(buildLifecycle(project, latest, scanning)),
    repo,
    intake: intake.complete ? null : { answered: intake.answered, total: intake.total },
  };
}

function auditRow(repo: RepoGroup): Row {
  const stack = stackSummary(repo.latestCompleted);
  const host = repo.location.split("/")[0];
  const from = /github\.com/.test(host) ? "imported from GitHub" : /gitlab/.test(host) ? "imported from GitLab" : repo.location;
  return {
    key: repo.path,
    href: `/dashboard/scans/${repo.latest.id}`,
    name: repo.name,
    sub: [stack, from].filter(Boolean).join(" · "),
    stage: "Audit only",
    repo,
    intake: null,
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { scanError, q } = await searchParams;
  const query = q?.trim().toLowerCase() ?? "";

  let scans: Scan[] = [];
  let built: BuiltProject[] = [];
  let apiError: string | null = null;
  try {
    [scans, built] = await Promise.all([listScans(), listProjects()]);
  } catch (err) {
    apiError = err instanceof Error ? err.message : "Failed to reach the ReadyCheck API";
  }

  const repos = groupProjects(scans);
  const repoByPath = new Map(repos.map((r) => [r.path, r]));
  const linked = new Set(built.map((p) => p.repoPath).filter(Boolean));
  const allRows: Row[] = [
    ...(await Promise.all(built.map((p) => builtRow(p, p.repoPath ? repoByPath.get(p.repoPath) ?? null : null)))),
    ...repos.filter((r) => !linked.has(r.path)).map(auditRow),
  ];
  const rows = query
    ? allRows.filter((r) => `${r.name} ${r.sub} ${r.repo?.location ?? ""}`.toLowerCase().includes(query))
    : allRows;

  const scored = repos.filter((p) => p.latestCompleted?.overallScore != null);
  const avgReadiness = average(scored.map((p) => p.latestCompleted!.overallScore!));
  const trend = average(
    scored
      .filter((p) => p.previousCompleted?.overallScore != null)
      .map((p) => p.latestCompleted!.overallScore! - p.previousCompleted!.overallScore!)
  );

  let critical = 0;
  let high = 0;
  let open = 0;
  let projectsWithCritical = 0;
  for (const p of repos) {
    const c = p.latestCompleted?.issueCounts;
    if (!c) continue;
    critical += c.critical;
    high += c.high;
    open += c.critical + c.high + c.medium + c.low;
    if (c.critical > 0) projectsWithCritical += 1;
  }
  const productionReady = scored.filter((p) => p.latestCompleted!.verdict === "Ready").length;
  const urgent = critical + high;

  return (
    <main className={ui.page}>
      <div className={ui.pageHead}>
        <div>
          <h1 className={ui.pageTitle}>Projects</h1>
          <p className={ui.pageSub}>
            {allRows.length} {allRows.length === 1 ? "project" : "projects"}
            {urgent > 0 && ` · ${urgent} ${urgent === 1 ? "finding needs" : "findings need"} you before the next release`}
          </p>
        </div>
        <div className={ui.actions}>
          <a href="#repo-url" className={ui.btn}>
            <GitHubIcon size={16} /> Connect repository
          </a>
          <Link href="/dashboard/projects/new" className={ui.btnPrimary}>
            + New project
          </Link>
        </div>
      </div>

      <div className={styles.starts}>
        <Link href="/dashboard/projects/new" className={`${ui.card} ${styles.startCard} ${styles.startLink}`}>
          <span className={`${styles.checkIcon} ${styles.buildIcon}`}>
            <LightbulbIcon size={22} />
          </span>
          <span className={styles.checkBody}>
            <span className={styles.checkTitle}>Build something new</span>
            <span className={styles.checkText}>
              Answer questions about your idea and get a Blueprint: stack, standards, a hosting estimate and a
              plan to production.
            </span>
            <span className={styles.checkNote}>About 15 to 30 questions, depending on the project</span>
          </span>
        </Link>

        <section className={`${ui.card} ${styles.startCard}`} aria-labelledby="check-title">
          <span className={styles.checkIcon}>
            <ShieldCheckIcon size={22} />
          </span>
          <div className={styles.checkBody}>
            <h2 id="check-title" className={styles.checkTitle}>
              Check an existing app
            </h2>
            <p className={styles.checkText}>
              Paste a public Git repository URL. We score it on security, testing, DevOps, architecture and
              documentation.
            </p>
            <form action={triggerScanAction} className={styles.checkForm}>
              <span className={styles.inputWrap}>
                <GitHubIcon size={17} />
                <input
                  id="repo-url"
                  name="path"
                  className={`${ui.input} ${styles.repoInput}`}
                  placeholder="https://github.com/org/repo.git"
                  aria-label="Repository URL or local path"
                  required
                />
              </span>
              <button type="submit" className={ui.btnPrimary}>
                Run check
              </button>
            </form>
            {scanError && <p className={ui.error}>{scanError}</p>}
            <p className={styles.checkNote}>
              <LockIcon size={13} /> Read-only · your code is deleted after the scan
            </p>
          </div>
        </section>
      </div>

      <section className={ui.stats} aria-label="Workspace summary">
        <div className={`${ui.card} ${ui.stat}`}>
          <p className={ui.eyebrow}>Average readiness</p>
          <span className={ui.statValue}>{avgReadiness ?? "—"}</span>
          {trend !== null && trend !== 0 ? (
            <span className={`${ui.statNote} ${trend > 0 ? ui.statNoteUp : ui.statNoteDown}`}>
              {trend > 0 ? "Up" : "Down"} {Math.abs(trend)} since previous checks
            </span>
          ) : (
            <span className={ui.statNote}>
              Across {scored.length} scored {scored.length === 1 ? "project" : "projects"}
            </span>
          )}
        </div>
        <div className={`${ui.card} ${ui.stat}`}>
          <p className={ui.eyebrow}>Critical open</p>
          <span className={`${ui.statValue} ${critical > 0 ? ui.statValueDanger : ""}`}>{critical}</span>
          <span className={ui.statNote}>
            {critical > 0
              ? `Blocking ${projectsWithCritical} ${projectsWithCritical === 1 ? "project" : "projects"}`
              : "Nothing blocking release"}
          </span>
        </div>
        <div className={`${ui.card} ${ui.stat}`}>
          <p className={ui.eyebrow}>Open findings</p>
          <span className={ui.statValue}>{open}</span>
          <span className={ui.statNote}>{high} high severity</span>
        </div>
        <div className={`${ui.card} ${ui.stat}`}>
          <p className={ui.eyebrow}>Production-ready</p>
          <span className={ui.statValue}>{productionReady}</span>
          <span className={ui.statNote}>
            of {scored.length} scored {scored.length === 1 ? "project" : "projects"}
          </span>
        </div>
      </section>

      <section className={ui.card} aria-labelledby="all-projects">
        <div className={ui.cardHead}>
          <h2 id="all-projects" className={ui.cardTitle}>
            All projects
          </h2>
          <form role="search" className={styles.search}>
            <SearchIcon size={16} />
            <input
              name="q"
              type="search"
              defaultValue={q}
              className={ui.input}
              placeholder="Search projects"
              aria-label="Search projects"
            />
          </form>
        </div>

        {apiError && (
          <div className={ui.cardPad}>
            <p className={ui.error}>
              Could not reach the API ({apiError}). Is <code>apps/api</code> running?
            </p>
          </div>
        )}

        {allRows.length === 0 && !apiError ? (
          <div className={ui.empty}>No projects yet. Start a new one or check a repository above.</div>
        ) : rows.length === 0 ? (
          <div className={ui.empty}>No projects match &ldquo;{q}&rdquo;.</div>
        ) : (
          <div className={ui.table} role="table" aria-label="Projects">
            <div className={`${ui.tableHead} ${styles.cols}`} role="row">
              <span role="columnheader">Project</span>
              <span role="columnheader" className={styles.hideSm}>
                Stage
              </span>
              <span role="columnheader">Readiness</span>
              <span role="columnheader" className={styles.hideSm}>
                Open issues
              </span>
              <span role="columnheader">Last check</span>
            </div>
            {rows.map((row) => {
              const scan = row.repo?.latestCompleted;
              const badge = verdictBadge(scan?.verdict ?? null);
              return (
                <Link key={row.key} href={row.href} className={`${ui.tableRow} ${styles.cols}`} role="row">
                  <span role="cell" className={styles.nameCell}>
                    <span className={ui.rowTitle}>{row.name}</span>
                    <span className={ui.rowSub}>{row.sub}</span>
                  </span>
                  <span role="cell" className={styles.hideSm}>
                    {row.stage}
                  </span>
                  <span role="cell">
                    {scan?.overallScore != null ? (
                      <span className={ui.scoreCell}>
                        {scan.overallScore}
                        <span className={`${ui.badge} ${ui[`tone-${badge.tone}`]}`}>{badge.label}</span>
                      </span>
                    ) : (
                      <span className={ui.muted}>Not scored yet</span>
                    )}
                  </span>
                  <span role="cell" className={styles.hideSm}>
                    <OpenIssues repo={row.repo} />
                  </span>
                  <span role="cell">
                    <LastCheck row={row} />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
