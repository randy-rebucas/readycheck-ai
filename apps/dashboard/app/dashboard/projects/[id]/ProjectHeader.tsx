import Link from "next/link";
import { describePath, sortBySeverity, verdictBadge } from "../../../../lib/projects";
import { intakeProgress, kindLabel } from "../../../../lib/intake";
import { ChevronLeftIcon } from "../../../landing-icons";
import ui from "../../ui.module.css";
import styles from "../project.module.css";
import type { ProjectData } from "./data";

interface ProjectHeaderProps {
  data: ProjectData;
  tab: "blueprint" | "lifecycle" | "deployments";
  /** The one primary action for where the project is now. */
  action?: React.ReactNode;
}

export default function ProjectHeader({ data, tab, action }: ProjectHeaderProps) {
  const { project, latest } = data;
  const base = `/dashboard/projects/${project.id}`;
  const intake = intakeProgress(project.answers);
  const badge = latest ? verdictBadge(latest.verdict) : null;
  const firstFinding = latest ? sortBySeverity(latest.issues)[0] : undefined;

  const sub = project.repoPath
    ? `${describePath(project.repoPath).location} · built here`
    : intake.complete
      ? `${kindLabel(project.answers)} · no repository yet`
      : `New project · intake ${intake.answered} of ${intake.total}`;

  return (
    <header className={styles.topbar}>
      <div className={styles.topRow}>
        <div className={styles.intakeTitle}>
          <Link href="/dashboard" className={ui.backLink}>
            <ChevronLeftIcon size={15} />
            Projects
          </Link>
          <span className={styles.divider} aria-hidden="true" />
          <div>
            <h1 className={styles.barName}>{project.name}</h1>
            <p className={styles.barSub}>{sub}</p>
          </div>
        </div>
        <div className={ui.actions}>
          {latest?.overallScore != null && badge && (
            <span className={`${ui.badge} ${ui[`tone-${badge.tone}`]} ${styles.headBadge}`}>
              Readiness {latest.overallScore} · {badge.label}
            </span>
          )}
          {action}
        </div>
      </div>
      <nav className={styles.tabs} aria-label="Project sections">
        <Link
          href={`${base}/blueprint`}
          className={`${styles.tab} ${tab === "blueprint" ? styles.tabActive : ""}`}
          aria-current={tab === "blueprint" ? "page" : undefined}
        >
          Blueprint
        </Link>
        <Link
          href={base}
          className={`${styles.tab} ${tab === "lifecycle" ? styles.tabActive : ""}`}
          aria-current={tab === "lifecycle" ? "page" : undefined}
        >
          Lifecycle
        </Link>
        {latest ? (
          <Link href={`/dashboard/scans/${latest.id}`} className={styles.tab}>
            Standards report
          </Link>
        ) : (
          <span className={`${styles.tab} ${styles.tabOff}`} title="Available after the first readiness check">
            Standards report
          </span>
        )}
        {latest && firstFinding ? (
          <Link href={`/dashboard/scans/${latest.id}/findings/${firstFinding.id}`} className={styles.tab}>
            Fix Center
          </Link>
        ) : (
          <span className={`${styles.tab} ${styles.tabOff}`} title="Findings appear after a readiness check">
            Fix Center
          </span>
        )}
        <Link
          href={`${base}/deployments`}
          className={`${styles.tab} ${tab === "deployments" ? styles.tabActive : ""}`}
          aria-current={tab === "deployments" ? "page" : undefined}
        >
          Deployments
        </Link>
      </nav>
    </header>
  );
}
