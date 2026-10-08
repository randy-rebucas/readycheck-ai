import Link from "next/link";
import type { BuildSlice, Project, Scan } from "../../../../lib/api";
import { getMode } from "../../../../lib/get-mode";
import { currentStage, type GateCheck, type Stage } from "../../../../lib/lifecycle";
import { relativeTime, verdictBadge } from "../../../../lib/projects";
import { CheckIcon, ClockIcon, GitHubIcon, SparklesIcon, XIcon } from "../../../landing-icons";
import AutoRefresh from "../../AutoRefresh";
import ui from "../../ui.module.css";
import styles from "../project.module.css";
import { connectRepoAction } from "../actions";
import BuildSlices from "./BuildSlices";
import { loadProject } from "./data";
import ProjectHeader from "./ProjectHeader";
import StageAction, { RunCheckButton, SignoffButton } from "./StageAction";

export const metadata = {
  title: "Lifecycle — ReadyCheck AI",
};

const STATUS_LABEL: Record<Stage["status"], string> = {
  done: "Done",
  current: "In progress",
  next: "Next",
  later: "Later",
};

const SIGNOFF_ACTIVITY: Record<string, string> = {
  plan: "Blueprint approved",
  design: "Design signed off",
  build: "First-release features marked complete",
  uat: "Staging signed off",
  deploy: "Marked as live",
};

function stageFill(stage: Stage): number {
  if (stage.status === "done") return 100;
  if (stage.status !== "current") return 0;
  return Math.round((stage.checks.filter((c) => c.passed).length / stage.checks.length) * 100);
}

function scanActivity(scan: Scan): string {
  switch (scan.status) {
    case "completed":
      return `Readiness check scored ${scan.overallScore ?? "—"}`;
    case "failed":
      return "Readiness check failed";
    case "cancelled":
      return "Readiness check cancelled";
    default:
      return "Readiness check started";
  }
}

function activity(project: Project, scans: Scan[], slices: BuildSlice[]) {
  const events = [
    ...Object.entries(project.signoffs).map(([stage, s]) => ({ text: SIGNOFF_ACTIVITY[stage] ?? stage, at: s.at })),
    ...scans.map((s) => ({ text: scanActivity(s), at: s.completedAt ?? s.createdAt })),
    ...slices.flatMap((s) => [
      ...(s.mergedAt ? [{ text: `“${s.title}” merged`, at: s.mergedAt }] : []),
      ...(s.issuesFound?.length && s.status === "review"
        ? [{ text: `Pre-review found ${s.issuesFound.length} issues in PR #${s.prNumber}`, at: project.updatedAt }]
        : []),
    ]),
    { text: "Project created", at: project.createdAt },
  ];
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
}

function CheckMark({ check }: { check: GateCheck }) {
  if (check.passed) return <CheckIcon size={16} className={styles.gateOk} />;
  if (check.pending) return <ClockIcon size={16} className={styles.gateWait} />;
  return <XIcon size={14} className={styles.gateNo} />;
}

export default async function LifecyclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [data, mode] = await Promise.all([loadProject(id), getMode()]);
  const { project, scans, latest, scanning, stages, slices } = data;
  const busy = Boolean(scanning) || slices.some((s) => s.status === "generating" || s.status === "queued");
  const stage = currentStage(stages);
  const next = stage ? stages[stage.number] : undefined;
  const passing = stage ? stage.checks.filter((c) => c.passed).length : 0;

  function checkAction(check: GateCheck) {
    if (check.passed) return null;
    if (check.signoff) {
      const ready = stage!.checks.every((c) => c.passed || c.signoff);
      return ready ? <SignoffButton projectId={project.id} stage={check.signoff} small /> : null;
    }
    if (check.label === "Intake answered") {
      return (
        <Link href={`/dashboard/projects/${project.id}/intake`} className={`${ui.btn} ${ui.btnSm}`}>
          Resume intake
        </Link>
      );
    }
    if (check.label === "Repository connected") return null; // the connect form below
    if (!project.repoPath || scanning) return null;
    if (latest && !check.pending) {
      return (
        <Link href={`/dashboard/scans/${latest.id}`} className={`${ui.btn} ${ui.btnSm}`}>
          See findings
        </Link>
      );
    }
    return <RunCheckButton projectId={project.id} repoPath={project.repoPath} small />;
  }

  return (
    <>
      <ProjectHeader data={data} tab="lifecycle" action={<StageAction data={data} />} />
      <AutoRefresh active={busy} />

      <main className={ui.page}>
        {error && <p className={ui.error}>{error}</p>}

        <section className={`${ui.card} ${styles.stages}`} aria-label="Stages">
          <ol>
            {stages.map((s) => (
              <li key={s.id} className={styles[`stage-${s.status}`]} aria-current={s.status === "current" ? "step" : undefined}>
                <span className={styles.stageBar}>
                  <span style={{ width: `${stageFill(s)}%` }} />
                </span>
                <span className={styles.stageStatus}>{STATUS_LABEL[s.status]}</span>
                <span className={styles.stageName}>
                  {s.number} {s.name}
                </span>
                <span className={styles.stageSummary}>{s.summary}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className={styles.lifeGrid}>
          <div className={styles.lifeMain}>
            {(stage?.id === "build" || slices.length > 0) && <BuildSlices data={data} />}
            {stage && stage.id === "build" ? null : stage ? (
              <section className={ui.card} aria-labelledby="stage-title">
                <div className={styles.cardIntro}>
                  <h2 id="stage-title" className={ui.cardTitle}>
                    {stage.name}: what&apos;s left
                  </h2>
                  <p className={ui.cardSub}>{stage.intro}</p>
                </div>
                <ul className={styles.checkRows}>
                  {stage.checks.map((check) => (
                    <li key={check.label} className={check.passed ? undefined : styles.checkRowOpen}>
                      <div>
                        <p className={styles.checkRowTitle}>{check.label}</p>
                        <p className={styles.checkRowSub}>
                          {check.passed
                            ? "Passed"
                            : check.detail
                              ? check.detail
                              : check.pending
                              ? scanning
                                ? "Waiting for the check that's running"
                                : "Needs a readiness check"
                              : check.signoff
                                ? "Needs your sign-off"
                                : "Not passing yet"}
                        </p>
                      </div>
                      <span
                        className={`${ui.badge} ${
                          check.passed ? ui["tone-green"] : check.pending ? ui["tone-blue"] : ui["tone-amber"]
                        }`}
                      >
                        {check.passed ? "Passed" : check.pending ? "Pending" : "Open"}
                      </span>
                      {checkAction(check)}
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <section className={`${ui.card} ${ui.cardPad}`}>
                <h2 className={ui.cardTitle}>Live in production</h2>
                <p className={ui.cardSub}>Every gate passes. Keep running checks to stay there.</p>
              </section>
            )}

            {project.repoPath ? (
              <section className={ui.card} aria-labelledby="checks-title">
                <div className={styles.cardIntro}>
                  <h2 id="checks-title" className={ui.cardTitle}>
                    Readiness checks
                  </h2>
                  <p className={ui.cardSub}>
                    Each check scores the repository against every standard. Gates move on their own as the
                    score improves.
                  </p>
                </div>
                {scans.length === 0 ? (
                  <div className={ui.empty}>No checks yet.</div>
                ) : (
                  <ul className={styles.slices}>
                    {scans.slice(0, 6).map((s) => {
                      const badge = verdictBadge(s.verdict);
                      const live = s.status === "queued" || s.status === "active";
                      return (
                        <li key={s.id}>
                          <Link href={`/dashboard/scans/${s.id}`} className={styles.slice}>
                            <span>
                              <span className={ui.rowTitle}>
                                {new Date(s.createdAt).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span className={ui.rowSub}>
                                {s.status === "completed" && s.issueCounts
                                  ? `${s.issueCounts.critical} critical · ${s.issueCounts.high} high · ${
                                      s.issueCounts.medium + s.issueCounts.low
                                    } other`
                                  : live
                                    ? "Cloning and scanning the repository"
                                    : s.errorMessage ?? s.status}
                              </span>
                            </span>
                            {s.status === "completed" ? (
                              <span className={`${ui.badge} ${ui[`tone-${badge.tone}`]}`}>
                                {s.overallScore} · {badge.label}
                              </span>
                            ) : live ? (
                              <span className={`${ui.badge} ${ui["tone-blue"]}`}>Checking</span>
                            ) : (
                              <span className={`${ui.badge} ${ui["tone-red"]}`}>
                                {s.status === "failed" ? "Failed" : "Cancelled"}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ) : (
              <section id="connect" className={`${ui.card} ${ui.cardPad} ${styles.connect}`} aria-labelledby="connect-title">
                <h2 id="connect-title" className={ui.cardTitle}>
                  Connect the repository
                </h2>
                <p className={ui.cardSub}>
                  Once code exists, link its repository. Every readiness check of it moves the Build, Test,
                  Security and Deploy gates.
                </p>
                <form action={connectRepoAction} className={styles.connectForm}>
                  <input type="hidden" name="id" value={project.id} />
                  <span className={styles.inputWrap}>
                    <GitHubIcon size={17} />
                    <input
                      name="repoPath"
                      className={`${ui.input} ${styles.repoInput}`}
                      placeholder="https://github.com/org/repo.git"
                      aria-label="Repository URL"
                      pattern="https?://.+"
                      required
                    />
                  </span>
                  <button type="submit" className={ui.btnPrimary}>
                    Connect and check
                  </button>
                </form>
              </section>
            )}
          </div>

          <aside className={styles.lifeSide}>
            {stage && (
              <section className={styles.gate} aria-labelledby="gate-title">
                <p className={styles.bpEyebrow}>
                  Gate {stage.number} · {next ? `To move to ${next.name.toLowerCase()}` : "To go live"}
                </p>
                <h2 id="gate-title" className={styles.gateTitle}>
                  {passing} of {stage.checks.length} {stage.checks.length === 1 ? "check passes" : "checks pass"}
                </h2>
                <ul className={styles.gateList}>
                  {stage.checks.map((c) => (
                    <li key={c.label}>
                      <CheckMark check={c} />
                      {c.label}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {stage && mode !== "expert" && (
              <section className={`${ui.card} ${ui.cardPad}`} aria-labelledby="why-title">
                <h2 id="why-title" className={styles.sideTitle}>
                  <SparklesIcon size={16} /> Why this stage matters
                </h2>
                <p className={styles.sideText}>{stage.why}</p>
                <p className={styles.sideFoot}>Shown in Guided and Standard mode. {stage.sources}</p>
              </section>
            )}

            <section className={`${ui.card} ${ui.cardPad}`} aria-labelledby="activity-title">
              <h2 id="activity-title" className={styles.sideTitle}>
                Recent activity
              </h2>
              <ul className={styles.activity}>
                {activity(project, scans, slices).map((e) => (
                  <li key={`${e.text}-${e.at}`}>
                    {e.text}
                    <span suppressHydrationWarning>{relativeTime(e.at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
