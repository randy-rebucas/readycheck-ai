import { randomBytes } from "node:crypto";
import { getPrismaClient, type Prisma } from "@readycheck/db";
import type { OrgRole, Tenant } from "./tenant";

const prisma = getPrismaClient();

type Tx = Prisma.TransactionClient;

const ROLE_RANK: Record<OrgRole, number> = { member: 0, admin: 1, owner: 2 };

export function roleAtLeast(role: OrgRole, minimum: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** "Acme Corp!" -> "acme-corp-3f9a1c". The suffix keeps slugs unique without a retry loop. */
export function slugForOrgName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "org"}-${randomBytes(3).toString("hex")}`;
}

function personalOrgName(user: { name: string | null; email: string | null }): string {
  return `${user.name || user.email || "Personal"}'s workspace`;
}

/**
 * Every user owns exactly one personal org. Called inside the user-creation
 * transaction at signup; ensurePersonalOrg() covers users created any other
 * way (or before tenancy existed).
 */
export async function createPersonalOrg(
  tx: Tx,
  user: { id: string; name: string | null; email: string | null }
): Promise<string> {
  const org = await tx.organization.create({
    data: {
      name: personalOrgName(user),
      // Same slug scheme the tenancy migration used for backfilled users.
      slug: `personal-${user.id}`,
      personal: true,
      memberships: { create: { userId: user.id, role: "owner" } },
    },
  });
  return org.id;
}

/** Returns the user's personal org id, creating it if missing; null if the user doesn't exist. */
export async function ensurePersonalOrg(userId: string): Promise<string | null> {
  const existing = await prisma.membership.findFirst({
    where: { userId, org: { personal: true } },
    select: { orgId: true },
  });
  if (existing) return existing.orgId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) return null;

  try {
    return await prisma.$transaction((tx) => createPersonalOrg(tx, user));
  } catch {
    // Lost a race with a concurrent request creating the same slug.
    const raced = await prisma.organization.findUnique({
      where: { slug: `personal-${userId}` },
      select: { id: true },
    });
    return raced?.id ?? null;
  }
}

export type TenantResolution =
  | { ok: true; tenant: Tenant }
  | { ok: false; reason: "unknown_user" | "not_a_member" };

/**
 * Picks the org a request acts on. An explicit org id must be one the user
 * is a member of -- it is never trusted on its own. No org id means the
 * user's personal org.
 */
export async function resolveTenant(
  userId: string,
  requestedOrgId: string | undefined
): Promise<TenantResolution> {
  if (requestedOrgId) {
    const membership = await prisma.membership.findUnique({
      where: { orgId_userId: { orgId: requestedOrgId, userId } },
      select: { role: true, org: { select: { personal: true } } },
    });
    if (!membership) return { ok: false, reason: "not_a_member" };
    return {
      ok: true,
      tenant: {
        userId,
        orgId: requestedOrgId,
        role: membership.role,
        personal: membership.org.personal,
      },
    };
  }

  const orgId = await ensurePersonalOrg(userId);
  if (!orgId) return { ok: false, reason: "unknown_user" };
  return { ok: true, tenant: { userId, orgId, role: "owner", personal: true } };
}
