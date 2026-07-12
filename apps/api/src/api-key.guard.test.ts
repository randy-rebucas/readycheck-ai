import { afterEach, describe, expect, it } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { ApiKeyGuard } from "./api-key.guard";

function makeContext(headerValue: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) => (name === "x-api-key" ? headerValue : undefined),
      }),
    }),
  } as unknown as ExecutionContext;
}

describe("ApiKeyGuard", () => {
  const originalKey = process.env.READYCHECK_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.READYCHECK_API_KEY;
    else process.env.READYCHECK_API_KEY = originalKey;
  });

  it("allows all requests when no key is configured (dev mode)", () => {
    delete process.env.READYCHECK_API_KEY;
    const guard = new ApiKeyGuard();
    expect(guard.canActivate(makeContext(undefined))).toBe(true);
  });

  it("rejects requests with a missing key once one is configured", () => {
    process.env.READYCHECK_API_KEY = "secret123";
    const guard = new ApiKeyGuard();
    expect(() => guard.canActivate(makeContext(undefined))).toThrow();
  });

  it("rejects requests with the wrong key", () => {
    process.env.READYCHECK_API_KEY = "secret123";
    const guard = new ApiKeyGuard();
    expect(() => guard.canActivate(makeContext("wrong"))).toThrow();
  });

  it("allows requests with the correct key", () => {
    process.env.READYCHECK_API_KEY = "secret123";
    const guard = new ApiKeyGuard();
    expect(guard.canActivate(makeContext("secret123"))).toBe(true);
  });
});
