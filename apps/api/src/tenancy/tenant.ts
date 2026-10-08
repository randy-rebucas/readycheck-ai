import {
  createParamDecorator,
  ForbiddenException,
  SetMetadata,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";
import { roleAtLeast } from "./orgs";

export type OrgRole = "owner" | "admin" | "member";

/** Who is calling and which organization the request acts on. Set by SessionGuard. */
export interface Tenant {
  userId: string;
  orgId: string;
  role: OrgRole;
  personal: boolean;
}

export type TenantRequest = Request & { tenant?: Tenant };

export const IS_PUBLIC_KEY = "readycheck:isPublic";

/** Opts a controller or route out of SessionGuard (health, auth, webhooks). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** The authenticated caller's tenant. Only valid on non-@Public() routes. */
export const CurrentTenant = createParamDecorator((_: unknown, ctx: ExecutionContext): Tenant => {
  const tenant = ctx.switchToHttp().getRequest<TenantRequest>().tenant;
  if (!tenant) {
    // SessionGuard always sets it on non-public routes; reaching here means a
    // route was marked @Public() but still asks for a tenant.
    throw new Error("CurrentTenant used on a route without SessionGuard.");
  }
  return tenant;
});

export function requireRole(tenant: Tenant, minimum: OrgRole): void {
  if (!roleAtLeast(tenant.role, minimum)) {
    throw new ForbiddenException(`This action requires the ${minimum} role in this organization.`);
  }
}
