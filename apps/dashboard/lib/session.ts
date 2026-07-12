import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "rc_session";
export const LOGIN_NONCE_COOKIE = "rc_login_nonce";

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

// Both token kinds are signed with the shared AUTH_JWT_SECRET; the purpose
// claim keeps the short-lived transfer token (carried in the OAuth redirect
// URL) from ever being replayed as a session cookie, and vice versa.
type TokenPurpose = "session" | "transfer";

function secret(): Uint8Array {
  const value = process.env.AUTH_JWT_SECRET;
  if (!value) {
    // The dev fallback is public knowledge (it's in this repo) -- refuse to
    // run production on it rather than silently accepting forgeable sessions.
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_JWT_SECRET must be set in production.");
    }
    return new TextEncoder().encode("dev-insecure-secret-change-me");
  }
  return new TextEncoder().encode(value);
}

async function verifyToken(token: string, purpose: TokenPurpose): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || payload.purpose !== purpose) return null;
    return {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
      avatarUrl: typeof payload.avatarUrl === "string" ? payload.avatarUrl : null,
    };
  } catch {
    return null;
  }
}

// Edge-runtime safe (used from middleware).
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  return verifyToken(token, "session");
}

/** The 60s token apps/api hands back in the OAuth callback redirect. */
export async function verifyTransferToken(token: string): Promise<SessionUser | null> {
  return verifyToken(token, "transfer");
}

/** Mints the long-lived session cookie value after a transfer token checks out. */
export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    purpose: "session" satisfies TokenPurpose,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Options shared by every place that sets the session cookie. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  };
}

/**
 * Only allow same-origin path redirects. Note "//evil.com" satisfies a naive
 * startsWith("/") check but resolves to an external origin.
 */
export function safeInternalPath(candidate: string | undefined | null, fallback = "/dashboard"): string {
  if (!candidate) return fallback;
  return /^\/(?![/\\])/.test(candidate) ? candidate : fallback;
}
