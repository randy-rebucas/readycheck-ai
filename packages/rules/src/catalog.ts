import { coreRules } from "./core-rules.js";
import type { RuleCategory, Severity } from "./types.js";

/**
 * How a finding can be fixed:
 * - template: a deterministic change we write ourselves (same input, same output)
 * - ai: the coding agent writes it; always needs review
 * - guided: no automatic fix; the person follows the steps
 */
export type FixKind = "template" | "ai" | "guided";

export interface FixInfo {
  kind: FixKind;
  /** "high" fixes are mechanical and go in "Fix N safe issues" batches. */
  confidence: "high" | "review" | null;
  /** What "Fix it for me" will do, in order. */
  plan: string[];
  /** Something the person must still do after the PR (e.g. rotate a secret). */
  caveat?: string;
}

export interface CatalogRule {
  id: string;
  pack: string;
  category: RuleCategory;
  description: string;
  severity: Severity;
  /** Standards the rule maps to, for reports. */
  standards: string[];
  fix: FixInfo;
}

export interface RulePack {
  id: string;
  name: string;
  description: string;
}

export const RULE_PACKS: RulePack[] = [
  { id: "baseline", name: "Baseline", description: "Delivery, testing and documentation checks for every repository." },
  { id: "security", name: "Security", description: "Secrets and supply-chain hygiene." },
  { id: "nextjs", name: "Next.js", description: "Framework checks, applied when Next.js is detected." },
];

const FIXES: Record<string, { pack: string; standards: string[]; fix: FixInfo }> = {
  "DEVOPS-001": {
    pack: "baseline",
    standards: ["12-Factor V", "DORA"],
    fix: {
      kind: "template",
      confidence: "high",
      plan: [
        "Add a GitHub Actions workflow that runs on every push and pull request",
        "Install with the package manager the repository uses, then run its lint, test and build scripts",
        "Open a pull request on a new branch. Nothing is pushed to main.",
      ],
    },
  },
  "DEVOPS-002": {
    pack: "baseline",
    standards: ["12-Factor X"],
    fix: {
      kind: "template",
      confidence: "review",
      plan: [
        "Add a multi-stage Dockerfile and .dockerignore for the detected stack",
        "Run as a non-root user and only copy what the app needs",
        "Open a pull request on a new branch. Nothing is pushed to main.",
      ],
      caveat: "Check the start command and port match how you run the app.",
    },
  },
  "TEST-001": {
    pack: "baseline",
    standards: ["Google Testing", "ISTQB"],
    fix: {
      kind: "ai",
      confidence: "review",
      plan: [
        "Add the idiomatic test framework for this stack and a test script",
        "Write first tests for the most critical code paths",
        "Open a pull request on a new branch. Nothing is pushed to main.",
      ],
    },
  },
  "DOC-001": {
    pack: "baseline",
    standards: ["OpenSSF Scorecard"],
    fix: {
      kind: "template",
      confidence: "review",
      plan: ["Add an MIT LICENSE file with the repository owner and this year", "Open a pull request on a new branch."],
      caveat: "Choosing a license is a legal decision. Swap MIT for another license in the PR if it doesn't fit.",
    },
  },
  "SEC-001": {
    pack: "security",
    standards: ["OWASP A07", "CWE-798"],
    fix: {
      kind: "template",
      confidence: "high",
      plan: [
        "Stop tracking committed .env files (they stay on your machine)",
        "Add .env* to .gitignore and create .env.example with the variable names only",
        "Open a pull request on a new branch. Nothing is pushed to main.",
      ],
      caveat:
        "You still need to rotate every secret that was in those files. They stay in the repository's history.",
    },
  },
  "ARCH-001": {
    pack: "security",
    standards: ["OpenSSF Scorecard", "SLSA"],
    fix: {
      kind: "template",
      confidence: "high",
      plan: [
        "Generate package-lock.json from package.json without running install scripts",
        "Open a pull request on a new branch. Nothing is pushed to main.",
      ],
    },
  },
  "NEXTJS-001": {
    pack: "nextjs",
    standards: ["Next.js docs"],
    fix: { kind: "guided", confidence: null, plan: [] },
  },
  "NEXTJS-002": {
    pack: "nextjs",
    standards: ["Next.js docs"],
    fix: {
      kind: "template",
      confidence: "high",
      plan: ["Add a minimal next.config.mjs with strict mode on", "Open a pull request on a new branch."],
    },
  },
  "NEXTJS-003": {
    pack: "nextjs",
    standards: ["Next.js docs"],
    fix: { kind: "guided", confidence: null, plan: [] },
  },
  "NEXTJS-004": {
    pack: "nextjs",
    standards: ["Next.js docs", "WCAG 2.2"],
    fix: {
      kind: "template",
      confidence: "review",
      plan: [
        "Add eslint.config.mjs using Next.js core-web-vitals rules",
        "Add eslint and eslint-config-next to devDependencies and a lint script",
        "Open a pull request on a new branch.",
      ],
      caveat: "Run your package manager's install to update the lockfile before merging.",
    },
  },
};

/** Plugin rules live in @readycheck/plugins; their metadata is listed here so packs and fixes see them. */
const PLUGIN_RULES: Omit<CatalogRule, "pack" | "standards" | "fix">[] = [
  { id: "NEXTJS-001", category: "architecture", severity: "critical", description: "Next.js project should have an app/ or pages/ directory." },
  { id: "NEXTJS-002", category: "architecture", severity: "medium", description: "Next.js project should have a next.config file." },
  { id: "NEXTJS-003", category: "architecture", severity: "low", description: "Next.js project shouldn't mix app/ and pages/ routers." },
  { id: "NEXTJS-004", category: "architecture", severity: "low", description: "Next.js project should have an ESLint configuration." },
];

const GUIDED: FixInfo = { kind: "guided", confidence: null, plan: [] };

export const RULE_CATALOG: CatalogRule[] = [
  ...coreRules.map((r) => ({
    id: r.id,
    category: r.category,
    severity: r.severityDefault,
    description: r.description,
  })),
  ...PLUGIN_RULES,
].map((r) => ({
  ...r,
  pack: FIXES[r.id]?.pack ?? "baseline",
  standards: FIXES[r.id]?.standards ?? [],
  fix: FIXES[r.id]?.fix ?? GUIDED,
}));

export function fixInfo(ruleId: string): FixInfo {
  return FIXES[ruleId]?.fix ?? GUIDED;
}
