import nodePath from "node:path";
import { describe, expect, it } from "vitest";
import { confine } from "./agent";

describe("confine", () => {
  const root = nodePath.resolve("/repo");

  it("resolves paths inside the repository", () => {
    expect(confine(root, "src/index.ts")).toBe(nodePath.join(root, "src", "index.ts"));
    expect(confine(root, ".")).toBe(root);
  });

  it("rejects paths that escape the repository", () => {
    expect(confine(root, "../etc/passwd")).toBeNull();
    expect(confine(root, nodePath.resolve("/elsewhere/file"))).toBeNull();
  });

  it("rejects git internals", () => {
    expect(confine(root, ".git/config")).toBeNull();
    expect(confine(root, ".git")).toBeNull();
    expect(confine(root, ".github/workflows/ci.yml")).not.toBeNull();
  });
});
