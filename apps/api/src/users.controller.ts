import { BadRequestException, Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { getPrismaClient } from "@readycheck/db";
import { ApiKeyGuard } from "./api-key.guard";
import { CurrentTenant, type Tenant } from "./tenancy/tenant";

// Type alias (not interface) so it satisfies Prisma's InputJsonObject, which
// requires an implicit index signature.
export type UserPreferences = {
  scanComplete: boolean;
  weeklyDigest: boolean;
  productUpdates: boolean;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  scanComplete: true,
  weeklyDigest: false,
  productUpdates: false,
};

/** Accepts only the known boolean keys; anything else is dropped. */
function sanitizePreferences(body: unknown): UserPreferences | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const source = body as Record<string, unknown>;
  const prefs = { ...DEFAULT_PREFERENCES };
  for (const key of Object.keys(prefs) as (keyof UserPreferences)[]) {
    if (typeof source[key] === "boolean") prefs[key] = source[key];
  }
  return prefs;
}

const prisma = getPrismaClient();

/** Used by NotificationsController to filter events the user opted out of. */
export async function getPreferencesFor(userId: string): Promise<UserPreferences> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  return sanitizePreferences(user?.preferences) ?? { ...DEFAULT_PREFERENCES };
}

// Preferences are per user (not per org), and only ever the caller's own.
@Controller("users/me")
@UseGuards(ApiKeyGuard)
export class UsersController {
  @Get("preferences")
  async getPreferences(@CurrentTenant() tenant: Tenant): Promise<UserPreferences> {
    return getPreferencesFor(tenant.userId);
  }

  @Put("preferences")
  async putPreferences(
    @CurrentTenant() tenant: Tenant,
    @Body() body: unknown
  ): Promise<UserPreferences> {
    const prefs = sanitizePreferences(body);
    if (!prefs) throw new BadRequestException("Expected a preferences object.");

    await prisma.user.update({ where: { id: tenant.userId }, data: { preferences: prefs } });
    return prefs;
  }
}
