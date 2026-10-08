import { NextResponse } from "next/server";
import { markAllNotificationsRead } from "../../../../lib/api";
import { getCurrentUser } from "../../../../lib/get-current-user";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await markAllNotificationsRead();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to mark all read";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
