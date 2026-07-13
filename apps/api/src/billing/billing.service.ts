import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { getPrismaClient } from "@readycheck/db";
import {
  cancelSubscription as paypalCancelSubscription,
  getEffectivePlan,
  getSubscription as paypalGetSubscription,
  PLAN_LIMITS,
  verifyWebhookSignature,
  type PlanTier,
  type WebhookVerificationInput,
} from "@readycheck/billing";

const prisma = getPrismaClient();

export interface PlanSummary {
  plan: PlanTier;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  usage: {
    repositories: number;
    repositoryLimit: number;
  };
}

// Not a Nest @Injectable() / constructor-injected provider on purpose -- see
// billing.controller.ts for why (esbuild/tsx doesn't emit the decorator
// metadata Nest's DI needs, so this mirrors the module-level-singleton
// pattern already used by ScansController/UsersController/NotificationsController).
export class BillingService {
  async getPlanSummary(userId: string): Promise<PlanSummary> {
    const subscription = await prisma.subscription.findUnique({ where: { userId } });
    const plan = getEffectivePlan(subscription);

    const scannedPaths = await prisma.scan.findMany({
      where: { userId },
      distinct: ["path"],
      select: { path: true },
    });

    return {
      plan,
      status: subscription?.status ?? "ACTIVE",
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      usage: {
        repositories: scannedPaths.length,
        repositoryLimit: PLAN_LIMITS[plan].maxRepositories,
      },
    };
  }

  async subscribe(userId: string, paypalSubscriptionId: string): Promise<PlanSummary> {
    const paypalSub = await paypalGetSubscription(paypalSubscriptionId);

    const expectedPlanId = process.env.PAYPAL_PRO_PLAN_ID;
    if (!expectedPlanId || paypalSub.plan_id !== expectedPlanId) {
      throw new BadRequestException("Subscription does not match the configured Pro plan.");
    }
    if (paypalSub.status !== "ACTIVE") {
      throw new BadRequestException(`PayPal subscription is not active (status: ${paypalSub.status}).`);
    }

    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: "PRO",
        status: "ACTIVE",
        paypalSubscriptionId,
        currentPeriodEnd: paypalSub.billing_info?.next_billing_time
          ? new Date(paypalSub.billing_info.next_billing_time)
          : null,
        cancelAtPeriodEnd: false,
      },
      update: {
        plan: "PRO",
        status: "ACTIVE",
        paypalSubscriptionId,
        currentPeriodEnd: paypalSub.billing_info?.next_billing_time
          ? new Date(paypalSub.billing_info.next_billing_time)
          : null,
        cancelAtPeriodEnd: false,
      },
    });

    return this.getPlanSummary(userId);
  }

  async cancel(userId: string): Promise<PlanSummary> {
    const subscription = await prisma.subscription.findUnique({ where: { userId } });
    if (!subscription?.paypalSubscriptionId) {
      throw new NotFoundException("No active subscription to cancel.");
    }

    await paypalCancelSubscription(subscription.paypalSubscriptionId, "Cancelled by user");
    // Access stays at the current plan until currentPeriodEnd -- getEffectivePlan()
    // handles the downgrade once that date passes.
    await prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true },
    });

    return this.getPlanSummary(userId);
  }

  async verifyAndHandleWebhook(input: WebhookVerificationInput): Promise<void> {
    const verified = await verifyWebhookSignature(input);
    if (!verified) {
      throw new ForbiddenException("Invalid PayPal webhook signature.");
    }

    const event = input.webhookEvent as {
      event_type?: string;
      resource?: { id?: string; billing_info?: { next_billing_time?: string } };
    };
    const subscriptionId = event.resource?.id;
    if (!subscriptionId) return;

    const subscription = await prisma.subscription.findUnique({
      where: { paypalSubscriptionId: subscriptionId },
    });
    if (!subscription) return; // Not one of ours (or not confirmed via /billing/subscribe yet).

    switch (event.event_type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
        await prisma.subscription.update({
          where: { paypalSubscriptionId: subscriptionId },
          data: { status: "ACTIVE", cancelAtPeriodEnd: false },
        });
        break;
      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED":
        await prisma.subscription.update({
          where: { paypalSubscriptionId: subscriptionId },
          data: { status: "CANCELLED" },
        });
        break;
      case "BILLING.SUBSCRIPTION.SUSPENDED":
        await prisma.subscription.update({
          where: { paypalSubscriptionId: subscriptionId },
          data: { status: "SUSPENDED" },
        });
        break;
      case "PAYMENT.SALE.COMPLETED": {
        // The sale event's resource doesn't reliably carry the next billing
        // date -- re-fetch the subscription itself rather than guess at the
        // payload shape.
        const refreshed = await paypalGetSubscription(subscriptionId);
        if (refreshed.billing_info?.next_billing_time) {
          await prisma.subscription.update({
            where: { paypalSubscriptionId: subscriptionId },
            data: { currentPeriodEnd: new Date(refreshed.billing_info.next_billing_time) },
          });
        }
        break;
      }
      default:
        break;
    }
  }
}
