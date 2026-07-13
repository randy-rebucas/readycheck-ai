// Server-only: reads PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET. Never import this
// file from browser-bundled code -- apps/dashboard should only import
// ./plan-tiers for its client-visible plan/limit config.

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

function apiBase(): string {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set to use PayPal billing.");
  }
  return { clientId, clientSecret };
}

/** OAuth2 client-credentials token, cached until ~60s before expiry. */
export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  const { clientId, clientSecret } = credentials();
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal token request failed: ${res.status}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.accessToken;
}

async function paypalFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

export interface PayPalSubscription {
  id: string;
  plan_id: string;
  status: string;
  billing_info?: {
    next_billing_time?: string;
  };
}

export async function getSubscription(subscriptionId: string): Promise<PayPalSubscription> {
  const res = await paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
  if (!res.ok) throw new Error(`Failed to fetch PayPal subscription ${subscriptionId}: ${res.status}`);
  return res.json() as Promise<PayPalSubscription>;
}

export async function cancelSubscription(subscriptionId: string, reason: string): Promise<void> {
  const res = await paypalFetch(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    { method: "POST", body: JSON.stringify({ reason }) }
  );
  // 204 No Content on success.
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to cancel PayPal subscription ${subscriptionId}: ${res.status}`);
  }
}

export interface WebhookVerificationInput {
  /** Raw (parsed) request headers -- PayPal's verify endpoint wants these exact fields. */
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
  /** Parsed JSON body of the webhook request. */
  webhookEvent: unknown;
}

/**
 * Delegates signature verification to PayPal's own endpoint rather than
 * hand-rolling the crypto -- see
 * https://developer.paypal.com/api/rest/webhooks/rest/#link-verifywebhooksignature.
 */
export async function verifyWebhookSignature(input: WebhookVerificationInput): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("PAYPAL_WEBHOOK_ID must be set to verify PayPal webhooks.");

  const res = await paypalFetch("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      transmission_id: input.transmissionId,
      transmission_time: input.transmissionTime,
      cert_url: input.certUrl,
      auth_algo: input.authAlgo,
      transmission_sig: input.transmissionSig,
      webhook_id: webhookId,
      webhook_event: input.webhookEvent,
    }),
  });
  if (!res.ok) return false;

  const data = (await res.json()) as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}
