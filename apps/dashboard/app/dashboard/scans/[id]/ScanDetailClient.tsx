"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { FixInfo, Issue, Scan, ScanDetail } from "../../../../lib/api";
import {
  SEVERITIES,
  SEVERITY_LABEL,
  categoryName,
  countIssues,
  describePath,
  projectScores,
  relativeTime,
  scoreGrade,
  sortBySeverity,
  stackSummary,
  verdictBadge,
} from "../../../../lib/projects";
import { triggerScanAction } from "../../../actions";
import { ChevronDownIcon, ChevronLeftIcon, SparklesIcon } from "../../../landing-icons";
import { createFixAction } from "../../fixes/actions";
import ui from "../../ui.module.css";
import styles from "./report.module.css";

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

const progressLabels: Record<string, string> = {
  cloning: "Cloning repository",
  scanning: "Scanning files",
  evaluating_rules: "Evaluating rules",
  evaluating_plugins: "Checking plugins",
  scoring: "Scoring results",
  ai_narrative: "Writing the assessment",
  persisting: "Saving results",
  done: "Finishing up",
};

const progressDescriptions: Record<string, string> = {
  cloning: "Fetching the repository",
  scanning: "Detecting languages, frameworks and tooling",
  evaluating_rules: "Running the core rule engine",
  evaluating_plugins: "Running framework-specific checks",
  scoring: "Computing scores by standard",
  ai_narrative: "Summarizing what matters most",
  persisting: "Saving results",
  done: "Wrapping up",
};

const DOWNLOAD_FORMATS = [
  { format: "pdf", label: "PDF", proOnly: true },
  { format: "html", label: "HTML", proOnly: false },
  { format: "markdown", label: "Markdown", proOnly: false },
  { format: "csv", label: "CSV", proOnly: false },
  { format: "json", label: "JSON", proOnly: false },
] as const;

const SEVERITY_CLASS: Record<Issue["severity"], string> = {
  critical: ui.sevCritical,
  high: ui.sevHigh,
  medium: ui.sevMedium,
  low: ui.sevLow,
};

const COLLAPSED_FINDINGS = 8;

interface ScanDetailClientProps {
  initialScan: ScanDetail;
  plan: "FREE" | "PRO" | "ENTERPRISE";
  /** Every scan of this repository, newest first. */
  history: Scan[];
  /** The project built here that owns this repository, if any. */
  projectId: string | null;
  /** How each rule's findings can be fixed, from the rule catalog. */
  fixes: Record<string, FixInfo>;
  /** Rules marked "doesn't apply" for this repository, with the reason. */
  dismissed: Record<string, string>;
  /** Rules with a fix queued, being written, or awaiting review. */
  fixing: string[];
  canAutoFix: boolean;
}

function FixLabel({ fix, dismissed, fixing }: { fix?: FixInfo; dismissed: boolean; fixing: boolean }) {
  if (dismissed) return <span className={`${styles.fixLabel} ${ui["text-neutral"]}`}>Doesn&apos;t apply</span>;
  if (fixing) return <span className={`${styles.fixLabel} ${ui["text-blue"]}`}>Fix in progress</span>;
  if (!fix || fix.kind === "guided") {
    return <span className={`${styles.fixLabel} ${ui["text-neutral"]}`}>Guided fix only</span>;
  }
  return fix.confidence === "high" ? (
    <span className={`${styles.fixLabel} ${ui["text-green"]}`}>Auto-fix · high confidence</span>
  ) : (
    <span className={`${styles.fixLabel} ${ui["text-amber"]}`}>Auto-fix · review needed</span>
  );
}

export default function ScanDetailClient({
  initialScan,
  plan,
  history,
  projectId,
  fixes,
  dismissed,
  fixing,
  canAutoFix,
}: ScanDetailClientProps) {
  const [scan, setScan] = useState<ScanDetail>(initialScan);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"report" | "history">("report");
  const [severityFilter, setSeverityFilter] = useState<"all" | "auto" | Issue["severity"]>("all");
  const [batch, setBatch] = useState<{ ok: boolean; text: string } | null>(null);
  const [batchPending, startBatch] = useTransition();
  const [showAll, setShowAll] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const isPending = scan.status === "queued" || scan.status === "active";
  const { name, location } = describePath(scan.path);
  const isGitUrl = /^https?:\/\//.test(scan.path);

  useEffect(() => {
    if (!isPending) return undefined;
    let mounted = true;
    const refresh = async () => {
      try {
        const res = await fetch(`/api/scans/${scan.id}`);
        if (!res.ok) throw new Error(`Failed to refresh scan: ${res.status}`);
        const updated: ScanDetail = await res.json();
        if (mounted) {
          setScan(updated);
          setError(null);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to refresh scan");
      }
    };
    const timer = window.setInterval(refresh, 2000);
    refresh();
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [isPending, scan.id]);

  async function handleCancel() {
    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/scans/${scan.id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error(`Failed to cancel scan: ${res.status}`);
      setScan((prev) => ({ ...prev, status: "cancelled" }));
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel scan");
    } finally {
      setIsCancelling(false);
    }
  }

  const sortedIssues = useMemo(() => sortBySeverity(scan.issues), [scan.issues]);
  const counts = useMemo(() => countIssues(scan.issues), [scan.issues]);
  const visibleIssues =
    severityFilter === "all"
      ? sortedIssues
      : severityFilter === "auto"
        ? sortedIssues.filter((i) => fixes[i.ruleId] && fixes[i.ruleId].kind !== "guided")
        : sortedIssues.filter((i) => i.severity === severityFilter);
  const shownIssues = showAll ? visibleIssues : visibleIssues.slice(0, COLLAPSED_FINDINGS);

  // What fixing the urgent findings is worth, relative to the stored score so
  // findings from plugins (outside the core weights) don't skew it.
  const projection = useMemo(() => {
    if (scan.overallScore == null || scan.issues.length === 0) return null;
    const urgent = scan.issues.filter((i) => i.severity === "critical" || i.severity === "high");
    const target = urgent.length > 0 ? urgent : scan.issues;
    const base = projectScores(scan.issues, []).overall;
    const after = projectScores(scan.issues, target).overall;
    return {
      count: target.length,
      urgentOnly: urgent.length > 0,
      score: Math.min(100, scan.overallScore + (after - base)),
    };
  }, [scan.issues, scan.overallScore]);

  const badge = verdictBadge(scan.verdict);
  const stack = stackSummary(scan);
  const firstFinding = sortedIssues[0];
  const autoFixable = scan.issues.filter((i) => fixes[i.ruleId] && fixes[i.ruleId].kind !== "guided").length;
  // "Safe" = deterministic, high-confidence fixes not already dismissed or in progress.
  const safeRules = [
    ...new Set(
      scan.issues
        .filter((i) => fixes[i.ruleId]?.confidence === "high" && !dismissed[i.ruleId] && !fixing.includes(i.ruleId))
        .map((i) => i.ruleId)
    ),
  ];

  function fixSafe() {
    setBatch(null);
    startBatch(async () => {
      const result = await createFixAction(scan.id, safeRules);
      const count = `${safeRules.length} ${safeRules.length === 1 ? "finding" : "findings"}`;
      setBatch(
        result.ok
          ? { ok: true, text: `Preparing one pull request for ${count}. Track it in the Fix Center.` }
          : { ok: false, text: result.error }
      );
    });
  }

  const currentStageIndex = scan.progress
    ? progressStages.indexOf(scan.progress as (typeof progressStages)[number])
    : scan.status === "active"
      ? 1
      : 0;
  const progressValue = Math.round(((Math.max(currentStageIndex, 0) + 1) / progressStages.length) * 100);

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topRow}>
          <div className={styles.titleBlock}>
            <Link href="/dashboard" className={ui.backLink}>
              <ChevronLeftIcon size={15} />
              Projects
            </Link>
            <span className={styles.titleDivider} aria-hidden="true" />
            <div className={styles.titleText}>
              <h1 className={styles.title}>{name}</h1>
              <p className={styles.subtitle} suppressHydrationWarning>
                {isGitUrl ? (
                  <a href={scan.path.replace(/\.git$/, "")} target="_blank" rel="noreferrer">
                    {location}
                  </a>
                ) : (
                  location
                )}
                {scan.completedAt && ` · scanned ${relativeTime(scan.completedAt).toLowerCase()}`}
              </p>
            </div>
          </div>

          <div className={ui.actions}>
            {scan.status === "completed" && (
              <details className={styles.download}>
                <summary className={ui.btn}>
                  Download report <ChevronDownIcon size={14} />
                </summary>
                <div className={styles.downloadMenu} role="menu">
                  {DOWNLOAD_FORMATS.map(({ format, label, proOnly }) =>
                    proOnly && plan === "FREE" ? (
                      <span key={format} className={styles.downloadItemDisabled}>
                        {label} <span className={styles.proTag}>Pro</span>
                      </span>
                    ) : (
                      <a
                        key={format}
                        role="menuitem"
                        href={`/dashboard/scans/${scan.id}/report?format=${format}`}
                        className={styles.downloadItem}
                      >
                        {label}
                      </a>
                    )
                  )}
                </div>
              </details>
            )}
            {!isPending && (
              <form action={triggerScanAction}>
                <input type="hidden" name="path" value={scan.path} />
                <button type="submit" className={ui.btn}>
                  Re-scan
                </button>
              </form>
            )}
            {scan.status === "completed" && canAutoFix && safeRules.length > 0 && !batch?.ok ? (
              <button type="button" className={ui.btnPrimary} onClick={fixSafe} disabled={batchPending}>
                {batchPending ? "Starting…" : `Fix ${safeRules.length} safe ${safeRules.length === 1 ? "issue" : "issues"}`}
              </button>
            ) : scan.status === "completed" && firstFinding && (
              <Link
                href={`/dashboard/scans/${scan.id}/findings/${firstFinding.id}`}
                className={ui.btnPrimary}
              >
                Start fixing
              </Link>
            )}
          </div>
        </div>

        <nav className={styles.tabs} aria-label="Project sections">
          {projectId && (
            <>
              <Link href={`/dashboard/projects/${projectId}/blueprint`} className={styles.tab}>
                Blueprint
              </Link>
              <Link href={`/dashboard/projects/${projectId}`} className={styles.tab}>
                Lifecycle
              </Link>
            </>
          )}
          <button
            type="button"
            className={`${styles.tab} ${tab === "report" ? styles.tabActive : ""}`}
            aria-current={tab === "report" ? "page" : undefined}
            onClick={() => setTab("report")}
          >
            Standards report
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === "history" ? styles.tabActive : ""}`}
            aria-current={tab === "history" ? "page" : undefined}
            onClick={() => setTab("history")}
          >
            Scan history <span className={styles.tabCount}>{history.length}</span>
          </button>
        </nav>
      </header>

      <main className={ui.page}>
        {error && <p className={ui.error}>{error}</p>}
        {batch && (
          <p className={batch.ok ? styles.notice : ui.error} role="status">
            {batch.text}{" "}
            {batch.ok && (
              <Link href="/dashboard/fixes" className={ui.textLink}>
                Open Fix Center
              </Link>
            )}
          </p>
        )}

        {tab === "history" && (
          <section className={ui.card}>
            <div className={ui.cardHead}>
              <h2 className={ui.cardTitle}>Scan history</h2>
            </div>
            <div className={ui.table}>
              {history.map((s) => (
                <Link
                  key={s.id}
                  href={`/dashboard/scans/${s.id}`}
                  className={`${ui.tableRow} ${styles.historyCols}`}
                  aria-current={s.id === scan.id ? "page" : undefined}
                >
                  <span>
                    <span className={ui.rowTitle}>
                      {new Date(s.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className={ui.rowSub} suppressHydrationWarning>
                      {s.id === scan.id ? "Viewing now" : relativeTime(s.createdAt)}
                    </span>
                  </span>
                  <span className={ui.scoreCell}>
                    {s.overallScore ?? "—"}
                    {s.verdict && (
                      <span className={`${ui.badge} ${ui[`tone-${verdictBadge(s.verdict).tone}`]}`}>
                        {verdictBadge(s.verdict).label}
                      </span>
                    )}
                  </span>
                  <span className={ui.muted}>{s.status}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {tab === "report" && isPending && (
          <section className={`${ui.card} ${ui.cardPad} ${styles.progress}`} aria-live="polite">
            <div className={styles.progressHead}>
              <div>
                <p className={ui.eyebrow}>Scan in progress</p>
                <h2 className={ui.cardTitle}>
                  {scan.progress ? progressLabels[scan.progress] ?? scan.progress : "Waiting in the queue"}
                </h2>
                <p className={ui.cardSub}>
                  {scan.progress ? progressDescriptions[scan.progress] : "The scan starts as soon as a worker is free."}
                </p>
              </div>
              <button type="button" className={ui.btn} onClick={handleCancel} disabled={isCancelling}>
                {isCancelling ? "Cancelling…" : "Cancel scan"}
              </button>
            </div>
            {cancelError && <p className={ui.error}>{cancelError}</p>}
            <div
              className={styles.track}
              role="progressbar"
              aria-valuenow={progressValue}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className={styles.trackFill} style={{ width: `${progressValue}%` }} />
            </div>
            <ol className={styles.stages}>
              {progressStages.map((stage, index) => (
                <li
                  key={stage}
                  className={
                    index < currentStageIndex
                      ? styles.stageDone
                      : index === currentStageIndex
                        ? styles.stageActive
                        : undefined
                  }
                >
                  {progressLabels[stage]}
                </li>
              ))}
            </ol>
          </section>
        )}

        {tab === "report" && scan.status === "failed" && (
          <p className={ui.error}>
            <strong>Scan failed.</strong> {scan.errorMessage ?? "The scan could not be completed."}
          </p>
        )}

        {tab === "report" && scan.status === "cancelled" && (
          <section className={`${ui.card} ${ui.cardPad}`}>
            <h2 className={ui.cardTitle}>Scan cancelled</h2>
            <p className={ui.cardSub}>This scan was stopped before it finished. Re-scan to get a report.</p>
          </section>
        )}

        {tab === "report" && scan.status === "completed" && (
          <>
            <div className={styles.summaryGrid}>
              <section className={styles.scoreCard} aria-labelledby="readiness-label">
                <p id="readiness-label" className={styles.scoreEyebrow}>
                  Production readiness
                </p>
                <p className={styles.scoreValue}>
                  {scan.overallScore ?? "—"}
                  <span>/ 100</span>
                </p>
                <span className={`${ui.badge} ${ui[`tone-${badge.tone}`]}`}>{badge.label}</span>
                <p className={styles.scoreText}>
                  {counts.critical > 0
                    ? `${counts.critical} critical ${counts.critical === 1 ? "finding keeps" : "findings keep"} this app from being production-ready, whatever the score. `
                    : scan.verdict === "Ready"
                      ? "No blocking findings. "
                      : ""}
                  {projection &&
                    `Fixing the ${projection.count} ${projection.urgentOnly ? "critical and high " : ""}${
                      projection.count === 1 ? "finding" : "findings"
                    } lifts it to about ${projection.score}.`}
                </p>
                {stack && <p className={styles.scoreMeta}>{stack}</p>}
              </section>

              <section className={`${ui.card} ${ui.cardPad}`} aria-labelledby="by-standard">
                <h2 id="by-standard" className={ui.cardTitle}>
                  Scores by standard
                </h2>
                <div className={styles.standards}>
                  {scan.categoryScores.map((c) => {
                    const grade = scoreGrade(c.score);
                    return (
                      <div key={c.id} className={styles.standard}>
                        <div className={styles.standardHead}>
                          <span>{categoryName(c.category)}</span>
                          <span className={`${styles.standardScore} ${ui[`text-${grade.tone}`]}`}>
                            {c.score} · {grade.label}
                          </span>
                        </div>
                        <div className={styles.bar}>
                          <div
                            className={`${styles.barFill} ${styles[`bar-${grade.tone}`]}`}
                            style={{ width: `${c.score}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {scan.aiNarrative && (
              <section className={`${ui.card} ${ui.cardPad} ${styles.assessment}`}>
                <span className={styles.assessmentIcon}>
                  <SparklesIcon size={18} />
                </span>
                <div>
                  <h2 className={ui.cardTitle}>Assessment</h2>
                  <p className={styles.assessmentText}>{scan.aiNarrative}</p>
                </div>
              </section>
            )}

            <section className={ui.card} aria-labelledby="findings-title">
              <div className={ui.cardHead}>
                <h2 id="findings-title" className={ui.cardTitle}>
                  Findings, most urgent first
                </h2>
                <span className={ui.muted}>
                  {scan.issues.length} {scan.issues.length === 1 ? "finding" : "findings"}
                  {autoFixable > 0 && ` · ${autoFixable} can be fixed automatically`}
                </span>
              </div>

              {scan.issues.length === 0 ? (
                <div className={ui.empty}>No findings. Nothing to fix right now.</div>
              ) : (
                <>
                  <div className={`${ui.chips} ${styles.filters}`} role="group" aria-label="Filter by severity">
                    <button
                      type="button"
                      className={`${ui.chip} ${severityFilter === "all" ? ui.chipActive : ""}`}
                      aria-pressed={severityFilter === "all"}
                      onClick={() => setSeverityFilter("all")}
                    >
                      All {scan.issues.length}
                    </button>
                    {SEVERITIES.map((severity) =>
                      counts[severity] === 0 ? null : (
                        <button
                          key={severity}
                          type="button"
                          className={`${ui.chip} ${severityFilter === severity ? ui.chipActive : ""}`}
                          aria-pressed={severityFilter === severity}
                          onClick={() => setSeverityFilter(severityFilter === severity ? "all" : severity)}
                        >
                          {SEVERITY_LABEL[severity]} {counts[severity]}
                        </button>
                      )
                    )}
                    {autoFixable > 0 && (
                      <>
                        <span className={ui.chipDivider} aria-hidden="true" />
                        <button
                          type="button"
                          className={`${ui.chip} ${severityFilter === "auto" ? ui.chipActive : ""}`}
                          aria-pressed={severityFilter === "auto"}
                          onClick={() => setSeverityFilter(severityFilter === "auto" ? "all" : "auto")}
                        >
                          Auto-fixable
                        </button>
                      </>
                    )}
                  </div>

                  <ul className={styles.findings}>
                    {shownIssues.map((issue) => (
                      <li
                        key={issue.id}
                        className={`${styles.finding} ${
                          issue.severity === "critical" && !dismissed[issue.ruleId] ? styles.findingCritical : ""
                        } ${dismissed[issue.ruleId] ? styles.findingDismissed : ""}`}
                      >
                        <span className={`${ui.badge} ${styles.sevPill} ${SEVERITY_CLASS[issue.severity]}`}>
                          {SEVERITY_LABEL[issue.severity]}
                        </span>
                        <div className={styles.findingBody}>
                          <p className={styles.findingTitle}>{issue.message}</p>
                          <p className={styles.findingSub}>
                            {issue.ruleId} · {categoryName(issue.category)}
                          </p>
                        </div>
                        <FixLabel
                          fix={fixes[issue.ruleId]}
                          dismissed={Boolean(dismissed[issue.ruleId])}
                          fixing={fixing.includes(issue.ruleId)}
                        />
                        <Link
                          href={`/dashboard/scans/${scan.id}/findings/${issue.id}`}
                          className={`${ui.btn} ${ui.btnSm}`}
                          aria-label={`Open finding: ${issue.message}`}
                        >
                          Open
                        </Link>
                      </li>
                    ))}
                  </ul>

                  {visibleIssues.length > COLLAPSED_FINDINGS && (
                    <div className={styles.showAll}>
                      <button type="button" className={ui.textLink} onClick={() => setShowAll((v) => !v)}>
                        {showAll ? "Show fewer" : `Show all ${visibleIssues.length} findings`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
