import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import simpleGit from "simple-git";
import { afterEach, describe, expect, it } from "vitest";
import { analyze } from "./analyze";
import { stageAndDiff, type Checkout } from "./checkout";
import { FIXERS } from "./fixers";

const dirs: string[] = [];

async function repo(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "readycheck-fixer-"));
  dirs.push(dir);
  for (const [path, contents] of Object.entries(files)) writeFileSync(join(dir, path), contents);
  const git = simpleGit(dir);
  await git.init();
  await git.addConfig("user.name", "test");
  await git.addConfig("user.email", "test@example.com");
  await git.add(["-A"]);
  await git.commit("init");
  return { dir, git };
}

async function fix(ruleId: string, files: Record<string, string>) {
  const { dir, git } = await repo(files);
  const { facts, issues } = analyze(dir);
  expect(issues.map((i) => i.ruleId)).toContain(ruleId);
  const applied = await FIXERS[ruleId]({ root: dir, facts, git, owner: "acme", baseBranch: "main" });
  // What the branch will contain: commit, then drop ignored leftovers.
  await git.add(["-A"]);
  await git.commit("fix", { "--allow-empty": null });
  await git.raw(["clean", "-fdX"]);
  return { dir, git, applied, after: analyze(dir).issues.map((i) => i.ruleId) };
}

const NODE_APP = {
  "package.json": JSON.stringify({
    name: "app",
    scripts: { lint: "eslint .", test: "vitest", build: "tsc", start: "node dist/index.js" },
  }),
  "package-lock.json": "{}",
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("template fixers", () => {
  it("SEC-001 untracks .env, ignores it and writes a names-only .env.example", async () => {
    const { dir, git, applied, after } = await fix("SEC-001", {
      ...NODE_APP,
      ".env": "DATABASE_URL=postgres://user:hunter2@db/prod\nexport API_KEY=abc123\n",
    });
    expect(applied).toBe(true);
    expect(after).not.toContain("SEC-001");
    expect((await git.raw(["ls-files"])).split("\n")).not.toContain(".env");
    const example = readFileSync(join(dir, ".env.example"), "utf8");
    expect(example).toBe("API_KEY=\nDATABASE_URL=\n");
    expect(example).not.toContain("hunter2");
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toMatch(/^\.env$/m);
  });

  it("DEVOPS-001 adds a CI workflow using the repo's scripts", async () => {
    const { dir, applied, after } = await fix("DEVOPS-001", NODE_APP);
    expect(applied).toBe(true);
    expect(after).not.toContain("DEVOPS-001");
    const workflow = readFileSync(join(dir, ".github/workflows/ci.yml"), "utf8");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm run lint");
    expect(workflow).toContain("npm run build");
    expect(workflow).not.toContain("typecheck");
  });

  it("DEVOPS-002 adds a Dockerfile that runs as a non-root user", async () => {
    const { dir, applied, after } = await fix("DEVOPS-002", NODE_APP);
    expect(applied).toBe(true);
    expect(after).not.toContain("DEVOPS-002");
    const dockerfile = readFileSync(join(dir, "Dockerfile"), "utf8");
    expect(dockerfile).toContain("USER node");
    expect(dockerfile).toContain('CMD ["npm", "start"]');
    expect(existsSync(join(dir, ".dockerignore"))).toBe(true);
  });

  it("DOC-001 adds an MIT license naming the owner", async () => {
    const { dir, applied, after } = await fix("DOC-001", NODE_APP);
    expect(applied).toBe(true);
    expect(after).not.toContain("DOC-001");
    expect(readFileSync(join(dir, "LICENSE"), "utf8")).toContain("acme");
  });

  it("keeps .env contents out of the stored diff", async () => {
    const { dir, git } = await repo({ ...NODE_APP, ".env": "SECRET=hunter2\n" });
    const { facts } = analyze(dir);
    await FIXERS["SEC-001"]({ root: dir, facts, git, owner: "acme", baseBranch: "main" });
    const { diff, files } = await stageAndDiff({ git } as unknown as Checkout);
    expect(files).toContain(".env");
    expect(diff).not.toContain("hunter2");
    expect(diff).toContain("contents not shown");
    expect(diff).toContain(".gitignore");
  });

  it("returns false for stacks without a template", async () => {
    const { dir, git } = await repo({ "Cargo.toml": "[package]\nname = \"x\"\n" });
    const { facts } = analyze(dir);
    expect(await FIXERS["DEVOPS-002"]({ root: dir, facts, git, owner: "acme", baseBranch: "main" })).toBe(false);
  });
});
