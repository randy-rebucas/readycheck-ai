import { Body, Controller, Headers, Post } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { Public } from "../tenancy/tenant";

// Instantiated directly, not constructor-injected -- see billing.controller.ts
// for why (esbuild/tsx dev mode doesn't emit the decorator metadata Nest DI needs).
const billingService = new BillingService();

// No ApiKeyGuard here -- PayPal calls this directly and can't send our shared
// secret. Authenticity is instead verified via PayPal's own webhook
// signature-verification endpoint (see BillingService.verifyAndHandleWebhook).
@Public()
@Controller("billing")
export class BillingWebhookController {
  @Post("webhook")
  async webhook(
    @Body() body: unknown,
    @Headers("paypal-transmission-id") transmissionId: string,
    @Headers("paypal-transmission-time") transmissionTime: string,
    @Headers("paypal-cert-url") certUrl: string,
    @Headers("paypal-auth-algo") authAlgo: string,
    @Headers("paypal-transmission-sig") transmissionSig: string
  ) {
    await billingService.verifyAndHandleWebhook({
      transmissionId,
      transmissionTime,
      certUrl,
      authAlgo,
      transmissionSig,
      webhookEvent: body,
    });
    return { ok: true };
  }
}
