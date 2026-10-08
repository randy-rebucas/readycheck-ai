import { afterEach, describe, expect, it, vi } from "vitest";
import { getEffectivePlan, PLAN_LIMITS, planAllowsFormat } from "./plan-tiers";

describe("getEffectivePlan", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("honors READYCHECK_DEV_PLAN outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("READYCHECK_DEV_PLAN", "enterprise");
    expect(getEffectivePlan(null)).toBe("ENTERPRISE");
  });

  it("ignores READYCHECK_DEV_PLAN in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("READYCHECK_DEV_PLAN", "ENTERPRISE");
    expect(getEffectivePlan(null)).toBe("FREE");
  });

  it("returns FREE when there is no subscription", () => {
    expect(getEffectivePlan(null)).toBe("FREE");
    expect(getEffectivePlan(undefined)).toBe("FREE");
  });

  it("returns FREE when the subscription isn't ACTIVE", () => {
    expect(
      getEffectivePlan({
        plan: "PRO",
        status: "SUSPENDED",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      })
    ).toBe("FREE");
  });

  it("returns the subscribed plan while active", () => {
    expect(
      getEffectivePlan({
        plan: "PRO",
        status: "ACTIVE",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      })
    ).toBe("PRO");
  });

  it("keeps access through the paid period after cancellation", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(
      getEffectivePlan({
        plan: "PRO",
        status: "ACTIVE",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: future,
      })
    ).toBe("PRO");
  });

  it("downgrades to FREE once the cancelled period has ended", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(
      getEffectivePlan({
        plan: "PRO",
        status: "ACTIVE",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: past,
      })
    ).toBe("FREE");
  });
});

describe("PLAN_LIMITS", () => {
  it("limits FREE to 1 repository and excludes pdf", () => {
    expect(PLAN_LIMITS.FREE.maxRepositories).toBe(1);
    expect(PLAN_LIMITS.FREE.reportFormats).not.toContain("pdf");
  });

  it("gives PRO and ENTERPRISE unlimited repositories and pdf export", () => {
    expect(PLAN_LIMITS.PRO.maxRepositories).toBe(Infinity);
    expect(PLAN_LIMITS.PRO.reportFormats).toContain("pdf");
    expect(PLAN_LIMITS.ENTERPRISE.maxRepositories).toBe(Infinity);
    expect(PLAN_LIMITS.ENTERPRISE.reportFormats).toContain("pdf");
  });
});

describe("planAllowsFormat", () => {
  it("rejects pdf on FREE, allows it on PRO", () => {
    expect(planAllowsFormat("FREE", "pdf")).toBe(false);
    expect(planAllowsFormat("PRO", "pdf")).toBe(true);
  });

  it("allows markdown on every plan", () => {
    expect(planAllowsFormat("FREE", "markdown")).toBe(true);
    expect(planAllowsFormat("PRO", "markdown")).toBe(true);
    expect(planAllowsFormat("ENTERPRISE", "markdown")).toBe(true);
  });
});
