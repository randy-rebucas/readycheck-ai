import type { Rule } from "./types.js";

export const coreRules: Rule[] = [
  {
    id: "DEVOPS-001",
    category: "devops",
    description: "Repository should have a CI/CD pipeline configured.",
    severityDefault: "high",
    estimatedEffort: "S",
    evaluate: (facts) =>
      facts.ciProviders.length === 0
        ? {
            ruleId: "DEVOPS-001",
            category: "devops",
            severity: "high",
            message: "No CI/CD provider detected.",
            recommendation: "Add a GitHub Actions (or equivalent) workflow to run lint/test/build on every push.",
            estimatedEffort: "S",
          }
        : null,
  },
  {
    id: "DEVOPS-002",
    category: "devops",
    description: "Repository should be containerized for consistent deployment.",
    severityDefault: "medium",
    estimatedEffort: "S",
    evaluate: (facts) =>
      !facts.hasDocker
        ? {
            ruleId: "DEVOPS-002",
            category: "devops",
            severity: "medium",
            message: "No Dockerfile or docker-compose file found.",
            recommendation: "Add a Dockerfile to standardize the runtime environment across dev/staging/prod.",
            estimatedEffort: "S",
          }
        : null,
  },
  {
    id: "TEST-001",
    category: "testing",
    description: "Repository should have a test framework configured.",
    severityDefault: "critical",
    estimatedEffort: "M",
    evaluate: (facts) =>
      !facts.hasTests
        ? {
            ruleId: "TEST-001",
            category: "testing",
            severity: "critical",
            message: "No test framework configuration detected.",
            recommendation: "Add Jest/Vitest (or the idiomatic framework for this stack) and write tests for critical paths before shipping.",
            estimatedEffort: "M",
          }
        : null,
  },
  {
    id: "DOC-001",
    category: "documentation",
    description: "Repository should declare a license.",
    severityDefault: "low",
    estimatedEffort: "XS",
    evaluate: (facts) =>
      !facts.hasLicense
        ? {
            ruleId: "DOC-001",
            category: "documentation",
            severity: "low",
            message: "No LICENSE file found.",
            recommendation: "Add a LICENSE file appropriate to the project's intended distribution model.",
            estimatedEffort: "XS",
          }
        : null,
  },
  {
    id: "SEC-001",
    category: "security",
    description: ".env files should not be committed to the repository.",
    severityDefault: "critical",
    estimatedEffort: "XS",
    evaluate: (facts) =>
      facts.hasEnvFiles
        ? {
            ruleId: "SEC-001",
            category: "security",
            severity: "critical",
            message: ".env file(s) found in repository root.",
            recommendation: "Remove committed .env files, rotate any leaked secrets, and add .env* to .gitignore.",
            estimatedEffort: "XS",
          }
        : null,
  },
  {
    id: "ARCH-001",
    category: "architecture",
    description: "Repository should use a recognized package manager lockfile.",
    severityDefault: "medium",
    estimatedEffort: "XS",
    evaluate: (facts) =>
      facts.packageManager === "unknown" && facts.languages.includes("typescript-or-javascript")
        ? {
            ruleId: "ARCH-001",
            category: "architecture",
            severity: "medium",
            message: "No lockfile detected for a Node.js project.",
            recommendation: "Commit a lockfile (pnpm-lock.yaml recommended) to ensure reproducible installs.",
            estimatedEffort: "XS",
          }
        : null,
  },
];
