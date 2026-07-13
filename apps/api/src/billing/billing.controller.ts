import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiKeyGuard } from "../api-key.guard";
import { BillingService } from "./billing.service";

// Instantiated directly rather than constructor-injected: NestJS DI needs
// TypeScript's emitDecoratorMetadata output to resolve constructor params,
// which esbuild (and tsx, which wraps it -- see apps/api's "dev" script)
// doesn't emit, silently leaving injected services undefined under `pnpm dev`
// even though the tsc-compiled production build works fine. Every other
// controller in this app already sidesteps this via a module-level singleton
// instead of Nest DI (see scans.controller.ts's `const prisma = ...`).
const billingService = new BillingService();

// Caller identity is the dashboard server (x-api-key), which passes the user
// id from its own verified session cookie -- see apps/dashboard/app/api and
// users.controller.ts/notifications.controller.ts for the same convention.
@Controller("billing")
@UseGuards(ApiKeyGuard)
export class BillingController {
  @Get("plan")
  async getPlan(@Query("userId") userId: string) {
    if (!userId) throw new BadRequestException("Missing userId query param.");
    return billingService.getPlanSummary(userId);
  }

  @Post("subscribe")
  async subscribe(@Body() body: { userId?: string; paypalSubscriptionId?: string }) {
    if (!body.userId || !body.paypalSubscriptionId) {
      throw new BadRequestException("Expected { userId, paypalSubscriptionId }.");
    }
    return billingService.subscribe(body.userId, body.paypalSubscriptionId);
  }

  @Post("cancel")
  async cancel(@Body() body: { userId?: string }) {
    if (!body.userId) throw new BadRequestException("Expected { userId }.");
    return billingService.cancel(body.userId);
  }
}
