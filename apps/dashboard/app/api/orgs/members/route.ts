import { NextRequest, NextResponse } from "next/server";
import { addMember, errorResponse, listMembers, type OrgRole } from "../../../../lib/api";
import { getCurrentUser } from "../../../../lib/get-current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await listMembers());
  } catch (err) {
    return errorResponse(err, "Failed to load members");
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const role = (typeof body?.role === "string" ? body.role : "member") as OrgRole;

  try {
    return NextResponse.json(await addMember(email, role), { status: 201 });
  } catch (err) {
    return errorResponse(err, "Failed to add member");
  }
}
