import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingWebhookController } from "./billing-webhook.controller";

// BillingService is instantiated directly by the controllers, not registered
// as a Nest provider -- see billing.controller.ts for why.
@Module({
  controllers: [BillingController, BillingWebhookController],
})
export class BillingModule {}
