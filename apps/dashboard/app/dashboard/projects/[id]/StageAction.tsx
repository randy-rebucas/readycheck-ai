import Link from "next/link";
import type { SignoffStage } from "../../../../lib/api";
import { intakeProgress } from "../../../../lib/intake";
import { currentStage } from "../../../../lib/lifecycle";
import { sortBySeverity } from "../../../../lib/projects";
import ui from "../../ui.module.css";
import { runCheckAction, signoffAction } from "../actions";
import type { ProjectData } from "./data";

const SIGNOFF_LABEL: Record<SignoffStage, string> = {
  plan: "Approve blueprint",
  design: "Sign off design",
  build: "Mark features complete",
  uat: "Sign off staging",
  deploy: "Mark as live",
};

export function SignoffButton({
  projectId,
  stage,
  primary = false,
  small = false,
}: {
  projectId: string;
  stage: SignoffStage;
  primary?: boolean;
  small?: boolean;
}) {
  return (
    <form action={signoffAction}>
      <input type="hidden" name="id" value={projectId} />
      <input type="hidden" name="stage" value={stage} />
      <button type="submit" className={`${primary ? ui.btnPrimary : ui.btn} ${small ? ui.btnSm : ""}`}>
        {SIGNOFF_LABEL[stage]}
      </button>
    </form>
  );
}

export function RunCheckButton({
  projectId,
  repoPath,
  primary = false,
  small = false,
}: {
  projectId: string;
  repoPath: string;
  primary?: boolean;
  small?: boolean;
}) {
  return (
    <form action={runCheckAction}>
      <input type="hidden" name="id" value={projectId} />
      <input type="hidden" name="repoPath" value={repoPath} />
      <button type="submit" className={`${primary ? ui.btnPrimary : ui.btn} ${small ? ui.btnSm : ""}`}>
        Run readiness check
      </button>
    </form>
  );
}

/** The header's primary action: the next thing that moves the project forward. */
export default function StageAction({ data }: { data: ProjectData }) {
  const { project, latest, scanning } = data;
  const stage = currentStage(data.stages);
  const firstFinding = latest ? sortBySeverity(latest.issues)[0] : undefined;

  if (!stage) {
    return latest ? (
      <Link href={`/dashboard/scans/${latest.id}`} className={ui.btnPrimary}>
        Open latest report
      </Link>
    ) : null;
  }

  // A sign-off is the action only once every automatic check in the gate passes.
  const signoff = stage.checks.find((c) => c.signoff && !c.passed);
  const autoOpen = stage.checks.filter((c) => !c.signoff && !c.passed);

  const reviewing = data.slices.find((s) => s.status === "review" && s.prUrl);
  if (stage.id === "build" && reviewing) {
    return (
      <a href={reviewing.prUrl!} target="_blank" rel="noreferrer" className={ui.btnPrimary}>
        Review next slice
      </a>
    );
  }
  if (stage.id === "build" && data.slices.length > 0 && autoOpen.length === 0) {
    return null;
  }

  if (stage.id === "plan" && !intakeProgress(project.answers).complete) {
    return (
      <Link href={`/dashboard/projects/${project.id}/intake`} className={ui.btnPrimary}>
        Resume intake
      </Link>
    );
  }
  if (!project.repoPath && stage.number >= 3) {
    return (
      <a href="#connect" className={ui.btnPrimary}>
        Connect repository
      </a>
    );
  }
  if (autoOpen.length > 0 && project.repoPath) {
    if (scanning) return <span className={`${ui.live} ${ui.muted}`}>Checking the latest code</span>;
    if (latest && firstFinding && autoOpen.some((c) => !c.pending)) {
      return (
        <Link href={`/dashboard/scans/${latest.id}/findings/${firstFinding.id}`} className={ui.btnPrimary}>
          Fix next finding
        </Link>
      );
    }
    return <RunCheckButton projectId={project.id} repoPath={project.repoPath} primary />;
  }
  if (signoff?.signoff) return <SignoffButton projectId={project.id} stage={signoff.signoff} primary />;
  return null;
}
