import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { getPrismaClient } from "@readycheck/db";
import { ApiKeyGuard } from "./api-key.guard";
import { CurrentTenant, type Tenant } from "./tenancy/tenant";
import { getPreferencesFor } from "./users.controller";

/** Notification types gated by the "Scan completed" preference toggle. */
const SCAN_LIFECYCLE_TYPES = new Set(["scan_completed", "scan_failed"]);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  scanId: string | null;
  createdAt: string;
  read: boolean;
}

const prisma = getPrismaClient();

// Notifications are scoped to the caller's current org; read state is per user.
@Controller("notifications")
@UseGuards(ApiKeyGuard)
export class NotificationsController {
  @Get()
  async list(
    @CurrentTenant() tenant: Tenant,
    @Query("limit") limitParam?: string
  ): Promise<{ notifications: NotificationDto[]; unreadCount: number }> {
    const limit = Math.min(Math.max(Number(limitParam) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { userId, orgId } = tenant;

    const prefs = await getPreferencesFor(userId);
    // Events the user has turned off never appear, whether read or not.
    const typeFilter = prefs.scanComplete ? {} : { type: { notIn: [...SCAN_LIFECYCLE_TYPES] } };

    const notifications = await prisma.notification.findMany({
      where: { orgId, ...typeFilter },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { reads: { where: { userId }, select: { id: true } } },
    });

    const unreadCount = await prisma.notification.count({
      where: { orgId, ...typeFilter, reads: { none: { userId } } },
    });

    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        scanId: n.scanId,
        createdAt: n.createdAt.toISOString(),
        read: n.reads.length > 0,
      })),
      unreadCount,
    };
  }

  @Post("read")
  async markRead(
    @CurrentTenant() tenant: Tenant,
    @Body() body: { id?: string }
  ): Promise<{ ok: true }> {
    if (!body.id) throw new BadRequestException("Expected { id }.");

    // Only notifications in the caller's org can be marked; anything else is
    // silently a no-op so ids from other orgs can't be probed.
    const notification = await prisma.notification.findFirst({
      where: { id: body.id, orgId: tenant.orgId },
      select: { id: true },
    });
    if (notification) {
      await prisma.notificationRead.upsert({
        where: { notificationId_userId: { notificationId: notification.id, userId: tenant.userId } },
        create: { notificationId: notification.id, userId: tenant.userId },
        update: {},
      });
    }
    return { ok: true };
  }

  @Post("read-all")
  async markAllRead(@CurrentTenant() tenant: Tenant): Promise<{ ok: true }> {
    const unread = await prisma.notification.findMany({
      where: { orgId: tenant.orgId, reads: { none: { userId: tenant.userId } } },
      select: { id: true },
    });
    if (unread.length > 0) {
      await prisma.notificationRead.createMany({
        data: unread.map((n) => ({ notificationId: n.id, userId: tenant.userId })),
        skipDuplicates: true,
      });
    }
    return { ok: true };
  }
}
