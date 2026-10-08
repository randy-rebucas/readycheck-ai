import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanRepository } from "./detect";

function makeTempRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "readycheck-scanner-"));
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(dir, relPath);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content);
  }
  return dir;
}

describe("scanRepository", () => {
  it("detects pnpm, Next.js, and a missing license in a minimal repo", () => {
    const dir = makeTempRepo({
      "pnpm-lock.yaml": "",
      "package.json": JSON.stringify({ dependencies: { next: "^15.0.0" } }),
    });

    const facts = scanRepository(dir);

    expect(facts.packageManager).toBe("pnpm");
    expect(facts.frameworks).toContain("nextjs");
    expect(facts.hasLicense).toBe(false);
    expect(facts.hasDocker).toBe(false);

    rmSync(dir, { recursive: true, force: true });
  });

  it("flags committed .env files", () => {
    const dir = makeTempRepo({ ".env": "SECRET=123" });

    const facts = scanRepository(dir);

    expect(facts.hasEnvFiles).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });

  it("does not flag .env.example templates", () => {
    const dir = makeTempRepo({ ".env.example": "SECRET=" });

    const facts = scanRepository(dir);

    expect(facts.hasEnvFiles).toBe(false);

    rmSync(dir, { recursive: true, force: true });
  });

  it("detects Docker and CI when present", () => {
    const dir = makeTempRepo({
      Dockerfile: "FROM node:20",
      ".github/workflows/ci.yml": "name: CI",
    });

    const facts = scanRepository(dir);

    expect(facts.hasDocker).toBe(true);
    expect(facts.ciProviders).toContain("github-actions");

    rmSync(dir, { recursive: true, force: true });
  });

  it("recognizes a Vitest workspace config as a test setup", () => {
    const dir = makeTempRepo({ "vitest.workspace.ts": "export default []" });

    const facts = scanRepository(dir);

    expect(facts.hasTests).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });
});
