"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { GitHubConnection } from "../../../lib/api";
import { GitHubIcon } from "../../landing-icons";
import { connectGitHubAction, disconnectGitHubAction } from "./github-actions";
import styles from "./settings.module.css";

const TOKEN_URL =
  "https://github.com/settings/personal-access-tokens/new?description=ReadyCheck&contents=write&pull_requests=write&deployments=read&checks=read";

/** Lets an admin give the org's ReadyCheck access to GitHub (pull requests, checks, deployments). */
export default function GitHubPanel({ initial }: { initial: GitHubConnection | null }) {
  const [connection, setConnection] = useState(initial);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function connect(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await connectGitHubAction(token.trim());
      if (result.ok) {
        setConnection(result.value);
        setToken("");
      } else setError(result.error);
    });
  }

  function disconnect() {
    setError(null);
    startTransition(async () => {
      const result = await disconnectGitHubAction();
      if (result.ok) setConnection({ connected: false, login: null, connectedAt: null });
      else setError(result.error ?? "Could not disconnect");
    });
  }

  return (
    <section className={styles.card} id="github">
      <h2 className={styles.sectionTitle}>
        <GitHubIcon size={17} />
        GitHub
      </h2>

      {initial === null && <p className={styles.noteError}>Couldn&apos;t load the GitHub connection. Refresh to try again.</p>}

      {connection?.connected ? (
        <>
          <p className={styles.sectionText}>
            Connected as <strong>{connection.login}</strong>. ReadyCheck opens pull requests for fixes and build slices,
            reads their checks, and lists deployments for this organization&apos;s repositories. Nothing is ever pushed
            to a default branch.
          </p>
          <button type="button" className={styles.leaveBtn} onClick={disconnect} disabled={pending}>
            Disconnect GitHub
          </button>
        </>
      ) : (
        <>
          <p className={styles.sectionText}>
            Connect GitHub to let &ldquo;Fix it for me&rdquo; and build slices open pull requests. Create a{" "}
            <a href={TOKEN_URL} target="_blank" rel="noreferrer">
              fine-grained token
            </a>{" "}
            for the repositories you want ReadyCheck to work on, with read and write access to Contents and Pull
            requests, and read access to Checks and Deployments. It&apos;s stored encrypted and never shown again.
          </p>
          <form className={styles.inlineForm} onSubmit={connect}>
            <label className={styles.srOnly} htmlFor="github-token">
              GitHub token
            </label>
            <input
              id="github-token"
              type="password"
              autoComplete="off"
              required
              placeholder="github_pat_…"
              className={styles.textInput}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button type="submit" className={styles.primaryBtn} disabled={pending || !token.trim()}>
              {pending ? "Checking…" : "Connect"}
            </button>
          </form>
          <p className={styles.note}>Only organization owners and admins can connect or disconnect GitHub.</p>
        </>
      )}

      {error && (
        <p className={styles.noteError} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
