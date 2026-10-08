import { NextRequest, NextResponse } from "next/server";
import { errorResponse, listOrgs } from "../../../../lib/api";
import { getCurrentUser } from "../../../../lib/get-current-user";
import { ORG_COOKIE, orgCookieOptions } from "../../../../lib/org";

/**
 * Sets the active org. Checked against the user's memberships here for a
 * clean 403, though the API would reject a non-member org id on its own too.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const orgId = typeof body?.orgId === "string" ? body.orgId : "";

  try {
    const { orgs } = await listOrgs();
    const target = orgs.find((o) => o.id === orgId);
    if (!target) {
      return NextResponse.json({ error: "You are not a member of that organization." }, { status: 403 });
    }

    const res = NextResponse.json({ ok: true });
    // The personal workspace is the API's default, so no cookie is needed for it.
    if (target.personal) res.cookies.delete(ORG_COOKIE);
    else res.cookies.set(ORG_COOKIE, target.id, orgCookieOptions());
    return res;
  } catch (err) {
    return errorResponse(err, "Failed to switch organization");
  }
}
