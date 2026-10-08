import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { getPrismaClient } from "@readycheck/db";
import { ApiKeyGuard } from "./api-key.guard";
import { roleAtLeast, slugForOrgName } from "./tenancy/orgs";
import { CurrentTenant, requireRole, type OrgRole, type Tenant } from "./tenancy/tenant";

const ROLES: OrgRole[] = ["owner", "admin", "member"];
const MAX_ORG_NAME = 80;

const prisma = getPrismaClient();

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  personal: boolean;
  role: OrgRole;
}

export interface MemberDto {
  userId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  role: OrgRole;
  joinedAt: string;
}

function parseRole(value: unknown): OrgRole | null {
  return typeof value === "string" && (ROLES as string[]).includes(value) ? (value as OrgRole) : null;
}

/** Only owners may hand out (or take away) the owner role. */
function assertCanAssign(tenant: Tenant, role: OrgRole): void {
  if (role === "owner" && tenant.role !== "owner") {
    throw new ForbiddenException("Only an owner can grant the owner role.");
  }
}

async function ownerCount(orgId: string): Promise<number> {
  return prisma.membership.count({ where: { orgId, role: "owner" } });
}

@Controller("orgs")
@UseGuards(ApiKeyGuard)
export class OrgsController {
  /** Every org the caller belongs to, plus which one this request resolved to. */
  @Get()
  async list(@CurrentTenant() tenant: Tenant): Promise<{ currentOrgId: string; orgs: OrgSummary[] }> {
    const memberships = await prisma.membership.findMany({
      where: { userId: tenant.userId },
      include: { org: true },
      // Personal workspace first, then team orgs alphabetically.
      orderBy: [{ org: { personal: "desc" } }, { org: { name: "asc" } }],
    });
    return {
      currentOrgId: tenant.orgId,
      orgs: memberships.map((m) => ({
        id: m.org.id,
        name: m.org.name,
        slug: m.org.slug,
        personal: m.org.personal,
        role: m.role,
      })),
    };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  async create(@CurrentTenant() tenant: Tenant, @Body() body: { name?: unknown }): Promise<OrgSummary> {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > MAX_ORG_NAME) {
      throw new BadRequestException(`Organization name must be 1-${MAX_ORG_NAME} characters.`);
    }

    const org = await prisma.organization.create({
      data: {
        name,
        slug: slugForOrgName(name),
        memberships: { create: { userId: tenant.userId, role: "owner" } },
      },
    });
    return { id: org.id, name: org.name, slug: org.slug, personal: false, role: "owner" };
  }

  @Get("current/members")
  async members(@CurrentTenant() tenant: Tenant): Promise<MemberDto[]> {
    const memberships = await prisma.membership.findMany({
      where: { orgId: tenant.orgId },
      include: { user: { select: { email: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      joinedAt: m.createdAt.toISOString(),
    }));
  }

  /**
   * Adds an existing ReadyCheck user by email. Email invitations for people
   * without an account aren't built yet -- they have to sign up first.
   */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("current/members")
  async addMember(
    @CurrentTenant() tenant: Tenant,
    @Body() body: { email?: unknown; role?: unknown }
  ): Promise<MemberDto> {
    requireRole(tenant, "admin");
    if (tenant.personal) {
      throw new BadRequestException("Personal workspaces can't have other members. Create an organization instead.");
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) throw new BadRequestException("Expected { email }.");
    const role = body.role === undefined ? "member" : parseRole(body.role);
    if (!role) throw new BadRequestException(`role must be one of: ${ROLES.join(", ")}.`);
    assertCanAssign(tenant, role);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException("No ReadyCheck account uses that email. Ask them to sign up first.");
    }

    const existing = await prisma.membership.findUnique({
      where: { orgId_userId: { orgId: tenant.orgId, userId: user.id } },
    });
    if (existing) throw new BadRequestException("That user is already a member.");

    const membership = await prisma.membership.create({
      data: { orgId: tenant.orgId, userId: user.id, role },
    });
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: membership.role,
      joinedAt: membership.createdAt.toISOString(),
    };
  }

  @Patch("current/members/:userId")
  async changeRole(
    @CurrentTenant() tenant: Tenant,
    @Param("userId") userId: string,
    @Body() body: { role?: unknown }
  ): Promise<{ userId: string; role: OrgRole }> {
    requireRole(tenant, "admin");
    const role = parseRole(body.role);
    if (!role) throw new BadRequestException(`role must be one of: ${ROLES.join(", ")}.`);

    const target = await prisma.membership.findUnique({
      where: { orgId_userId: { orgId: tenant.orgId, userId } },
    });
    if (!target) throw new NotFoundException("No such member.");

    // Granting or revoking owner is owner-only.
    assertCanAssign(tenant, role);
    assertCanAssign(tenant, target.role);

    if (target.role === "owner" && role !== "owner" && (await ownerCount(tenant.orgId)) <= 1) {
      throw new BadRequestException("An organization must keep at least one owner.");
    }

    await prisma.membership.update({ where: { id: target.id }, data: { role } });
    return { userId, role };
  }

  /** Admins remove others; anyone can remove themselves (leave). */
  @Delete("current/members/:userId")
  async removeMember(
    @CurrentTenant() tenant: Tenant,
    @Param("userId") userId: string
  ): Promise<{ ok: true }> {
    if (tenant.personal) {
      throw new BadRequestException("You can't leave or remove members from a personal workspace.");
    }

    const leaving = userId === tenant.userId;
    if (!leaving) requireRole(tenant, "admin");

    const target = await prisma.membership.findUnique({
      where: { orgId_userId: { orgId: tenant.orgId, userId } },
    });
    if (!target) throw new NotFoundException("No such member.");

    if (!leaving && target.role === "owner" && !roleAtLeast(tenant.role, "owner")) {
      throw new ForbiddenException("Only an owner can remove another owner.");
    }
    if (target.role === "owner" && (await ownerCount(tenant.orgId)) <= 1) {
      throw new BadRequestException("An organization must keep at least one owner.");
    }

    await prisma.membership.delete({ where: { id: target.id } });
    return { ok: true };
  }
}
