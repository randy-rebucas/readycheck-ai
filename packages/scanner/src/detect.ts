import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { RepoFacts } from "./types.js";

const FRAMEWORK_MARKERS: Record<string, string[]> = {
  nextjs: ["next.config.js", "next.config.mjs", "next.config.ts"],
  nestjs: ["nest-cli.json"],
  express: [],
  laravel: ["artisan"],
  django: ["manage.py"],
  "spring-boot": ["pom.xml", "build.gradle"],
  rails: ["Gemfile", "config/application.rb"],
};

function exists(root: string, ...paths: string[]): boolean {
  return paths.some((p) => existsSync(join(root, p)));
}

function detectPackageManager(root: string): RepoFacts["packageManager"] {
  if (exists(root, "pnpm-lock.yaml")) return "pnpm";
  if (exists(root, "yarn.lock")) return "yarn";
  if (exists(root, "package-lock.json")) return "npm";
  return "unknown";
}

function detectFrameworks(root: string): string[] {
  const found: string[] = [];
  for (const [name, markers] of Object.entries(FRAMEWORK_MARKERS)) {
    if (markers.length && exists(root, ...markers)) found.push(name);
  }

  const pkgJsonPath = join(root, "package.json");
  if (existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps["next"] && !found.includes("nextjs")) found.push("nextjs");
    if (deps["@nestjs/core"] && !found.includes("nestjs")) found.push("nestjs");
    if (deps["express"]) found.push("express");
    if (deps["fastify"]) found.push("fastify");
    if (deps["react"] && !found.includes("nextjs")) found.push("react");
    if (deps["react-native"]) found.push("react-native");
  }

  return found;
}

function detectCiProviders(root: string): string[] {
  const providers: string[] = [];
  if (existsSync(join(root, ".github", "workflows"))) providers.push("github-actions");
  if (exists(root, ".gitlab-ci.yml")) providers.push("gitlab-ci");
  if (exists(root, "azure-pipelines.yml")) providers.push("azure-pipelines");
  if (exists(root, "Jenkinsfile")) providers.push("jenkins");
  if (exists(root, ".circleci/config.yml")) providers.push("circleci");
  return providers;
}

function detectLanguages(root: string): string[] {
  const languages = new Set<string>();
  if (exists(root, "package.json", "tsconfig.json")) languages.add("typescript-or-javascript");
  if (exists(root, "go.mod")) languages.add("go");
  if (exists(root, "requirements.txt", "pyproject.toml", "manage.py")) languages.add("python");
  if (exists(root, "pom.xml", "build.gradle")) languages.add("java");
  if (exists(root, "composer.json")) languages.add("php");
  if (exists(root, "Cargo.toml")) languages.add("rust");
  if (exists(root, "Gemfile")) languages.add("ruby");
  if (exists(root, "*.csproj")) languages.add("csharp");
  return Array.from(languages);
}

function hasTestConfig(root: string): boolean {
  return exists(
    root,
    "jest.config.js",
    "jest.config.ts",
    "vitest.config.ts",
    "vitest.config.js",
    "vitest.workspace.ts",
    "vitest.workspace.js",
    "playwright.config.ts",
    "phpunit.xml",
    "pytest.ini"
  );
}

function hasEnvFiles(root: string): boolean {
  try {
    return readdirSync(root).some((f: string) => f.startsWith(".env"));
  } catch {
    return false;
  }
}

export function scanRepository(rootPath: string): RepoFacts {
  return {
    rootPath,
    languages: detectLanguages(rootPath),
    packageManager: detectPackageManager(rootPath),
    frameworks: detectFrameworks(rootPath),
    hasDocker: exists(rootPath, "Dockerfile", "docker-compose.yml", "docker-compose.yaml"),
    hasKubernetes: existsSync(join(rootPath, "kubernetes")) || existsSync(join(rootPath, "k8s")),
    hasTerraform: existsSync(join(rootPath, "terraform")) || exists(rootPath, "main.tf"),
    ciProviders: detectCiProviders(rootPath),
    hasTests: hasTestConfig(rootPath),
    hasEnvFiles: hasEnvFiles(rootPath),
    hasLicense: exists(rootPath, "LICENSE", "LICENSE.md", "LICENSE.txt"),
  };
}
