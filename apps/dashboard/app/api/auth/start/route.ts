import { NextRequest, NextResponse } from "next/server";
import { LOGIN_NONCE_COOKIE, safeInternalPath } from "../../../../lib/session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PROVIDERS = new Set(["github", "google"]);

// Entry point for "Continue with GitHub/Google". Sets a nonce cookie on our
// origin before bouncing to the API's OAuth kickoff; /api/auth/callback then
// requires the nonce in its URL to match the cookie. That binds the whole
// flow to this browser -- without it, an attacker could complete an OAuth
// dance themselves and trick a victim's browser into finishing it (login
// CSRF / session fixation: the victim gets silently signed in as the
// attacker).
export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider") ?? "";
  if (!PROVIDERS.has(provider)) {
    return NextResponse.json({ error: `Unknown provider '${provider}'.` }, { status: 400 });
  }

  const next = safeInternalPath(request.nextUrl.searchParams.get("next"));
  const nonce = crypto.randomUUID();

  const dashboardOrigin = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? request.nextUrl.origin;
  const callbackUrl = new URL("/api/auth/callback", dashboardOrigin);
  callbackUrl.searchParams.set("next", next);
  callbackUrl.searchParams.set("n", nonce);

  const startUrl = new URL(`/auth/${provider}`, API_URL);
  startUrl.searchParams.set("redirect_uri", callbackUrl.toString());

  const response = NextResponse.redirect(startUrl);
  response.cookies.set(LOGIN_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 600,
  });
  return response;
}
