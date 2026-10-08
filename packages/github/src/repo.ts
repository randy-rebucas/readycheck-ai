export interface RepoRef {
  owner: string;
  repo: string;
}

/** "https://github.com/acme/shop.git" -> { owner: "acme", repo: "shop" }; null for anything not on github.com. */
export function parseGitHubRepo(url: string): RepoRef | null {
  const match = /^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(url.trim());
  return match ? { owner: match[1], repo: match[2] } : null;
}

/** Clone/push URL carrying the token. Never log or persist it. */
export function authedCloneUrl(ref: RepoRef, token: string): string {
  return `https://x-access-token:${encodeURIComponent(token)}@github.com/${ref.owner}/${ref.repo}.git`;
}

/** Removes credentials from text before it is stored or shown (git errors echo the remote URL). */
export function redactToken(text: string, token?: string): string {
  let out = text.replace(/https:\/\/[^@\s/]+@github\.com/g, "https://github.com");
  if (token) out = out.split(token).join("***");
  return out;
}

/** Branch-safe slug: "Calendar sync with Google" -> "calendar-sync-with-google". */
export function slugify(text: string, max = 40): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max)
      .replace(/-+$/g, "") || "change"
  );
}
