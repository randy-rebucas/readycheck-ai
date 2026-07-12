import { NextRequest, NextResponse } from "next/server";
import {
  LOGIN_NONCE_COOKIE,
  SESSION_COOKIE,
  safeInternalPath,
  sessionCookieOptions,
  signSessionToken,
  verifyTransferToken,
} from "../../../../lib/session";

// apps/api's OAuth callback redirects the browser here with a short-lived
// transfer token (?token=). We require the nonce planted by /api/auth/start
// (proves this browser initiated the flow -- blocks login CSRF), verify the
// transfer token, and only then mint the long-lived session cookie. The
// session itself never appears in a URL.
export async function GET(request: NextRequest) {
  const failure = (reason: string) => {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", reason);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete({ name: LOGIN_NONCE_COOKIE, path: "/api/auth" });
    return res;
  };

  const nonce = request.nextUrl.searchParams.get("n");
  const expectedNonce = request.cookies.get(LOGIN_NONCE_COOKIE)?.value;
  if (!nonce || !expectedNonce || nonce !== expectedNonce) {
    return failure("invalid_state");
  }

  const token = request.nextUrl.searchParams.get("token");
  const user = token ? await verifyTransferToken(token) : null;
  if (!user) {
    return failure("invalid_session");
  }

  const next = safeInternalPath(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.delete({ name: LOGIN_NONCE_COOKIE, path: "/api/auth" });
  response.cookies.set(SESSION_COOKIE, await signSessionToken(user), sessionCookieOptions());
  return response;
}
