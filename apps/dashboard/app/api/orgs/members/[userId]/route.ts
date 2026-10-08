import { NextRequest, NextResponse } from "next/server";
import { changeMemberRole, errorResponse, removeMember, type OrgRole } from "../../../../../lib/api";
import { getCurrentUser } from "../../../../../lib/get-current-user";
import { ORG_COOKIE } from "../../../../../lib/org";

type Params = { params: Promise<{ userId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const body = await request.json().catch(() => null);
  const role = (typeof body?.role === "string" ? body.role : "") as OrgRole;

  try {
    await changeMemberRole(userId, role);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "Failed to change role");
  }
}

/** Removing yourself means leaving the org, so drop back to the personal workspace. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  try {
    await removeMember(userId);
    const res = NextResponse.json({ ok: true });
    if (userId === user.id) res.cookies.delete(ORG_COOKIE);
    return res;
  } catch (err) {
    return errorResponse(err, "Failed to remove member");
  }
}
