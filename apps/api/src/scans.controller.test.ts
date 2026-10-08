import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tenant } from "./tenancy/tenant";

// vi.mock is hoisted above every import *and* every top-level const in this
// file, so prismaMock must be created via vi.hoisted() to exist by the time
// the mock factory below runs.
const prismaMock = vi.hoisted(() => ({
  subscription: { findUnique: vi.fn() },
  scan: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
}));

const tenant: Tenant = { userId: "user-1", orgId: "org-1", role: "owner", personal: true };

vi.mock("@readycheck/db", () => ({
  getPrismaClient: () => prismaMock,
}));

vi.mock("@readycheck/queue", () => ({
  getScanQueue: () => ({ add: vi.fn().mockResolvedValue(undefined) }),
}));

// vi.mock calls above are hoisted above this import by vitest's babel/esbuild
// transform, so scans.controller.ts's module-level getPrismaClient()/
// getScanQueue() calls see the mocks.
import { ScansController } from "./scans.controller";

describe("ScansController.trigger plan gating", () => {
  const controller = new ScansController();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.subscription.findUnique.mockResolvedValue(null); // FREE plan
    prismaMock.scan.count.mockResolvedValue(0);
    prismaMock.scan.create.mockResolvedValue({ id: "new-scan", status: "queued" });
  });

  it("rejects a second distinct repository on the FREE plan", async () => {
    prismaMock.scan.findMany.mockResolvedValue([{ path: "https://github.com/org/already-scanned.git" }]);

    await expect(
      controller.trigger(tenant, { path: "https://github.com/org/new-repo.git" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows rescanning an already-scanned repository on the FREE plan", async () => {
    const path = "https://github.com/org/already-scanned.git";
    prismaMock.scan.findMany.mockResolvedValue([{ path }]);

    await expect(controller.trigger(tenant, { path })).resolves.toEqual({
      scanId: "new-scan",
      status: "queued",
    });
  });

  it("allows the first repository on the FREE plan", async () => {
    prismaMock.scan.findMany.mockResolvedValue([]);

    await expect(
      controller.trigger(tenant, { path: "https://github.com/org/first-repo.git" })
    ).resolves.toEqual({ scanId: "new-scan", status: "queued" });
  });

  it("rejects once the daily scan limit is hit on the FREE plan", async () => {
    prismaMock.scan.findMany.mockResolvedValue([{ path: "https://github.com/org/repo.git" }]);
    prismaMock.scan.count.mockResolvedValue(5); // FREE plan's dailyScanLimit

    await expect(
      controller.trigger(tenant, { path: "https://github.com/org/repo.git" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("has no repository or daily limit on the PRO plan", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({
      plan: "PRO",
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    });
    prismaMock.scan.findMany.mockResolvedValue([
      { path: "https://github.com/org/repo-1.git" },
      { path: "https://github.com/org/repo-2.git" },
    ]);
    prismaMock.scan.count.mockResolvedValue(999);

    await expect(
      controller.trigger(tenant, { path: "https://github.com/org/repo-3.git" })
    ).resolves.toEqual({ scanId: "new-scan", status: "queued" });
  });

  it("rejects a request with no source", async () => {
    await expect(controller.trigger(tenant, {})).rejects.toThrow();
  });

  it("counts limits and stores the scan against the caller's org", async () => {
    prismaMock.scan.findMany.mockResolvedValue([]);

    await controller.trigger(tenant, { path: "https://github.com/org/first-repo.git" });

    expect(prismaMock.subscription.findUnique).toHaveBeenCalledWith({ where: { orgId: "org-1" } });
    expect(prismaMock.scan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: "org-1" } })
    );
    expect(prismaMock.scan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orgId: "org-1", userId: "user-1" }),
    });
  });
});

describe("ScansController org scoping", () => {
  const controller = new ScansController();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.scan.findFirst.mockResolvedValue(null); // not in the caller's org
  });

  it("looks scans up by id *and* the caller's org", async () => {
    await expect(controller.getStatus(tenant, "someone-elses-scan")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(prismaMock.scan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "someone-elses-scan", orgId: "org-1" } })
    );
  });

  it("won't cancel another org's scan", async () => {
    await expect(controller.cancel(tenant, "someone-elses-scan")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("lists only the caller's org", async () => {
    prismaMock.scan.findMany.mockResolvedValue([]);
    await controller.list(tenant);
    expect(prismaMock.scan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: "org-1" } })
    );
  });
});
