import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RepoFacts } from "@readycheck/scanner";
import { nextjsPlugin } from "./plugin";

const baseFacts: RepoFacts = {
  rootPath: "",
  languages: ["typescript-or-javascript"],
  packageManager: "pnpm",
  frameworks: ["nextjs"],
  hasDocker: false,
  hasKubernetes: false,
  hasTerraform: false,
  ciProviders: [],
  hasTests: false,
  hasEnvFiles: false,
  hasLicense: false,
};

function makeTempRepo(structure: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "readycheck-nextjs-plugin-"));
  for (const [relPath, content] of Object.entries(structure)) {
    const fullPath = join(dir, relPath);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content);
  }
  return dir;
}

describe("nextjsPlugin.detect", () => {
  it("only applies when nextjs is in the detected frameworks", () => {
    expect(nextjsPlugin.detect(baseFacts)).toBe(true);
    expect(nextjsPlugin.detect({ ...baseFacts, frameworks: ["express"] })).toBe(false);
  });
});

describe("nextjsPlugin.evaluate", () => {
  it("flags a project missing both app/ and pages/ directories", () => {
    const dir = makeTempRepo({ "package.json": "{}" });
    const issues = nextjsPlugin.evaluate(dir, baseFacts);

    expect(issues).toContainEqual(expect.objectContaining({ ruleId: "NEXTJS-001", severity: "critical" }));

    rmSync(dir, { recursive: true, force: true });
  });

  it("does not flag missing routes when app/ is present", () => {
    const dir = makeTempRepo({ "app/page.tsx": "export default function Page() {}" });
    const issues = nextjsPlugin.evaluate(dir, baseFacts);

    expect(issues.find((i) => i.ruleId === "NEXTJS-001")).toBeUndefined();

    rmSync(dir, { recursive: true, force: true });
  });

  it("flags missing next.config", () => {
    const dir = makeTempRepo({ "app/page.tsx": "export default function Page() {}" });
    const issues = nextjsPlugin.evaluate(dir, baseFacts);

    expect(issues).toContainEqual(expect.objectContaining({ ruleId: "NEXTJS-002" }));

    rmSync(dir, { recursive: true, force: true });
  });

  it("flags having both app/ and pages/ routers simultaneously", () => {
    const dir = makeTempRepo({
      "app/page.tsx": "export default function Page() {}",
      "pages/index.tsx": "export default function Home() {}",
    });
    const issues = nextjsPlugin.evaluate(dir, baseFacts);

    expect(issues).toContainEqual(expect.objectContaining({ ruleId: "NEXTJS-003" }));

    rmSync(dir, { recursive: true, force: true });
  });

  it("returns no issues for a well-formed Next.js project", () => {
    const dir = makeTempRepo({
      "app/page.tsx": "export default function Page() {}",
      "next.config.mjs": "export default {}",
      "eslint.config.mjs": "export default []",
    });
    const issues = nextjsPlugin.evaluate(dir, baseFacts);

    expect(issues).toHaveLength(0);

    rmSync(dir, { recursive: true, force: true });
  });
});
