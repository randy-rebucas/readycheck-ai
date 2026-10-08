/**
 * Cross-tenant isolation, end to end: boots the real Nest app against a real
 * Postgres (TEST_DATABASE_URL, migrated with `prisma migrate deploy`) and
 * drives it over HTTP as two different users. Only the BullMQ queue is
 * mocked. Skipped when TEST_DATABASE_URL isn't set.
 *
 * WARNING: truncates every table in TEST_DATABASE_URL. Never point it at a
 * database you care about.
 */
import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

vi.mock("@readycheck/queue", () => ({
  getScanQueue: () => ({
    add: vi.fn().mockResolvedValue(undefined),
    getJob: vi.fn().mockResolvedValue(null),
  }),
}));

describe.skipIf(!TEST_DATABASE_URL)("tenant isolation (integration)", () => {
  let app: INestApplication;
  let base: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  const alice = { id: "", token: "", personalOrgId: "" };
  const bob = { id: "", token: "", personalOrgId: "" };
  let aliceScanId = "";
  let aliceNotificationId = "";

  async function call(
    who: { token: string } | null,
    method: string,
    path: string,
    body?: unknown,
    orgId?: string
  ) {
    const headers: Record<string, string> = {};
    if (who) headers.authorization = `Bearer ${who.token}`;
    if (orgId) headers["x-org-id"] = orgId;
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, body: json as any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  async function signUp(email: string, target: typeof alice) {
    const res = await call(null, "POST", "/auth/register", {
      email,
      password: "Sup3r-secret-pass",
      name: email.split("@")[0],
    });
    expect(res.status).toBe(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const membership = await prisma.membership.findFirstOrThrow({
      where: { userId: user.id, org: { personal: true } },
    });
    const { AuthService } = await import("./auth/auth.service");
    target.id = user.id;
    target.token = app.get(AuthService).signSession({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: null,
    });
    target.personalOrgId = membership.orgId;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    delete process.env.READYCHECK_API_KEY;
    delete process.env.READYCHECK_DEV_PLAN;

    const { getPrismaClient } = await import("@readycheck/db");
    prisma = getPrismaClient();
    await prisma.$executeRawUnsafe(
      `TRUNCATE "NotificationRead", "Notification", "Issue", "CategoryScore", "Scan",
                "Subscription", "Membership", "Organization", "Account",
                "PasswordResetToken", "User" CASCADE`
    );

    const { NestFactory } = await import("@nestjs/core");
    const { AppModule } = await import("./app.module");
    app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0);
    base = (await app.getUrl()).replace("[::1]", "localhost");

    await signUp("alice@example.com", alice);
    await signUp("bob@example.com", bob);

    const trigger = await call(alice, "POST", "/scans", { path: "https://github.com/alice/app.git" });
    expect(trigger.status).toBe(201);
    aliceScanId = trigger.body.scanId;

    const notification = await prisma.notification.create({
      data: { type: "scan_completed", title: "Alice's scan", body: "done", scanId: aliceScanId, orgId: alice.personalOrgId },
    });
    aliceNotificationId = notification.id;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it("gives every new user a personal org they own", async () => {
    const res = await call(alice, "GET", "/orgs");
    expect(res.status).toBe(200);
    expect(res.body.currentOrgId).toBe(alice.personalOrgId);
    expect(res.body.orgs).toEqual([expect.objectContaining({ id: alice.personalOrgId, personal: true, role: "owner" })]);
  });

  it("rejects requests without a valid session", async () => {
    expect((await call(null, "GET", "/scans")).status).toBe(401);
    expect((await call({ token: "garbage" }, "GET", "/scans")).status).toBe(401);
    expect((await call(null, "GET", "/notifications")).status).toBe(401);
    expect((await call(null, "GET", "/billing/plan")).status).toBe(401);
    expect((await call(null, "GET", "/health")).status).toBe(200);
  });

  it("scans: another org's scan is invisible", async () => {
    expect((await call(alice, "GET", `/scans/${aliceScanId}`)).status).toBe(200);

    expect((await call(bob, "GET", `/scans/${aliceScanId}`)).status).toBe(404);
    expect((await call(bob, "GET", `/scans/${aliceScanId}/report?format=json`)).status).toBe(404);
    expect((await call(bob, "POST", `/scans/${aliceScanId}/cancel`)).status).toBe(404);

    const bobList = await call(bob, "GET", "/scans");
    expect(bobList.body).toEqual([]);
  });

  it("scans: a userId in the query string is ignored", async () => {
    const res = await call(bob, "GET", `/scans?userId=${alice.id}`);
    expect(res.body).toEqual([]);
  });

  it("orgs: x-org-id for an org you don't belong to is forbidden", async () => {
    expect((await call(bob, "GET", "/scans", undefined, alice.personalOrgId)).status).toBe(403);
    expect((await call(bob, "GET", "/notifications", undefined, alice.personalOrgId)).status).toBe(403);
  });

  it("notifications: only the owning org sees them or can mark them read", async () => {
    const bobs = await call(bob, "GET", "/notifications");
    expect(bobs.body.notifications).toEqual([]);
    expect(bobs.body.unreadCount).toBe(0);

    await call(bob, "POST", "/notifications/read", { id: aliceNotificationId });
    await call(bob, "POST", "/notifications/read-all");
    expect(await prisma.notificationRead.count({ where: { userId: bob.id } })).toBe(0);

    const alices = await call(alice, "GET", "/notifications");
    expect(alices.body.notifications.map((n: { id: string }) => n.id)).toEqual([aliceNotificationId]);
  });

  it("billing: the plan belongs to the caller's org", async () => {
    await prisma.subscription.create({
      data: { orgId: alice.personalOrgId, plan: "PRO", status: "ACTIVE" },
    });
    // Outside production, getEffectivePlan honors only READYCHECK_DEV_PLAN
    // (unset here), so these are the real subscription states.
    expect((await call(alice, "GET", "/billing/plan")).body.plan).toBe("PRO");
    expect((await call(bob, "GET", "/billing/plan")).body.plan).toBe("FREE");
  });

  it("preferences: /users/me only ever touches the caller", async () => {
    await call(bob, "PUT", "/users/me/preferences", { scanComplete: false, weeklyDigest: true, productUpdates: false });
    const alicePrefs = await call(alice, "GET", "/users/me/preferences");
    expect(alicePrefs.body.weeklyDigest).toBe(false);
  });

  describe("team orgs", () => {
    let teamId = "";

    beforeAll(async () => {
      const created = await call(alice, "POST", "/orgs", { name: "Acme Agency" });
      expect(created.status).toBe(201);
      teamId = created.body.id;
    });

    it("non-members can't see the team", async () => {
      expect((await call(bob, "GET", "/orgs/current/members", undefined, teamId)).status).toBe(403);
    });

    it("an admin adds a member, who then sees team scans but not the owner's personal ones", async () => {
      const added = await call(alice, "POST", "/orgs/current/members", { email: "bob@example.com" }, teamId);
      expect(added.status).toBe(201);
      expect(added.body.role).toBe("member");

      const teamScan = await call(alice, "POST", "/scans", { path: "https://github.com/acme/site.git" }, teamId);
      expect(teamScan.status).toBe(201);

      const bobTeamList = await call(bob, "GET", "/scans", undefined, teamId);
      expect(bobTeamList.body.map((s: { id: string }) => s.id)).toEqual([teamScan.body.scanId]);
      expect((await call(bob, "GET", `/scans/${aliceScanId}`, undefined, teamId)).status).toBe(404);
    });

    it("members can't manage members or billing", async () => {
      expect((await call(bob, "POST", "/orgs/current/members", { email: "alice@example.com" }, teamId)).status).toBe(403);
      expect((await call(bob, "POST", "/billing/cancel", {}, teamId)).status).toBe(403);
      expect((await call(bob, "PATCH", `/orgs/current/members/${bob.id}`, { role: "admin" }, teamId)).status).toBe(403);
    });

    it("the last owner can't leave or be demoted", async () => {
      expect((await call(alice, "DELETE", `/orgs/current/members/${alice.id}`, undefined, teamId)).status).toBe(400);
      expect((await call(alice, "PATCH", `/orgs/current/members/${alice.id}`, { role: "member" }, teamId)).status).toBe(400);
    });

    it("personal workspaces never take members", async () => {
      expect((await call(alice, "POST", "/orgs/current/members", { email: "bob@example.com" })).status).toBe(400);
    });

    it("a member can leave", async () => {
      expect((await call(bob, "DELETE", `/orgs/current/members/${bob.id}`, undefined, teamId)).status).toBe(200);
      expect((await call(bob, "GET", "/scans", undefined, teamId)).status).toBe(403);
    });
  });
});
