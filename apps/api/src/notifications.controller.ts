import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { getPrismaClient } from "@readycheck/db";
import { ApiKeyGuard } from "./api-key.guard";
import { getPreferencesFor } from "./users.controller";

/** Notification types gated by the "Scan completed" preference toggle. */
const SCAN_LIFECYCLE_TYPES = new Set(["scan_completed", "scan_failed"]);

const DEFAULT_LIMIT = 20;

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

// Caller identity is the dashboard server (x-api-key), which passes the user
// id from its own verified session cookie -- see apps/dashboard/app/api.
@Controller("notifications")
@UseGuards(ApiKeyGuard)
export class NotificationsController {
  @Get()
  async list(
    @Query("userId") userId: string,
    @Query("limit") limitParam?: string
  ): Promise<{ notifications: NotificationDto[]; unreadCount: number }> {
    if (!userId) throw new BadRequestException("Missing userId query param.");
    const limit = limitParam ? Number(limitParam) : DEFAULT_LIMIT;

    const prefs = await getPreferencesFor(userId);

    const notifications = await prisma.notification.findMany({
      // Events the user has turned off never appear, whether read or not.
      where: prefs.scanComplete ? {} : { type: { notIn: [...SCAN_LIFECYCLE_TYPES] } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { reads: { where: { userId }, select: { id: true } } },
    });

    const unreadCount = await prisma.notification.count({
      where: {
        ...(prefs.scanComplete ? {} : { type: { notIn: [...SCAN_LIFECYCLE_TYPES] } }),
        reads: { none: { userId } },
      },
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
  async markRead(@Body() body: { userId?: string; id?: string }): Promise<{ ok: true }> {
    if (!body.userId || !body.id) {
      throw new BadRequestException("Expected { userId, id }.");
    }
    await prisma.notificationRead.upsert({
      where: { notificationId_userId: { notificationId: body.id, userId: body.userId } },
      create: { notificationId: body.id, userId: body.userId },
      update: {},
    });
    return { ok: true };
  }

  @Post("read-all")
  async markAllRead(@Body() body: { userId?: string }): Promise<{ ok: true }> {
    if (!body.userId) throw new BadRequestException("Expected { userId }.");

    const unread = await prisma.notification.findMany({
      where: { reads: { none: { userId: body.userId } } },
      select: { id: true },
    });
    if (unread.length > 0) {
      await prisma.notificationRead.createMany({
        data: unread.map((n) => ({ notificationId: n.id, userId: body.userId as string })),
        skipDuplicates: true,
      });
    }
    return { ok: true };
  }
}
