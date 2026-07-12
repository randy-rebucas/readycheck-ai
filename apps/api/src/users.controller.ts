import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
  UseGuards,
} from "@nestjs/common";
import { getPrismaClient } from "@readycheck/db";
import { ApiKeyGuard } from "./api-key.guard";

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

// Caller identity is the dashboard server (x-api-key), which passes the user
// id from its own verified session cookie -- see apps/dashboard/app/api.
@Controller("users")
@UseGuards(ApiKeyGuard)
export class UsersController {
  @Get(":id/preferences")
  async getPreferences(@Param("id") id: string): Promise<UserPreferences> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { preferences: true },
    });
    if (!user) throw new NotFoundException(`No user found with id ${id}`);

    return sanitizePreferences(user.preferences) ?? { ...DEFAULT_PREFERENCES };
  }

  @Put(":id/preferences")
  async putPreferences(
    @Param("id") id: string,
    @Body() body: unknown
  ): Promise<UserPreferences> {
    const prefs = sanitizePreferences(body);
    if (!prefs) throw new BadRequestException("Expected a preferences object.");

    try {
      await prisma.user.update({ where: { id }, data: { preferences: prefs } });
    } catch {
      throw new NotFoundException(`No user found with id ${id}`);
    }
    return prefs;
  }
}
