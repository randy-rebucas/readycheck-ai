import { NextRequest, NextResponse } from "next/server";
import { getPreferences, savePreferences } from "../../../lib/api";
import { getCurrentUser } from "../../../lib/get-current-user";

// Proxies to the API with the caller's own session -- the API only ever
// touches that user's preferences.

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await getPreferences());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load preferences";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  try {
    // The API sanitizes the body down to the known preference keys.
    return NextResponse.json(await savePreferences(body as never));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save preferences";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
