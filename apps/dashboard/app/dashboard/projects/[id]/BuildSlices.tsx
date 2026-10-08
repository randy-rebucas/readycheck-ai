import Link from "next/link";
import type { BuildSlice } from "../../../../lib/api";
import { intakeProgress } from "../../../../lib/intake";
import { ExternalLinkIcon } from "../../../landing-icons";
import ui from "../../ui.module.css";
import styles from "../project.module.css";
import { planSlicesAction, retrySliceAction, startSlicesAction } from "../actions";
import type { ProjectData } from "./data";

function checksLabel(slice: BuildSlice): string | null {
  const checks = slice.pull?.checks;
  if (!checks || checks.total === 0) return null;
  if (checks.failed > 0) return `${checks.failed} of ${checks.total} checks failing`;
  if (checks.pending > 0) return "checks running";
  return "checks passed";
}

function SliceStatus({ slice }: { slice: BuildSlice }) {
  const checks = checksLabel(slice);
  switch (slice.status) {
    case "merged":
      return <span className={`${ui.badge} ${ui["tone-green"]}`}>Merged{checks ? ` · ${checks}` : ""}</span>;
    case "review":
      return (
        <span className={`${ui.badge} ${slice.pull?.checks?.failed ? ui["tone-red"] : ui["tone-amber"]}`}>
          {slice.pull?.checks?.failed ? "Checks failing" : "Needs review"}
        </span>
      );
    case "generating":
      return <span className={`${ui.badge} ${ui["tone-blue"]}`}>Generating</span>;
    case "queued":
      return <span className={`${ui.badge} ${ui["tone-neutral"]}`}>Queued</span>;
    case "failed":
      return <span className={`${ui.badge} ${ui["tone-red"]}`}>Failed</span>;
    case "closed":
      return <span className={`${ui.badge} ${ui["tone-neutral"]}`}>Closed without merging</span>;
    default:
      return <span className={`${ui.badge} ${ui["tone-neutral"]}`}>Planned</span>;
  }
}

function sliceLine(slice: BuildSlice, previous: BuildSlice | undefined, blocked: boolean): string {
  const stories = `${slice.stories.length} ${slice.stories.length === 1 ? "story" : "stories"}`;
  switch (slice.status) {
    case "merged":
    case "review": {
      const tests = slice.testsAdded ? ` · ${slice.testsAdded} test files` : "";
      const found = slice.issuesFound?.length
        ? ` · ${slice.issuesFound.length} ${slice.issuesFound.length === 1 ? "issue" : "issues"} found before you see it`
        : "";
      return `PR #${slice.prNumber} · ${stories}${tests}${slice.status === "review" ? found : ""}`;
    }
    case "generating":
      return "Writing code and tests";
    case "queued":
      if (blocked) return `${stories} · waits until the failed slice above is retried`;
      return previous && previous.status !== "merged" && previous.status !== "review"
        ? `${stories} · starts after ${previous.title.toLowerCase()}`
        : `${stories} · starting soon`;
    case "failed":
      return slice.error ?? "The builder stopped";
    default:
      return stories;
  }
}

export default function BuildSlices({ data }: { data: ProjectData }) {
  const { project, slices, githubConnected } = data;
  const planned = slices.filter((s) => s.status === "planned").length;
  const approved = Boolean(project.signoffs.plan) && intakeProgress(project.answers).complete;
  const canBuild = Boolean(project.repoPath) && githubConnected;

  return (
    <section className={ui.card} aria-labelledby="slices-title">
      <div className={`${styles.cardIntro} ${styles.cardIntroRow}`}>
        <div>
          <h2 id="slices-title" className={ui.cardTitle}>
            Build slices
          </h2>
          <p className={ui.cardSub}>
            Each slice is one feature and one pull request. Nothing reaches main until you approve it and its checks
            pass.
          </p>
        </div>
        <div className={ui.actions}>
          {approved && slices.length === 0 && (
            <form action={planSlicesAction}>
              <input type="hidden" name="id" value={project.id} />
              <button type="submit" className={ui.btnPrimary}>
                Plan slices from the Blueprint
              </button>
            </form>
          )}
          {planned > 0 && canBuild && (
            <form action={startSlicesAction}>
              <input type="hidden" name="id" value={project.id} />
              <button type="submit" className={ui.btnPrimary}>
                Start building {planned} {planned === 1 ? "slice" : "slices"}
              </button>
            </form>
          )}
        </div>
      </div>

      {slices.length === 0 ? (
        <div className={ui.empty}>
          {approved
            ? "No slices yet. Plan them from the Blueprint: one per first-release feature."
            : "Approve the Blueprint first; slices are planned from its first-release features."}
        </div>
      ) : (
        <ul className={styles.slices}>
          {slices.map((slice, i) => (
            <li key={slice.id} className={styles[`slice-${slice.status}`]}>
              <div className={styles.slice}>
                <span>
                  <span className={ui.rowTitle}>{slice.title}</span>
                  <span className={ui.rowSub}>
                    {sliceLine(
                      slice,
                      slices[i - 1],
                      slices.slice(0, i).some((s) => s.status === "failed")
                    )}
                  </span>
                </span>
                <span className={styles.sliceRight}>
                  <SliceStatus slice={slice} />
                  {slice.status === "review" && slice.prUrl && (
                    <a href={slice.prUrl} target="_blank" rel="noreferrer" className={`${ui.btn} ${ui.btnSm}`}>
                      Review <ExternalLinkIcon size={13} />
                    </a>
                  )}
                  {(slice.status === "failed" || slice.status === "closed") && (
                    <form action={retrySliceAction}>
                      <input type="hidden" name="id" value={project.id} />
                      <input type="hidden" name="sliceId" value={slice.id} />
                      <button type="submit" className={`${ui.btn} ${ui.btnSm}`}>
                        Retry
                      </button>
                    </form>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {planned > 0 && !canBuild && (
        <p className={`${ui.muted} ${styles.cardFoot}`}>
          {!project.repoPath ? (
            "Connect the project's repository below to start building."
          ) : (
            <>
              <Link href="/dashboard/settings#github" className={ui.textLink}>
                Connect GitHub
              </Link>{" "}
              so ReadyCheck can open pull requests.
            </>
          )}
        </p>
      )}
    </section>
  );
}
