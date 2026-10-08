import type { BuildSlice, Deployment, Project, Scan, ScanDetail, SignoffStage } from "./api";
import { intakeProgress } from "./intake";

/**
 * The eight stages from idea to production. A stage is done when every check
 * in its gate passes and the stage before it is done; checks come from the
 * intake, the linked repository's latest scan, or a person signing off.
 */

export type StageStatus = "done" | "current" | "next" | "later";

export interface GateCheck {
  label: string;
  passed: boolean;
  /** Progress line shown while the check is open. */
  detail?: string;
  /** Not decidable yet, e.g. no scan to read a score from. */
  pending?: boolean;
  /** Which hand sign-off satisfies this check, if any. */
  signoff?: SignoffStage;
}

export interface Stage {
  id: string;
  number: number;
  name: string;
  /** Short state line under the stage name. */
  summary: string;
  checks: GateCheck[];
  /** What moves this stage forward, shown above its checks. */
  intro: string;
  /** Why the stage exists, shown in Guided and Standard mode. */
  why: string;
  sources: string;
  status: StageStatus;
}

const READY_SCORE = 75;
const TESTING_SCORE = 70;
const SECURITY_SCORE = 70;
const DEVOPS_SCORE = 60;

function categoryScore(scan: ScanDetail | null, category: string): number | null {
  return scan?.categoryScores.find((c) => c.category === category)?.score ?? null;
}

function scoreCheck(label: string, score: number | null, min: number): GateCheck {
  return score === null
    ? { label: `${label} ${min} or more`, passed: false, pending: true }
    : { label: `${label} ${min} or more (${score})`, passed: score >= min };
}

export interface LifecycleExtras {
  /** Build slices of the project; when present they replace the build sign-off. */
  slices?: BuildSlice[];
  /** Deployments GitHub reports for the repository. */
  deployments?: Deployment[];
}

/** Story counts across slices: a story is accepted once its slice is merged. */
export function storyProgress(slices: BuildSlice[]): { accepted: number; total: number } {
  return slices.reduce(
    (acc, s) => ({
      total: acc.total + s.stories.length,
      accepted: acc.accepted + (s.status === "merged" ? s.stories.length : 0),
    }),
    { accepted: 0, total: 0 }
  );
}

const PRODUCTION = /^(prod|production|live)$/i;

export function buildLifecycle(
  project: Project,
  latest: ScanDetail | null,
  scanning: Scan | null,
  extras: LifecycleExtras = {}
): Stage[] {
  const intake = intakeProgress(project.answers);
  const slices = extras.slices ?? [];
  const stories = storyProgress(slices);
  const liveDeploy = (extras.deployments ?? []).find((d) => PRODUCTION.test(d.environment) && d.state === "success");
  const signed = (s: SignoffStage) => Boolean(project.signoffs[s]);
  const counts = latest
    ? latest.issues.reduce(
        (acc, i) => ({ ...acc, [i.severity]: acc[i.severity] + 1 }),
        { critical: 0, high: 0, medium: 0, low: 0 }
      )
    : null;
  const scored = latest?.status === "completed";

  const draft: Omit<Stage, "status">[] = [
    {
      id: "plan",
      intro: "Finish the intake, then approve the Blueprint it produced.",
      number: 1,
      name: "Plan",
      summary: signed("plan") ? "Blueprint approved" : intake.complete ? "Blueprint ready to approve" : `Intake ${intake.answered} of ${intake.total}`,
      checks: [
        { label: "Intake answered", passed: intake.complete, detail: `${intake.answered} of about ${intake.total} answered` },
        { label: "Blueprint approved", passed: signed("plan"), signoff: "plan" },
      ],
      why: "Deciding scope, stack and standards before code is written is far cheaper than changing them after.",
      sources: "Sources: ISO/IEC/IEEE 29148, Google engineering practices.",
    },
    {
      id: "design",
      intro: "Review the screens and flows against the Blueprint, then sign them off.",
      number: 2,
      name: "Design",
      summary: signed("design") ? `Signed off ${shortDate(project.signoffs.design.at)}` : "Waiting for sign-off",
      checks: [{ label: "Screens and flows signed off", passed: signed("design"), signoff: "design" }],
      why: "Agreeing on screens first means the build doesn't stall on questions about what goes where.",
      sources: "Sources: Nielsen Norman Group, WCAG 2.2.",
    },
    {
      id: "foundation",
      intro: "Connect the repository the app is built in. Its first readiness check sets the baseline.",
      number: 3,
      name: "Foundation",
      summary: project.repoPath ? (scored ? "Repository checked" : "Repository connected") : "No repository yet",
      checks: [
        { label: "Repository connected", passed: Boolean(project.repoPath) },
        { label: "First readiness check completed", passed: scored },
      ],
      why: "A repository with checks running from day one catches problems while they're still small.",
      sources: "Sources: 12-Factor App, DORA research.",
    },
    {
      id: "build",
      intro:
        slices.length > 0
          ? "Each slice is one feature and one pull request. Nothing reaches main until you approve it and its checks pass."
          : "Plan the build slices from the Blueprint, or build yourself and mark features complete when the first release is done.",
      number: 4,
      name: "Build",
      summary: slices.length > 0
        ? `${stories.accepted} of ${stories.total} stories`
        : signed("build")
        ? "Features complete"
        : scanning
          ? "Checking latest code"
          : latest?.overallScore != null
            ? `Readiness ${latest.overallScore}`
            : "One feature at a time",
      checks: [
        { label: "Latest check completed", passed: scored && !scanning, pending: Boolean(scanning) },
        { label: "No critical findings", passed: scored && counts!.critical === 0, pending: !scored },
        scoreCheck("Readiness score", latest?.overallScore ?? null, READY_SCORE),
        slices.length > 0
          ? {
              label: `All ${stories.total} stories accepted (${stories.accepted} so far)`,
              passed: stories.total > 0 && stories.accepted === stories.total,
              pending: stories.accepted < stories.total,
            }
          : { label: "All first-release features built", passed: signed("build"), signoff: "build" },
      ],
      why: "Building in small slices keeps every change reviewable. If one feature breaks, you roll back that slice, not the whole app.",
      sources: "Sources: 12-Factor App, Google engineering practices.",
    },
    {
      id: "test",
      intro: "Checks come from the latest readiness check of your repository.",
      number: 5,
      name: "Test and QA",
      summary: "Automated tests cover the app",
      checks: [scoreCheck("Testing score", categoryScore(latest, "testing"), TESTING_SCORE)],
      why: "Automated tests are what let you keep changing the app after launch without breaking it.",
      sources: "Sources: Google Testing Blog, ISTQB.",
    },
    {
      id: "security",
      intro: "Checks come from the latest readiness check of your repository.",
      number: 6,
      name: "Security",
      summary: "No critical or high",
      checks: [
        {
          label: "No critical or high findings",
          passed: scored && counts!.critical + counts!.high === 0,
          pending: !scored,
        },
        scoreCheck("Security score", categoryScore(latest, "security"), SECURITY_SCORE),
      ],
      why: "Most breaches use known, fixable weaknesses. Clearing them before launch is the cheapest time.",
      sources: "Sources: OWASP Top 10, OWASP ASVS.",
    },
    {
      id: "uat",
      intro: "Put the app on staging and have its owner try every first-release feature.",
      number: 7,
      name: "Staging, UAT",
      summary: signed("uat") ? "Owner signed off" : "Owner sign-off",
      checks: [{ label: "Owner tested on staging and signed off", passed: signed("uat"), signoff: "uat" }],
      why: "The people who asked for the app check it does what they need before real users see it.",
      sources: "Sources: ISTQB acceptance testing.",
    },
    {
      id: "deploy",
      intro: "Release to production once delivery and monitoring are in place.",
      number: 8,
      name: "Deploy",
      summary: signed("deploy") || liveDeploy ? "Live" : "Monitoring, rollback",
      checks: [
        scoreCheck("DevOps score", categoryScore(latest, "devops"), DEVOPS_SCORE),
        liveDeploy
          ? { label: `Released to production (${shortDate(liveDeploy.createdAt)})`, passed: true }
          : { label: "Released to production", passed: signed("deploy"), signoff: "deploy" },
      ],
      why: "Monitoring and a tested rollback mean a bad release costs minutes, not days.",
      sources: "Sources: Google SRE book, DORA research.",
    },
  ];

  // Stages complete in order: everything before the first open gate is done.
  const firstOpen = draft.findIndex((stage) => !stage.checks.every((c) => c.passed));
  const current = firstOpen === -1 ? draft.length : firstOpen;
  return draft.map((stage, i) => ({
    ...stage,
    status: i < current ? "done" : i === current ? "current" : i === current + 1 ? "next" : "later",
  }));
}

export function currentStage(stages: Stage[]): Stage | null {
  return stages.find((s) => s.status === "current") ?? null;
}

/** "4 of 8 · Build", or "8 of 8 · Live" once everything passes. */
export function stageLabel(stages: Stage[]): string {
  const current = currentStage(stages);
  if (!current) return `8 of 8 · Live`;
  return `${current.number} of 8 · ${current.name}`;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
