import { NextRequest, NextResponse } from "next/server";
import { createOrg, errorResponse, listOrgs } from "../../../lib/api";
import { getCurrentUser } from "../../../lib/get-current-user";
import { ORG_COOKIE, orgCookieOptions } from "../../../lib/org";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await listOrgs());
  } catch (err) {
    return errorResponse(err, "Failed to load organizations");
  }
}

/** Creates a team org and switches to it. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";

  try {
    const org = await createOrg(name);
    const res = NextResponse.json(org, { status: 201 });
    res.cookies.set(ORG_COOKIE, org.id, orgCookieOptions());
    return res;
  } catch (err) {
    return errorResponse(err, "Failed to create organization");
  }
}
