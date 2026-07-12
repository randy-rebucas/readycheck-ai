import { NextRequest, NextResponse } from "next/server";
import { markNotificationRead } from "../../../../lib/api";
import { getCurrentUser } from "../../../../lib/get-current-user";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }
  const id = (body as { id?: unknown }).id;
  if (typeof id !== "string") {
    return NextResponse.json({ error: "Expected { id: string }" }, { status: 400 });
  }

  try {
    await markNotificationRead(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to mark notification read";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
