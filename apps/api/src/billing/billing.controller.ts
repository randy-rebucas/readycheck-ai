import { BadRequestException, Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiKeyGuard } from "../api-key.guard";
import { CurrentTenant, requireRole, type Tenant } from "../tenancy/tenant";
import { BillingService } from "./billing.service";

// Instantiated directly rather than constructor-injected: NestJS DI needs
// TypeScript's emitDecoratorMetadata output to resolve constructor params,
// which esbuild (and tsx, which wraps it -- see apps/api's "dev" script)
// doesn't emit, silently leaving injected services undefined under `pnpm dev`
// even though the tsc-compiled production build works fine. Every other
// controller in this app already sidesteps this via a module-level singleton
// instead of Nest DI (see scans.controller.ts's `const prisma = ...`).
const billingService = new BillingService();

// The plan belongs to the caller's current org. Any member can see it; only
// owners and admins can change it.
@Controller("billing")
@UseGuards(ApiKeyGuard)
export class BillingController {
  @Get("plan")
  async getPlan(@CurrentTenant() tenant: Tenant) {
    return billingService.getPlanSummary(tenant.orgId);
  }

  @Post("subscribe")
  async subscribe(
    @CurrentTenant() tenant: Tenant,
    @Body() body: { paypalSubscriptionId?: string }
  ) {
    requireRole(tenant, "admin");
    if (!body.paypalSubscriptionId) {
      throw new BadRequestException("Expected { paypalSubscriptionId }.");
    }
    return billingService.subscribe(tenant.orgId, body.paypalSubscriptionId);
  }

  @Post("cancel")
  async cancel(@CurrentTenant() tenant: Tenant) {
    requireRole(tenant, "admin");
    return billingService.cancel(tenant.orgId);
  }
}
