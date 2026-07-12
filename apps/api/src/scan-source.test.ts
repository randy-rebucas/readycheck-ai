import { describe, expect, it } from "vitest";
import { isGitUrl, resolveScanSource } from "./scan-source";

describe("isGitUrl", () => {
  it("recognizes https URLs ending in .git", () => {
    expect(isGitUrl("https://github.com/org/repo.git")).toBe(true);
    expect(isGitUrl("https://gitlab.com/org/repo.git")).toBe(true);
  });

  it("recognizes github/gitlab/bitbucket URLs without a .git suffix", () => {
    expect(isGitUrl("https://github.com/org/repo")).toBe(true);
    expect(isGitUrl("https://bitbucket.com/org/repo")).toBe(true);
  });

  it("recognizes ssh-style git URLs", () => {
    expect(isGitUrl("git@github.com:org/repo.git")).toBe(true);
  });

  it("does not treat a local filesystem path as a git URL", () => {
    expect(isGitUrl("C:\\Users\\dev\\projects\\repo")).toBe(false);
    expect(isGitUrl("/home/dev/projects/repo")).toBe(false);
  });

  it("does not treat an arbitrary non-git-host https URL as a git URL", () => {
    expect(isGitUrl("https://example.com/some/page")).toBe(false);
  });
});

describe("resolveScanSource", () => {
  it("returns null when neither path nor repoUrl is provided", () => {
    expect(resolveScanSource({})).toBeNull();
    expect(resolveScanSource({ path: "  " })).toBeNull();
  });

  it("prefers an explicit repoUrl over path when both are given", () => {
    const result = resolveScanSource({ path: "/local/path", repoUrl: "https://github.com/org/repo.git" });
    expect(result).toEqual({ source: "https://github.com/org/repo.git", isGitUrl: true });
  });

  it("auto-detects a git URL passed via path", () => {
    const result = resolveScanSource({ path: "https://github.com/org/repo.git" });
    expect(result).toEqual({ source: "https://github.com/org/repo.git", isGitUrl: true });
  });

  it("treats a plain local path as isGitUrl: false", () => {
    const result = resolveScanSource({ path: "C:\\repo" });
    expect(result).toEqual({ source: "C:\\repo", isGitUrl: false });
  });

  it("trims whitespace from the input", () => {
    const result = resolveScanSource({ path: "  C:\\repo  " });
    expect(result?.source).toBe("C:\\repo");
  });
});
