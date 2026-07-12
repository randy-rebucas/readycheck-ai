import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Issue } from "@readycheck/rules";
import type { RepoFacts } from "@readycheck/scanner";
import type { FrameworkPlugin } from "../types";

function exists(root: string, ...paths: string[]): boolean {
  return paths.some((p) => existsSync(join(root, p)));
}

export const nextjsPlugin: FrameworkPlugin = {
  id: "nextjs",

  detect(facts: RepoFacts): boolean {
    return facts.frameworks.includes("nextjs");
  },

  evaluate(rootPath: string): Issue[] {
    const issues: Issue[] = [];

    const hasAppRouter = existsSync(join(rootPath, "app")) || existsSync(join(rootPath, "src", "app"));
    const hasPagesRouter =
      existsSync(join(rootPath, "pages")) || existsSync(join(rootPath, "src", "pages"));

    if (!hasAppRouter && !hasPagesRouter) {
      issues.push({
        ruleId: "NEXTJS-001",
        category: "architecture",
        severity: "critical",
        message: "Next.js project has neither an app/ nor pages/ directory.",
        recommendation:
          "Add an app/ directory (App Router, recommended) or pages/ directory (Pages Router). Without one, Next.js has no routes to serve.",
        estimatedEffort: "M",
      });
    }

    if (!exists(rootPath, "next.config.js", "next.config.mjs", "next.config.ts")) {
      issues.push({
        ruleId: "NEXTJS-002",
        category: "architecture",
        severity: "medium",
        message: "No next.config file found.",
        recommendation:
          "Add an explicit next.config.{js,mjs,ts} to control image domains, headers, redirects, and build behavior instead of relying on defaults.",
        estimatedEffort: "S",
      });
    }

    if (hasAppRouter && hasPagesRouter) {
      issues.push({
        ruleId: "NEXTJS-003",
        category: "architecture",
        severity: "low",
        message: "Both app/ and pages/ directories are present.",
        recommendation:
          "Mixing App Router and Pages Router is supported but adds cognitive overhead during migration. Plan a full cutover to App Router when feasible.",
        estimatedEffort: "L",
      });
    }

    if (!exists(rootPath, ".eslintrc.json", ".eslintrc.js", "eslint.config.js", "eslint.config.mjs")) {
      issues.push({
        ruleId: "NEXTJS-004",
        category: "architecture",
        severity: "low",
        message: "No ESLint configuration found for this Next.js project.",
        recommendation:
          "Run `next lint` to scaffold ESLint config -- Next.js ships with a curated ruleset (core-web-vitals) that catches common accessibility and performance issues.",
        estimatedEffort: "XS",
      });
    }

    return issues;
  },
};
