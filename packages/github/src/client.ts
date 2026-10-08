import type { RepoRef } from "./repo";

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export interface PullRequest {
  number: number;
  html_url: string;
  state: "open" | "closed";
  merged: boolean;
  merged_at: string | null;
  head: { ref: string; sha: string };
}

export interface ChecksSummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  runs: { name: string; status: string; conclusion: string | null }[];
}

export interface Deployment {
  id: number;
  environment: string;
  ref: string;
  sha: string;
  createdAt: string;
  creator: string | null;
  /** Latest status: success | failure | error | inactive | in_progress | queued | pending, or null if none. */
  state: string | null;
  url: string | null;
}

interface RawDeployment {
  id: number;
  environment: string;
  ref: string;
  sha: string;
  created_at: string;
  creator: { login: string } | null;
}

/** Minimal GitHub REST client over fetch, authenticated with one token. */
export class GitHubClient {
  constructor(private readonly token: string) {}

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "readycheck",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new GitHubError(body?.message ?? `GitHub request failed: ${res.status}`, res.status);
    }
    return (res.status === 204 ? null : await res.json()) as T;
  }

  getUser(): Promise<{ login: string }> {
    return this.call("/user");
  }

  getRepo(ref: RepoRef): Promise<{ default_branch: string; permissions?: { push?: boolean } }> {
    return this.call(`/repos/${ref.owner}/${ref.repo}`);
  }

  createPull(ref: RepoRef, input: { title: string; head: string; base: string; body: string }): Promise<PullRequest> {
    return this.call(`/repos/${ref.owner}/${ref.repo}/pulls`, { method: "POST", body: JSON.stringify(input) });
  }

  getPull(ref: RepoRef, number: number): Promise<PullRequest> {
    return this.call(`/repos/${ref.owner}/${ref.repo}/pulls/${number}`);
  }

  async getChecks(ref: RepoRef, sha: string): Promise<ChecksSummary> {
    const data = await this.call<{ check_runs: { name: string; status: string; conclusion: string | null }[] }>(
      `/repos/${ref.owner}/${ref.repo}/commits/${sha}/check-runs?per_page=50`
    );
    const runs = data.check_runs.map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion }));
    const ok = ["success", "neutral", "skipped"];
    return {
      total: runs.length,
      passed: runs.filter((r) => r.status === "completed" && ok.includes(r.conclusion ?? "")).length,
      failed: runs.filter((r) => r.status === "completed" && !ok.includes(r.conclusion ?? "")).length,
      pending: runs.filter((r) => r.status !== "completed").length,
      runs,
    };
  }

  /** Deployments as Vercel, Render, Netlify, Actions etc. report them to GitHub. */
  async listDeployments(ref: RepoRef, limit = 20): Promise<Deployment[]> {
    const deployments = await this.call<RawDeployment[]>(
      `/repos/${ref.owner}/${ref.repo}/deployments?per_page=${limit}`
    );
    return Promise.all(
      deployments.map(async (d) => {
        const statuses = await this.call<{ state: string; environment_url?: string; target_url?: string }[]>(
          `/repos/${ref.owner}/${ref.repo}/deployments/${d.id}/statuses?per_page=1`
        ).catch(() => []);
        const latest = statuses[0];
        return {
          id: d.id,
          environment: d.environment,
          ref: d.ref,
          sha: d.sha,
          createdAt: d.created_at,
          creator: d.creator?.login ?? null,
          state: latest?.state ?? null,
          url: latest?.environment_url || latest?.target_url || null,
        };
      })
    );
  }
}
