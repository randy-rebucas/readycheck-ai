import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { SimpleGit } from "simple-git";
import type { RepoFacts } from "@readycheck/scanner";

/**
 * Deterministic fixes: the same repository always gets the same change.
 * A fixer returns false when it has no template for this repository's stack,
 * so the caller can fall back to the coding agent.
 */
export interface FixContext {
  root: string;
  facts: RepoFacts;
  git: SimpleGit;
  owner: string;
  baseBranch: string;
}

export type Fixer = (ctx: FixContext) => Promise<boolean>;

interface PackageJson {
  name?: string;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPackageJson(root: string): PackageJson | null {
  const path = join(root, "package.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
  } catch {
    return null;
  }
}

function write(root: string, path: string, contents: string): void {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function isNode(facts: RepoFacts, pkg: PackageJson | null): pkg is PackageJson {
  return pkg !== null && facts.languages.includes("typescript-or-javascript");
}

function pm(facts: RepoFacts): "npm" | "pnpm" | "yarn" {
  return facts.packageManager === "unknown" ? "npm" : facts.packageManager;
}

function installCommand(facts: RepoFacts): string {
  switch (facts.packageManager) {
    case "pnpm":
      return "pnpm install --frozen-lockfile";
    case "yarn":
      return "yarn install --frozen-lockfile";
    case "npm":
      return "npm ci";
    default:
      return "npm install";
  }
}

function runScript(facts: RepoFacts, script: string): string {
  return pm(facts) === "npm" ? `npm run ${script}` : `${pm(facts)} run ${script}`;
}

// ---------------------------------------------------------------------------

const ciWorkflow: Fixer = async ({ root, facts, baseBranch }) => {
  const pkg = readPackageJson(root);
  let steps: string;
  if (isNode(facts, pkg)) {
    const scripts = ["lint", "typecheck", "test", "build"].filter((s) => pkg.scripts?.[s]);
    const cache = facts.packageManager === "unknown" ? "" : `\n          cache: ${pm(facts)}`;
    steps = [
      "      - uses: actions/checkout@v4",
      ...(pm(facts) === "pnpm" ? ["      - uses: pnpm/action-setup@v4"] : []),
      `      - uses: actions/setup-node@v4\n        with:\n          node-version: 22${cache}`,
      `      - run: ${installCommand(facts)}`,
      ...scripts.map((s) => `      - run: ${runScript(facts, s)}`),
    ].join("\n");
  } else if (facts.languages.includes("python")) {
    const reqs = existsSync(join(root, "requirements.txt")) ? "pip install -r requirements.txt" : "pip install .";
    steps = [
      "      - uses: actions/checkout@v4",
      "      - uses: actions/setup-python@v5\n        with:\n          python-version: '3.12'",
      `      - run: ${reqs}`,
      "      - run: pip install pytest && pytest",
    ].join("\n");
  } else if (facts.languages.includes("go")) {
    steps = [
      "      - uses: actions/checkout@v4",
      "      - uses: actions/setup-go@v5\n        with:\n          go-version-file: go.mod",
      "      - run: go build ./...",
      "      - run: go test ./...",
    ].join("\n");
  } else {
    return false;
  }

  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI

on:
  push:
    branches: [${baseBranch}]
  pull_request:

permissions:
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
${steps}
`
  );
  return true;
};

const dockerfile: Fixer = async ({ root, facts }) => {
  const pkg = readPackageJson(root);
  if (!isNode(facts, pkg)) return false;

  const lockfile = { pnpm: "pnpm-lock.yaml", yarn: "yarn.lock", npm: "package-lock.json", unknown: "" }[facts.packageManager];
  const corepack = pm(facts) === "npm" ? "" : "RUN corepack enable\n";
  const hasBuild = Boolean(pkg.scripts?.build);
  const start = pkg.scripts?.start ? `["${pm(facts)}", "${pm(facts) === "npm" ? "start" : "run"}"${pm(facts) === "npm" ? "" : ', "start"'}]` : `["node", "${pkg.main ?? "index.js"}"]`;

  write(
    root,
    "Dockerfile",
    `# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
${corepack}COPY package.json ${lockfile} ./
RUN ${installCommand(facts)}

FROM node:22-alpine AS build
WORKDIR /app
${corepack}COPY --from=deps /app/node_modules ./node_modules
COPY . .
${hasBuild ? `RUN ${runScript(facts, "build")}\n` : ""}
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
${corepack}COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ${start}
`.replace("COPY package.json  ./", "COPY package.json ./")
  );
  if (!existsSync(join(root, ".dockerignore"))) {
    write(root, ".dockerignore", ["node_modules", ".git", ".env*", "!.env.example", "coverage", "*.log", ""].join("\n"));
  }
  return true;
};

const license: Fixer = async ({ root, owner }) => {
  const year = new Date().getFullYear();
  write(
    root,
    "LICENSE",
    `MIT License

Copyright (c) ${year} ${owner}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`
  );
  return true;
};

const ENV_TEMPLATES = new Set([".env.example", ".env.sample", ".env.template", ".env.dist"]);

const untrackEnvFiles: Fixer = async ({ root, git }) => {
  const envFiles = readdirSync(root).filter((f) => f.startsWith(".env") && !ENV_TEMPLATES.has(f));
  const keys = new Set<string>();
  for (const file of envFiles) {
    for (const line of readFileSync(join(root, file), "utf8").split(/\r?\n/)) {
      // Names only; values never leave the original file.
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
      if (match) keys.add(match[1]);
    }
  }
  const tracked = envFiles.length ? (await git.raw(["ls-files", "--", ...envFiles])).split("\n").filter(Boolean) : [];
  if (tracked.length) await git.rm(["--cached", "--", ...tracked]);

  const ignorePath = join(root, ".gitignore");
  const ignore = existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : "";
  if (!/^\.env\*?$/m.test(ignore) || !/^\.env\.\*$/m.test(ignore)) {
    const sep = ignore === "" || ignore.endsWith("\n") ? "" : "\n";
    writeFileSync(ignorePath, `${ignore}${sep}\n# Local environment files\n.env\n.env.*\n!.env.example\n`);
  }

  const examplePath = join(root, ".env.example");
  if (!existsSync(examplePath) && keys.size > 0) {
    writeFileSync(examplePath, [...keys].sort().map((k) => `${k}=`).join("\n") + "\n");
  }
  return true;
};

const lockfile: Fixer = async ({ root, facts }) => {
  if (!isNode(facts, readPackageJson(root))) return false;
  // --ignore-scripts: never run code from the repository being fixed.
  execFileSync("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: root,
    stdio: "pipe",
    timeout: 180_000,
    shell: process.platform === "win32",
  });
  return existsSync(join(root, "package-lock.json"));
};

const nextConfig: Fixer = async ({ root }) => {
  write(
    root,
    "next.config.mjs",
    `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`
  );
  return true;
};

const nextEslint: Fixer = async ({ root, facts }) => {
  const pkg = readPackageJson(root);
  if (!isNode(facts, pkg)) return false;
  const nextVersion = pkg.dependencies?.next ?? pkg.devDependencies?.next ?? "^15";
  pkg.devDependencies = {
    ...pkg.devDependencies,
    eslint: pkg.devDependencies?.eslint ?? "^9",
    "eslint-config-next": pkg.devDependencies?.["eslint-config-next"] ?? nextVersion,
    "@eslint/eslintrc": pkg.devDependencies?.["@eslint/eslintrc"] ?? "^3",
  };
  pkg.scripts = { ...pkg.scripts, lint: pkg.scripts?.lint ?? "next lint" };
  writeFileSync(join(root, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  write(
    root,
    "eslint.config.mjs",
    `import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const eslintConfig = [...compat.extends("next/core-web-vitals")];

export default eslintConfig;
`
  );
  return true;
};

export const FIXERS: Record<string, Fixer> = {
  "DEVOPS-001": ciWorkflow,
  "DEVOPS-002": dockerfile,
  "DOC-001": license,
  "SEC-001": untrackEnvFiles,
  "ARCH-001": lockfile,
  "NEXTJS-002": nextConfig,
  "NEXTJS-004": nextEslint,
};
