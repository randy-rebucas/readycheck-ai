"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { FixInfo, FixRequest } from "../../../../../../lib/api";
import { triggerScanAction } from "../../../../../actions";
import { AlertTriangleIcon, CheckIcon, ClockIcon, ExternalLinkIcon, XIcon } from "../../../../../landing-icons";
import ui from "../../../../ui.module.css";
import { createFixAction, retryFixAction, scanFixesAction } from "../../../../fixes/actions";
import styles from "./finding.module.css";

interface FixPanelProps {
  scanId: string;
  repoPath: string;
  ruleId: string;
  fix: FixInfo;
  /** Latest fix request touching this rule, if any. */
  initial: FixRequest | null;
  githubConnected: boolean;
  isGitHubRepo: boolean;
}

const POLL_MS = 3000;

function DiffView({ diff }: { diff: string }) {
  const lines = diff.split("\n");
  return (
    <pre className={styles.diff} aria-label="Changes in this fix">
      {lines.map((line, i) => {
        const cls = line.startsWith("diff --git")
          ? styles.diffFile
          : line.startsWith("+") && !line.startsWith("+++")
            ? styles.diffAdd
            : line.startsWith("-") && !line.startsWith("---")
              ? styles.diffDel
              : line.startsWith("@@")
                ? styles.diffHunk
                : undefined;
        if (line.startsWith("index ") || line.startsWith("+++") || line.startsWith("---")) return null;
        return (
          <span key={i} className={cls}>
            {line.startsWith("diff --git") ? line.replace(/^diff --git a\/(\S+) b\/.*$/, "$1") : line}
            {"\n"}
          </span>
        );
      })}
    </pre>
  );
}

function Check({ ok, pending, children }: { ok: boolean; pending?: boolean; children: React.ReactNode }) {
  return (
    <li className={styles.branchCheck}>
      {pending ? (
        <ClockIcon size={15} className={styles.checkWait} />
      ) : ok ? (
        <CheckIcon size={15} className={styles.checkOk} />
      ) : (
        <XIcon size={13} className={styles.checkBad} />
      )}
      {children}
    </li>
  );
}

export default function FixPanel({ scanId, repoPath, ruleId, fix, initial, githubConnected, isGitHubRepo }: FixPanelProps) {
  const [request, setRequest] = useState<FixRequest | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const working = request?.status === "queued" || request?.status === "working";

  useEffect(() => {
    if (!working || !request) return undefined;
    const timer = window.setInterval(async () => {
      const result = await scanFixesAction(scanId);
      if (result.ok) {
        const latest = result.value.find((f) => f.id === request.id);
        if (latest) setRequest(latest);
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [working, request, scanId]);

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createFixAction(scanId, [ruleId]);
      if (result.ok) setRequest(result.value);
      else setError(result.error);
    });
  }

  function retry() {
    if (!request) return;
    setError(null);
    startTransition(async () => {
      const result = await retryFixAction(request.id);
      if (result.ok) setRequest(result.value);
      else setError(result.error);
    });
  }

  const confidence =
    fix.confidence === "high" ? (
      <span className={`${ui.badge} ${ui["tone-green"]}`}>High confidence</span>
    ) : (
      <span className={`${ui.badge} ${ui["tone-amber"]}`}>Review needed</span>
    );

  const blocked = !isGitHubRepo
    ? "Automatic fixes need a github.com repository."
    : !githubConnected
      ? "connect"
      : null;

  const v = request?.verification;
  const checks = request?.pull?.checks;
  const showResult = request && (request.status === "opened" || request.status === "merged" || request.status === "closed");

  return (
    <section className={`${ui.card} ${styles.fixCard}`} aria-labelledby="auto-fix-title">
      <div className={styles.fixHead}>
        <h2 id="auto-fix-title" className={ui.cardTitle}>
          Fix it for me
        </h2>
        {confidence}
      </div>

      {!showResult && (
        <ol className={styles.plan}>
          {fix.plan.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}

      {working && (
        <p className={`${ui.live} ${styles.working}`} aria-live="polite">
          {request?.status === "queued" ? "Waiting for a worker…" : "Writing the fix and re-scanning the branch…"}
        </p>
      )}

      {showResult && request && (
        <>
          <p className={styles.prLine}>
            {request.status === "merged" ? (
              <span className={`${ui.badge} ${ui["tone-green"]}`}>Merged</span>
            ) : request.status === "closed" ? (
              <span className={`${ui.badge} ${ui["tone-neutral"]}`}>Closed without merging</span>
            ) : (
              <span className={`${ui.badge} ${ui["tone-blue"]}`}>Pull request #{request.prNumber} open</span>
            )}{" "}
            on <code>{request.branch}</code>
          </p>
          {request.diff && <DiffView diff={request.diff} />}

          <p className={styles.branchTitle}>Checked on the branch</p>
          <ul className={styles.branchChecks}>
            {v && (
              <Check ok={v.resolved.includes(ruleId)}>
                {v.resolved.includes(ruleId) ? "Finding resolved on re-scan" : "Re-scan still reports the finding"}
              </Check>
            )}
            {v && (
              <Check ok={v.introduced.length === 0}>
                {v.introduced.length === 0 ? "No new findings" : `${v.introduced.length} new: ${v.introduced.join(", ")}`}
              </Check>
            )}
            {checks && checks.total > 0 ? (
              <Check ok={checks.failed === 0} pending={checks.failed === 0 && checks.pending > 0}>
                {checks.failed > 0
                  ? `${checks.failed} of ${checks.total} CI checks failing`
                  : checks.pending > 0
                    ? `CI running (${checks.passed} of ${checks.total} done)`
                    : `${checks.total} CI ${checks.total === 1 ? "check passes" : "checks pass"}`}
              </Check>
            ) : request.status === "opened" ? (
              <Check ok={false} pending>
                No CI checks reported yet
              </Check>
            ) : null}
          </ul>
        </>
      )}

      {fix.caveat && (
        <div className={styles.caveat} role="note">
          <AlertTriangleIcon size={16} />
          <p>{fix.caveat}</p>
        </div>
      )}

      {request?.status === "failed" && <p className={ui.error}>{request.error ?? "The fix failed."}</p>}
      {error && <p className={ui.error}>{error}</p>}

      {blocked === "connect" ? (
        <p className={ui.muted}>
          <Link href="/dashboard/settings#github" className={ui.textLink}>
            Connect GitHub
          </Link>{" "}
          so ReadyCheck can open pull requests.
        </p>
      ) : blocked ? (
        <p className={ui.muted}>{blocked}</p>
      ) : null}

      {request?.status === "opened" && request.prUrl ? (
        <a href={request.prUrl} target="_blank" rel="noreferrer" className={`${ui.btnPrimary} ${styles.fixButton}`}>
          Review the pull request <ExternalLinkIcon size={14} />
        </a>
      ) : request?.status === "merged" ? (
        <form action={triggerScanAction}>
          <input type="hidden" name="path" value={repoPath} />
          <button type="submit" className={`${ui.btnPrimary} ${styles.fixButton}`}>
            Re-scan to confirm
          </button>
        </form>
      ) : request?.status === "failed" ? (
        <button type="button" className={`${ui.btnPrimary} ${styles.fixButton}`} onClick={retry} disabled={pending}>
          {pending ? "Retrying…" : "Try again"}
        </button>
      ) : !working ? (
        <button
          type="button"
          className={`${ui.btnPrimary} ${styles.fixButton}`}
          onClick={create}
          disabled={pending || Boolean(blocked)}
        >
          {pending ? "Starting…" : "Create pull request"}
        </button>
      ) : null}
    </section>
  );
}
