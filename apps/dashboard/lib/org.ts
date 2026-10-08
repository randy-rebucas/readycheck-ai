/**
 * The org the dashboard is acting in. Just a hint: the API re-checks it
 * against the user's memberships on every request, so a tampered cookie can
 * only produce a 403, never another org's data.
 */
export const ORG_COOKIE = "rc_org";

export function orgCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}
