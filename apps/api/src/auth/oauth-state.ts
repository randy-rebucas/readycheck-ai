// The OAuth `state` param round-trips the dashboard callback URL we should
// redirect back to once the provider flow completes. CSRF binding is handled
// on the dashboard side (its /api/auth/start route sets a nonce cookie that
// its /api/auth/callback verifies); here we only need to make sure the token
// can never be redirected anywhere except the dashboard's callback route.

function dashboardOrigin(): string {
  return new URL(process.env.DASHBOARD_URL ?? "http://localhost:3000").origin;
}

const CALLBACK_PATH = "/api/auth/callback";

function fallbackUrl(): string {
  return `${dashboardOrigin()}${CALLBACK_PATH}`;
}

/**
 * Only the dashboard's exact origin + callback path is allowed. Exact origin
 * comparison via URL parsing -- a startsWith() prefix check would accept
 * lookalike hosts such as `https://dashboard.example.com.evil.com`.
 */
function sanitizeRedirect(candidate: string | undefined): string {
  if (!candidate) return fallbackUrl();

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return fallbackUrl();
  }

  if (url.origin !== dashboardOrigin() || url.pathname !== CALLBACK_PATH) {
    return fallbackUrl();
  }

  return url.toString();
}

export function encodeRedirectState(redirectUri: string | undefined): string {
  return Buffer.from(sanitizeRedirect(redirectUri), "utf8").toString("base64url");
}

export function decodeRedirectState(state: string | undefined): string {
  if (!state) return fallbackUrl();

  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    return sanitizeRedirect(decoded);
  } catch {
    return fallbackUrl();
  }
}
