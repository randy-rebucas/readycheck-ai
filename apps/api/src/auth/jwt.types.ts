export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * "transfer" tokens are the short-lived (60s) tokens handed to the browser in
 * the OAuth callback redirect; the dashboard exchanges one for a real session
 * cookie. "session" tokens are the long-lived cookie value. The purpose claim
 * keeps one from ever being accepted where the other is expected.
 */
export type TokenPurpose = "session" | "transfer";

export interface JwtPayload {
  sub: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  purpose: TokenPurpose;
}
