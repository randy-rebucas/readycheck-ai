import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";
import { parseGitHubRepo, redactToken, slugify } from "./repo";

describe("parseGitHubRepo", () => {
  it("parses https URLs with and without .git", () => {
    expect(parseGitHubRepo("https://github.com/acme/shop.git")).toEqual({ owner: "acme", repo: "shop" });
    expect(parseGitHubRepo("https://github.com/acme/my.repo")).toEqual({ owner: "acme", repo: "my.repo" });
  });

  it("rejects other hosts and deep paths", () => {
    expect(parseGitHubRepo("https://gitlab.com/acme/shop")).toBeNull();
    expect(parseGitHubRepo("https://github.com/acme/shop/tree/main")).toBeNull();
  });
});

describe("secrets", () => {
  it("round-trips and never stores the plaintext", () => {
    const sealed = encryptSecret("ghp_secret");
    expect(sealed).not.toContain("ghp_secret");
    expect(decryptSecret(sealed)).toBe("ghp_secret");
  });

  it("redacts tokens in URLs and text", () => {
    expect(redactToken("fatal: https://x-access-token:abc@github.com/a/b.git", "abc")).toBe(
      "fatal: https://github.com/a/b.git"
    );
  });
});

describe("slugify", () => {
  it("makes branch-safe names", () => {
    expect(slugify("Calendar sync with Google!")).toBe("calendar-sync-with-google");
  });
});
