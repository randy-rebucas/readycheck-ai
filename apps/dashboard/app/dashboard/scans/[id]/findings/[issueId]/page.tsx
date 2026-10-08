import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getGitHubConnection,
  getRules,
  getScan,
  listMembers,
  listScanFixes,
  listTriage,
  type Issue,
} from "../../../../../../lib/api";
import {
  SEVERITY_LABEL,
  categoryName,
  describePath,
  projectScores,
  sortBySeverity,
  stackSummary,
} from "../../../../../../lib/projects";
import { ChevronLeftIcon, ChevronRightIcon } from "../../../../../landing-icons";
import ui from "../../../../ui.module.css";
import FixPanel from "./FixPanel";
import FixSteps from "./FixSteps";
import SelfFixActions from "./SelfFixActions";
import TriagePanel from "./TriagePanel";
import styles from "./finding.module.css";

export const metadata = {
  title: "Finding — ReadyCheck AI",
};

const CATEGORY_WHY: Record<string, string> = {
  security:
    "Security findings are what attackers look for first. Left open, this can expose your users' data or your infrastructure.",
  testing: "Without automated tests, any change can break something nobody notices until users do.",
  devops: "Gaps in delivery and reliability make releases risky and outages slower to recover from.",
  architecture: "Structural problems get more expensive to fix the more code is built on top of them.",
  documentation: "Missing documentation slows down every new contributor and makes incidents harder to handle.",
  performance: "Performance problems cost you users and hosting money as traffic grows.",
};

const SEVERITY_CLASS: Record<Issue["severity"], string> = {
  critical: ui.sevCritical,
  high: ui.sevHigh,
  medium: ui.sevMedium,
  low: ui.sevLow,
};

const EFFORT: Record<string, string> = { XS: "15 min", S: "1 hour", M: "half a day", L: "a few days", XL: "a week or more" };

/** Splits a recommendation into sentences so each can be ticked off. */
function toSteps(recommendation: string): string[] {
  const steps = recommendation
    .split(/(?<=[.!?])\s+(?=[A-Z`])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return steps.length > 0 ? steps : [recommendation];
}

export default async function FindingPage({ params }: { params: Promise<{ id: string; issueId: string }> }) {
  const { id, issueId } = await params;

  let scan;
  try {
    scan = await getScan(id);
  } catch {
    notFound();
  }

  const ordered = sortBySeverity(scan.issues);
  const index = ordered.findIndex((i) => i.id === issueId);
  if (index === -1) notFound();
  const issue = ordered[index];
  const prev = ordered[index - 1];
  const next = ordered[index + 1];

  const [rules, fixes, triage, members, github] = await Promise.all([
    getRules().catch(() => null),
    listScanFixes(scan.id).catch(() => []),
    listTriage(scan.path).catch(() => []),
    listMembers().catch(() => []),
    getGitHubConnection().catch(() => null),
  ]);
  const rule = rules?.rules.find((r) => r.id === issue.ruleId);
  const pack = rules?.packs.find((p) => p.id === rule?.pack);
  const fixRequest = fixes.find((f) => f.ruleIds.includes(issue.ruleId)) ?? null;
  const itsTriage = triage.find((t) => t.ruleId === issue.ruleId) ?? null;
  const autoFixable = rule && rule.fix.kind !== "guided";

  const { name } = describePath(scan.path);
  const reportHref = `/dashboard/scans/${scan.id}`;
  const findingHref = (i: Issue) => `${reportHref}/findings/${i.id}`;
  const stack = stackSummary(scan);

  // Projected effect of fixing just this finding, relative to stored scores.
  const base = projectScores(scan.issues, []);
  const after = projectScores(scan.issues, [issue]);
  const currentCategory = scan.categoryScores.find((c) => c.category === issue.category)?.score;
  const categoryLift = (after.categories[issue.category] ?? 0) - (base.categories[issue.category] ?? 0);
  const overallLift = after.overall - base.overall;

  return (
    <>
      <header className={styles.topbar}>
        <Link href={reportHref} className={ui.backLink}>
          <ChevronLeftIcon size={15} />
          {name}
        </Link>
        <span className={styles.crumbSep} aria-hidden="true">
          /
        </span>
        <span className={styles.crumbCurrent}>Fix Center</span>
      </header>

      <main className={ui.page}>
        <div className={styles.head}>
          <Link href={reportHref} className={`${ui.textLink} ${styles.counter}`}>
            Finding {index + 1} of {ordered.length}
          </Link>
          <div className={styles.pills}>
            <span className={`${ui.badge} ${SEVERITY_CLASS[issue.severity]}`}>{SEVERITY_LABEL[issue.severity]}</span>
            <span className={`${ui.badge} ${styles.outlinePill}`}>{categoryName(issue.category)}</span>
            {issue.severity === "critical" && <span className={`${ui.badge} ${ui["tone-red"]}`}>Blocks deployment</span>}
            {itsTriage?.dismissedAt && <span className={`${ui.badge} ${ui["tone-neutral"]}`}>Doesn&apos;t apply</span>}
          </div>
          <h1 className={styles.title}>{issue.message}</h1>
          <p className={styles.why}>
            {CATEGORY_WHY[issue.category.toLowerCase()] ?? "This finding lowers the app's readiness score."}
          </p>
          <p className={styles.meta}>
            {issue.ruleId} · {rule?.description ?? categoryName(issue.category)} · found{" "}
            {new Date(scan.completedAt ?? scan.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        <div className={`${styles.grid} ${autoFixable ? styles.gridThree : ""}`}>
          {autoFixable && rule && (
            <FixPanel
              scanId={scan.id}
              repoPath={scan.path}
              ruleId={issue.ruleId}
              fix={rule.fix}
              initial={fixRequest}
              githubConnected={Boolean(github?.connected)}
              isGitHubRepo={/^https?:\/\/(www\.)?github\.com\//i.test(scan.path)}
            />
          )}

          <section className={`${ui.card} ${styles.selfCard}`} aria-labelledby="fix-title">
            <div className={styles.fixHead}>
              <h2 id="fix-title" className={ui.cardTitle}>
                I&apos;ll fix it myself
              </h2>
              {issue.estimatedEffort && <span className={ui.muted}>About {EFFORT[issue.estimatedEffort] ?? issue.estimatedEffort}</span>}
            </div>
            {stack && <p className={styles.stackNote}>Steps for {stack}, the stack we found.</p>}
            <FixSteps storageKey={`rc_fix:${scan.path}:${issue.ruleId}`} steps={toSteps(issue.recommendation)} />
            <SelfFixActions scanId={scan.id} issueId={issue.id} repoPath={scan.path} />
          </section>

          <aside className={styles.side}>
            <section className={`${ui.card} ${ui.cardPad}`} aria-labelledby="about-title">
              <h2 id="about-title" className={styles.sideTitle}>
                About this finding
              </h2>
              <dl className={styles.facts}>
                <dt>Standard</dt>
                <dd>{rule?.standards.length ? rule.standards.join(" · ") : categoryName(issue.category)}</dd>
                {rule && (
                  <>
                    <dt>Risk of the fix</dt>
                    <dd>{rule.fix.kind === "guided" ? "Depends" : rule.fix.confidence === "high" ? "Low" : "Medium"}</dd>
                  </>
                )}
                {currentCategory !== undefined && categoryLift > 0 && (
                  <>
                    <dt>Score after fix</dt>
                    <dd>
                      {categoryName(issue.category)} {currentCategory} → {Math.min(100, currentCategory + categoryLift)}
                    </dd>
                  </>
                )}
                {scan.overallScore != null && overallLift > 0 && (
                  <>
                    <dt>Readiness after fix</dt>
                    <dd>
                      {scan.overallScore} → {Math.min(100, scan.overallScore + overallLift)}
                    </dd>
                  </>
                )}
                <dt>Found by</dt>
                <dd>{pack ? `${pack.name} rule pack` : "ReadyCheck rules"}</dd>
              </dl>
            </section>

            <TriagePanel repoPath={scan.path} ruleId={issue.ruleId} members={members} initial={itsTriage} />

            <nav className={styles.pager} aria-label="Other findings">
              {prev ? (
                <Link href={findingHref(prev)} className={`${ui.btn} ${ui.btnSm}`}>
                  <ChevronLeftIcon size={14} /> Previous
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link href={findingHref(next)} className={`${ui.btn} ${ui.btnSm}`}>
                  Next <ChevronRightIcon size={14} />
                </Link>
              )}
            </nav>
          </aside>
        </div>
      </main>
    </>
  );
}
