import { NextResponse } from "next/server";
import { listNotifications } from "../../../lib/api";
import { getCurrentUser } from "../../../lib/get-current-user";

// Proxies to the API with the caller's own session; the API scopes results
// to their current org.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await listNotifications());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load notifications";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
