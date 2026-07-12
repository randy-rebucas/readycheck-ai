import { afterEach, describe, expect, it } from "vitest";
import { decodeRedirectState, encodeRedirectState } from "./oauth-state";

const FALLBACK = "http://localhost:3000/api/auth/callback";

function roundTrip(redirectUri: string | undefined): string {
  return decodeRedirectState(encodeRedirectState(redirectUri));
}

afterEach(() => {
  delete process.env.DASHBOARD_URL;
});

describe("oauth redirect state", () => {
  it("round-trips a legitimate dashboard callback URL with query params", () => {
    const uri = "http://localhost:3000/api/auth/callback?next=%2Fdashboard&n=abc123";
    expect(roundTrip(uri)).toBe(uri);
  });

  it("falls back when the redirect is missing", () => {
    expect(roundTrip(undefined)).toBe(FALLBACK);
    expect(decodeRedirectState(undefined)).toBe(FALLBACK);
  });

  it("rejects lookalike hosts that pass a naive prefix check", () => {
    expect(roundTrip("http://localhost:3000.evil.com/api/auth/callback")).toBe(FALLBACK);
  });

  it("rejects other origins entirely", () => {
    expect(roundTrip("https://evil.com/api/auth/callback")).toBe(FALLBACK);
  });

  it("rejects the right origin with the wrong path", () => {
    expect(roundTrip("http://localhost:3000/steal-token")).toBe(FALLBACK);
    expect(roundTrip("http://localhost:3000/api/auth/callback/extra")).toBe(FALLBACK);
  });

  it("rejects non-URL garbage and tampered state", () => {
    expect(roundTrip("not a url")).toBe(FALLBACK);
    expect(decodeRedirectState("!!!not-base64url!!!")).toBe(FALLBACK);
    expect(decodeRedirectState(Buffer.from("https://evil.com/x").toString("base64url"))).toBe(
      FALLBACK
    );
  });

  it("honors DASHBOARD_URL for the allowed origin", () => {
    process.env.DASHBOARD_URL = "https://app.readycheck.example";
    const uri = "https://app.readycheck.example/api/auth/callback?n=x";
    expect(roundTrip(uri)).toBe(uri);
    expect(roundTrip("http://localhost:3000/api/auth/callback")).toBe(
      "https://app.readycheck.example/api/auth/callback"
    );
  });
});
