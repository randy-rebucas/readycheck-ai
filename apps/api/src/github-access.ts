import { getPrismaClient } from "@readycheck/db";
import { GitHubClient, decryptSecret, parseGitHubRepo, type ChecksSummary } from "@readycheck/github";

const prisma = getPrismaClient();

/** The org's GitHub client, or null when GitHub isn't connected. */
export async function orgGitHub(orgId: string): Promise<{ client: GitHubClient; login: string } | null> {
  const connection = await prisma.gitHubConnection.findUnique({ where: { orgId } });
  if (!connection) return null;
  return { client: new GitHubClient(decryptSecret(connection.tokenEnc)), login: connection.login };
}

export interface PullStatus {
  state: "open" | "merged" | "closed";
  mergedAt: string | null;
  checks: ChecksSummary | null;
}

// PR state is read on page views; a short cache keeps that from spending the
// org's GitHub rate limit when several people (or polls) look at once.
const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; value: PullStatus }>();

export async function pullStatus(client: GitHubClient, repoPath: string, number: number): Promise<PullStatus | null> {
  const ref = parseGitHubRepo(repoPath);
  if (!ref) return null;
  const key = `${repoPath}#${number}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  try {
    const pr = await client.getPull(ref, number);
    const checks = await client.getChecks(ref, pr.head.sha).catch(() => null);
    const value: PullStatus = {
      state: pr.merged ? "merged" : pr.state,
      mergedAt: pr.merged_at,
      checks,
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return null;
  }
}

/** Repository paths the org may act on: its scans' paths and its projects' repositories. */
export async function orgOwnsRepo(orgId: string, repoPath: string): Promise<boolean> {
  const [scan, project] = await Promise.all([
    prisma.scan.findFirst({ where: { orgId, path: repoPath }, select: { id: true } }),
    prisma.project.findFirst({ where: { orgId, repoPath }, select: { id: true } }),
  ]);
  return Boolean(scan || project);
}
