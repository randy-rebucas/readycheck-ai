import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  parseForgotPasswordInput,
  parseLoginInput,
  parseRegisterInput,
  parseResetPasswordInput,
} from "./credentials";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Jane.Doe@Example.COM ")).toBe("jane.doe@example.com");
  });

  it("rejects non-emails and non-strings", () => {
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail("has space@example.com")).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});

describe("parseRegisterInput", () => {
  const valid = { name: "  Jane  ", email: "JANE@example.com", password: "longenough" };

  it("accepts valid input, normalizing email and trimming name", () => {
    const result = parseRegisterInput(valid);
    expect(result).toEqual({
      ok: true,
      value: { name: "Jane", email: "jane@example.com", password: "longenough" },
    });
  });

  it("treats a missing/blank name as null", () => {
    const result = parseRegisterInput({ ...valid, name: "   " });
    expect(result.ok && result.value.name).toBeNull();
    expect(parseRegisterInput({ email: valid.email, password: valid.password }).ok).toBe(true);
  });

  it("rejects short passwords", () => {
    const result = parseRegisterInput({ ...valid, password: "short" });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid emails and non-object bodies", () => {
    expect(parseRegisterInput({ ...valid, email: "nope" }).ok).toBe(false);
    expect(parseRegisterInput(null).ok).toBe(false);
    expect(parseRegisterInput("string").ok).toBe(false);
  });
});

describe("parseForgotPasswordInput", () => {
  it("accepts and normalizes a valid email", () => {
    expect(parseForgotPasswordInput({ email: " User@Example.COM " })).toEqual({
      ok: true,
      value: { email: "user@example.com" },
    });
  });

  it("rejects invalid emails", () => {
    expect(parseForgotPasswordInput({ email: "nope" }).ok).toBe(false);
    expect(parseForgotPasswordInput({}).ok).toBe(false);
  });
});

describe("parseResetPasswordInput", () => {
  const token = "a".repeat(43);

  it("accepts a plausible token and valid password", () => {
    expect(parseResetPasswordInput({ token, password: "longenough" })).toEqual({
      ok: true,
      value: { token, password: "longenough" },
    });
  });

  it("rejects missing, short, or oversized tokens", () => {
    expect(parseResetPasswordInput({ password: "longenough" }).ok).toBe(false);
    expect(parseResetPasswordInput({ token: "short", password: "longenough" }).ok).toBe(false);
    expect(
      parseResetPasswordInput({ token: "a".repeat(200), password: "longenough" }).ok
    ).toBe(false);
  });

  it("rejects short passwords", () => {
    expect(parseResetPasswordInput({ token, password: "short" }).ok).toBe(false);
  });
});

describe("parseLoginInput", () => {
  it("accepts valid input", () => {
    const result = parseLoginInput({ email: "User@Example.com", password: "pw" });
    expect(result).toEqual({ ok: true, value: { email: "user@example.com", password: "pw" } });
  });

  it("rejects missing pieces with a single vague message", () => {
    const noEmail = parseLoginInput({ password: "pw" });
    const noPassword = parseLoginInput({ email: "user@example.com" });
    expect(noEmail.ok).toBe(false);
    expect(noPassword.ok).toBe(false);
    expect(!noEmail.ok && !noPassword.ok && noEmail.error).toBe(
      !noPassword.ok ? noPassword.error : ""
    );
  });
});
