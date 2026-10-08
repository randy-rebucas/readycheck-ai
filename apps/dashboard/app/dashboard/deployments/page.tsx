import Link from "next/link";
import {
  getGitHubConnection,
  listDeployments,
  listProjects,
  listScans,
  type Deployment,
} from "../../../lib/api";
import { describePath } from "../../../lib/projects";
import ui from "../ui.module.css";
import DeploymentList from "./DeploymentList";
import styles from "./deployments.module.css";

export const metadata = {
  title: "Deployments — ReadyCheck AI",
};

/** One GitHub call per repository (plus one per deployment); keep the page bounded. */
const MAX_REPOS = 10;

const isGitHub = (path: string) => /^https?:\/\/(www\.)?github\.com\//i.test(path);

export default async function DeploymentsPage() {
  const [connection, projects, scans] = await Promise.all([
    getGitHubConnection().catch(() => null),
    listProjects().catch(() => []),
    listScans().catch(() => []),
  ]);

  // Projects built here first (by name), then audited repositories.
  const repos = new Map<string, { name: string; href: string }>();
  for (const p of projects) {
    if (p.repoPath && isGitHub(p.repoPath)) repos.set(p.repoPath, { name: p.name, href: `/dashboard/projects/${p.id}/deployments` });
  }
  for (const s of scans) {
    if (isGitHub(s.path) && !repos.has(s.path)) repos.set(s.path, { name: describePath(s.path).name, href: `/dashboard/scans/${s.id}` });
  }
  const list = [...repos.entries()].slice(0, MAX_REPOS);

  const results = connection?.connected
    ? await Promise.all(
        list.map(([path]) =>
          listDeployments(path).then(
            (d): { deployments: Deployment[]; error: null } => ({ deployments: d, error: null }),
            (err): { deployments: null; error: string } => ({
              deployments: null,
              error: err instanceof Error ? err.message : "Could not read deployments",
            })
          )
        )
      )
    : [];

  return (
    <main className={ui.page}>
      <div className={ui.pageHead}>
        <div>
          <h1 className={ui.pageTitle}>Deployments</h1>
          <p className={ui.pageSub}>What&apos;s running where, as your hosting provider reports it to GitHub</p>
        </div>
      </div>

      {!connection?.connected ? (
        <section className={`${ui.card} ${ui.cardPad}`}>
          <h2 className={ui.cardTitle}>Connect GitHub to see deployments</h2>
          <p className={ui.cardSub}>
            Vercel, Render, Netlify and GitHub Actions report each deployment to GitHub. Once connected, they show up
            here and the Deploy stage of each project passes when production is live.
          </p>
          <p>
            <Link href="/dashboard/settings#github" className={ui.btnPrimary}>
              Connect GitHub
            </Link>
          </p>
        </section>
      ) : list.length === 0 ? (
        <section className={`${ui.card} ${ui.empty}`}>
          No GitHub repositories yet. Check a repository or connect one to a project first.
        </section>
      ) : (
        <div className={styles.repos}>
          {list.map(([path, repo], i) => (
            <section key={path} className={ui.card} aria-labelledby={`repo-${i}`}>
              <div className={ui.cardHead}>
                <div>
                  <h2 id={`repo-${i}`} className={ui.cardTitle}>
                    <Link href={repo.href} className={styles.repoLink}>
                      {repo.name}
                    </Link>
                  </h2>
                  <p className={ui.cardSub}>{describePath(path).location}</p>
                </div>
              </div>
              {results[i]?.error ? (
                <div className={ui.cardPad}>
                  <p className={ui.error}>{results[i].error}</p>
                </div>
              ) : (
                <DeploymentList deployments={results[i]?.deployments ?? []} />
              )}
            </section>
          ))}
        </div>
      )}
      {repos.size > MAX_REPOS && <p className={ui.muted}>Showing the first {MAX_REPOS} repositories.</p>}
    </main>
  );
}
