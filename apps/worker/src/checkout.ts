import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import simpleGit, { type SimpleGit } from "simple-git";
import { getPrismaClient } from "@readycheck/db";
import {
  GitHubClient,
  authedCloneUrl,
  decryptSecret,
  parseGitHubRepo,
  redactToken,
  type RepoRef,
} from "@readycheck/github";

const prisma = getPrismaClient();

const MAX_DIFF_CHARS = 60_000;

/** A writable clone of an org's GitHub repository, on a new branch. */
export interface Checkout {
  dir: string;
  git: SimpleGit;
  ref: RepoRef;
  github: GitHubClient;
  baseBranch: string;
  branch: string;
  /** Strips the token from anything about to be stored or thrown. */
  redact(text: string): string;
  cleanup(): void;
}

/** Errors meant for the person (missing connection, no push access), stored verbatim. */
export class JobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobError";
  }
}

export async function checkout(orgId: string, repoPath: string, branch: string): Promise<Checkout> {
  const ref = parseGitHubRepo(repoPath);
  if (!ref) throw new JobError("Automatic changes need a github.com repository.");

  const connection = await prisma.gitHubConnection.findUnique({ where: { orgId } });
  if (!connection) throw new JobError("Connect GitHub in Settings so ReadyCheck can open pull requests.");
  const token = decryptSecret(connection.tokenEnc);
  const github = new GitHubClient(token);

  const repo = await github.getRepo(ref).catch(() => {
    throw new JobError(`The connected GitHub account (${connection.login}) can't see ${ref.owner}/${ref.repo}.`);
  });
  if (repo.permissions && repo.permissions.push === false) {
    throw new JobError(`The connected GitHub account (${connection.login}) can't push to ${ref.owner}/${ref.repo}.`);
  }

  const dir = mkdtempSync(join(tmpdir(), "readycheck-change-"));
  const redact = (text: string) => redactToken(text, token);
  try {
    await simpleGit().clone(authedCloneUrl(ref, token), dir, ["--depth", "1", "--branch", repo.default_branch]);
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    throw new JobError(`Could not clone the repository: ${redact(err instanceof Error ? err.message : String(err))}`);
  }

  const git = simpleGit(dir);
  await git.addConfig("user.name", "ReadyCheck");
  await git.addConfig("user.email", "readycheck@users.noreply.github.com");
  await git.checkoutLocalBranch(branch);

  return {
    dir,
    git,
    ref,
    github,
    baseBranch: repo.default_branch,
    branch,
    redact,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Stages everything and returns the diff, with .env file contents left out. */
export async function stageAndDiff(co: Checkout): Promise<{ diff: string; files: string[] }> {
  await co.git.add(["-A"]);
  const files = (await co.git.diff(["--cached", "--name-only"])).split("\n").filter(Boolean);
  let diff = await co.git.diff(["--cached", "--", ".", ":(exclude,glob)**/.env*"]);
  const envFiles = (await co.git.diff(["--cached", "--name-status", "--", ":(glob)**/.env*"])).trim();
  if (envFiles) diff += `\n# Environment files changed (contents not shown):\n${envFiles}\n`;
  if (diff.length > MAX_DIFF_CHARS) diff = `${diff.slice(0, MAX_DIFF_CHARS)}\n… diff truncated`;
  return { diff, files };
}

/** Commits staged changes, pushes the branch and opens a pull request against the default branch. */
export async function openPullRequest(
  co: Checkout,
  input: { title: string; body: string; commitMessage: string }
): Promise<{ number: number; url: string }> {
  await co.git.commit(input.commitMessage);
  try {
    await co.git.push("origin", co.branch, ["--set-upstream"]);
  } catch (err) {
    throw new JobError(`Could not push the branch: ${co.redact(err instanceof Error ? err.message : String(err))}`);
  }
  const pr = await co.github.createPull(co.ref, {
    title: input.title,
    head: co.branch,
    base: co.baseBranch,
    body: input.body,
  });
  return { number: pr.number, url: pr.html_url };
}
