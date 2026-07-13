import { ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted above every import *and* every top-level const in this
// file, so prismaMock must be created via vi.hoisted() to exist by the time
// the mock factory below runs.
const prismaMock = vi.hoisted(() => ({
  subscription: { findUnique: vi.fn() },
  scan: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
}));

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
      controller.trigger({ userId: "user-1", path: "https://github.com/org/new-repo.git" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows rescanning an already-scanned repository on the FREE plan", async () => {
    const path = "https://github.com/org/already-scanned.git";
    prismaMock.scan.findMany.mockResolvedValue([{ path }]);

    await expect(controller.trigger({ userId: "user-1", path })).resolves.toEqual({
      scanId: "new-scan",
      status: "queued",
    });
  });

  it("allows the first repository on the FREE plan", async () => {
    prismaMock.scan.findMany.mockResolvedValue([]);

    await expect(
      controller.trigger({ userId: "user-1", path: "https://github.com/org/first-repo.git" })
    ).resolves.toEqual({ scanId: "new-scan", status: "queued" });
  });

  it("rejects once the daily scan limit is hit on the FREE plan", async () => {
    prismaMock.scan.findMany.mockResolvedValue([{ path: "https://github.com/org/repo.git" }]);
    prismaMock.scan.count.mockResolvedValue(5); // FREE plan's dailyScanLimit

    await expect(
      controller.trigger({ userId: "user-1", path: "https://github.com/org/repo.git" })
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
      controller.trigger({ userId: "user-1", path: "https://github.com/org/repo-3.git" })
    ).resolves.toEqual({ scanId: "new-scan", status: "queued" });
  });

  it("rejects a request with no userId", async () => {
    await expect(controller.trigger({ path: "https://github.com/org/repo.git" })).rejects.toThrow();
  });
});
