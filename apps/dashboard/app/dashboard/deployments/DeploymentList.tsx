import type { Deployment } from "../../../lib/api";
import { relativeTime } from "../../../lib/projects";
import { ExternalLinkIcon } from "../../landing-icons";
import ui from "../ui.module.css";
import styles from "./deployments.module.css";

const STATE: Record<string, { label: string; tone: string }> = {
  success: { label: "Live", tone: "green" },
  inactive: { label: "Replaced", tone: "neutral" },
  failure: { label: "Failed", tone: "red" },
  error: { label: "Error", tone: "red" },
  in_progress: { label: "Deploying", tone: "blue" },
  queued: { label: "Queued", tone: "blue" },
  pending: { label: "Pending", tone: "blue" },
};

/** Deployments as GitHub reports them, newest first. */
export default function DeploymentList({ deployments }: { deployments: Deployment[] }) {
  if (deployments.length === 0) {
    return (
      <div className={ui.empty}>
        No deployments reported to GitHub yet. Vercel, Render, Netlify and GitHub Actions environments report them
        automatically once connected to the repository.
      </div>
    );
  }
  return (
    <div className={ui.table} role="table" aria-label="Deployments">
      <div className={`${ui.tableHead} ${styles.cols}`} role="row">
        <span role="columnheader">Environment</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Version</span>
        <span role="columnheader">When</span>
        <span role="columnheader" />
      </div>
      {deployments.map((d) => {
        const state = STATE[d.state ?? ""] ?? { label: d.state ?? "No status", tone: "neutral" };
        return (
          <div key={d.id} className={`${ui.tableRow} ${styles.cols}`} role="row">
            <span role="cell" className={ui.rowTitle}>
              {d.environment}
            </span>
            <span role="cell">
              <span className={`${ui.badge} ${ui[`tone-${state.tone}`]}`}>{state.label}</span>
            </span>
            <span role="cell" className={ui.muted}>
              {d.ref} · <code>{d.sha.slice(0, 7)}</code>
            </span>
            <span role="cell" className={ui.muted} suppressHydrationWarning>
              {relativeTime(d.createdAt)}
              {d.creator ? ` · ${d.creator}` : ""}
            </span>
            <span role="cell">
              {d.url && (
                <a href={d.url} target="_blank" rel="noreferrer" className={`${ui.btn} ${ui.btnSm}`}>
                  Open <ExternalLinkIcon size={13} />
                </a>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
