import type { Issue, IssueCounts, Scan } from "./api";

/**
 * A "project" is every scan of the same repository path. The API has no
 * project entity; grouping by path is what the plan's repository limit does
 * too (see the API's scans controller).
 */
export interface Project {
  path: string;
  name: string;
  location: string;
  /** Most recent scan of any status (may still be running). */
  latest: Scan;
  /** Most recent completed scan, the one readiness numbers come from. */
  latestCompleted: Scan | null;
  /** The completed scan before latestCompleted, for trend deltas. */
  previousCompleted: Scan | null;
  scanCount: number;
}

/** Expects scans newest first, as the API returns them. */
export function groupProjects(scans: Scan[]): Project[] {
  const byPath = new Map<string, Project>();
  for (const scan of scans) {
    let project = byPath.get(scan.path);
    if (!project) {
      const { name, location } = describePath(scan.path);
      project = {
        path: scan.path,
        name,
        location,
        latest: scan,
        latestCompleted: null,
        previousCompleted: null,
        scanCount: 0,
      };
      byPath.set(scan.path, project);
    }
    project.scanCount += 1;
    if (scan.status === "completed") {
      if (!project.latestCompleted) project.latestCompleted = scan;
      else if (!project.previousCompleted) project.previousCompleted = scan;
    }
  }
  return [...byPath.values()];
}

/** "https://github.com/acme/shop.git" -> { name: "shop", location: "github.com/acme/shop" }. */
export function describePath(path: string): { name: string; location: string } {
  const trimmed = path.replace(/\.git$/, "").replace(/\/+$/, "");
  if (/^https?:\/\//.test(trimmed)) {
    const location = trimmed.replace(/^https?:\/\//, "");
    const name = location.split("/").pop() || location;
    return { name, location };
  }
  const name = trimmed.split(/[\\/]/).pop() || trimmed;
  return { name, location: trimmed };
}

export const SEVERITIES = ["critical", "high", "medium", "low"] as const;

export const SEVERITY_LABEL: Record<Issue["severity"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function emptyCounts(): IssueCounts {
  return { critical: 0, high: 0, medium: 0, low: 0 };
}

export function countIssues(issues: Issue[]): IssueCounts {
  const counts = emptyCounts();
  for (const issue of issues) counts[issue.severity] += 1;
  return counts;
}

export function sortBySeverity<T extends { severity: Issue["severity"] }>(items: T[]): T[] {
  return [...items].sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
}

export type Tone = "green" | "blue" | "amber" | "red" | "neutral";

/** Short readiness badge for a scan verdict (verdicts come from @readycheck/scoring). */
export function verdictBadge(verdict: string | null): { label: string; tone: Tone } {
  switch (verdict) {
    case "Ready":
      return { label: "Production-ready", tone: "green" };
    case "Ready with Minor Improvements":
      return { label: "Nearly ready", tone: "blue" };
    case "Not Ready":
      return { label: "Not ready", tone: "amber" };
    case "High Risk":
      return { label: "High risk", tone: "red" };
    default:
      return { label: "Not scored", tone: "neutral" };
  }
}

/** Word grade for a 0-100 category score. */
export function scoreGrade(score: number): { label: string; tone: Tone } {
  if (score >= 80) return { label: "Good", tone: "green" };
  if (score >= 65) return { label: "Fair", tone: "blue" };
  if (score >= 45) return { label: "Weak", tone: "amber" };
  return { label: "Poor", tone: "red" };
}

const CATEGORY_NAMES: Record<string, string> = {
  architecture: "Architecture",
  security: "Security",
  devops: "DevOps and reliability",
  testing: "Testing",
  documentation: "Documentation",
  performance: "Performance",
  database: "Database",
};

export function categoryName(category: string): string {
  return CATEGORY_NAMES[category.toLowerCase()] ?? category.charAt(0).toUpperCase() + category.slice(1);
}

const FRAMEWORK_NAMES: Record<string, string> = {
  nextjs: "Next.js",
  react: "React",
  express: "Express",
  nestjs: "NestJS",
  vue: "Vue",
  nuxt: "Nuxt",
  svelte: "Svelte",
  angular: "Angular",
  django: "Django",
  flask: "Flask",
  fastapi: "FastAPI",
  rails: "Rails",
  prisma: "Prisma",
};

export function stackSummary(scan: Scan | null): string {
  const facts = scan?.facts;
  if (!facts) return "";
  const names = (facts.frameworks ?? []).map(
    (f) => FRAMEWORK_NAMES[f] ?? f.charAt(0).toUpperCase() + f.slice(1)
  );
  if (names.length === 0) names.push(...(facts.languages ?? []).slice(0, 2));
  return names.join(" · ");
}

// Mirrors @readycheck/scoring (not a dashboard dependency): each finding
// costs its category a fixed penalty, and the overall score is a weighted
// sum of category scores. Used to show what fixing a finding is worth.
const SEVERITY_PENALTY: Record<Issue["severity"], number> = {
  critical: 40,
  high: 20,
  medium: 10,
  low: 4,
};

const CATEGORY_WEIGHT: Record<string, number> = {
  architecture: 0.2,
  security: 0.25,
  devops: 0.2,
  testing: 0.2,
  documentation: 0.05,
  performance: 0.1,
};

/** Category and overall score if the given findings were fixed. */
export function projectScores(
  issues: Issue[],
  remove: Issue[]
): { overall: number; categories: Record<string, number> } {
  const removed = new Set(remove.map((i) => i.id));
  const categories: Record<string, number> = {};
  for (const category of Object.keys(CATEGORY_WEIGHT)) {
    const penalty = issues
      .filter((i) => i.category === category && !removed.has(i.id))
      .reduce((sum, i) => sum + SEVERITY_PENALTY[i.severity], 0);
    categories[category] = Math.max(0, 100 - penalty);
  }
  const overall = Math.round(
    Object.entries(categories).reduce((sum, [c, s]) => sum + s * (CATEGORY_WEIGHT[c] ?? 0), 0)
  );
  return { overall, categories };
}

export function relativeTime(value: string | null): string {
  if (!value) return "—";
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
