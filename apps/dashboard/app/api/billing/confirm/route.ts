import { NextRequest, NextResponse } from "next/server";
import { confirmSubscription } from "../../../../lib/api";
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
  const subscriptionID = (body as { subscriptionID?: unknown }).subscriptionID;
  if (typeof subscriptionID !== "string") {
    return NextResponse.json({ error: "Expected { subscriptionID: string }" }, { status: 400 });
  }

  try {
    return NextResponse.json(await confirmSubscription(user.id, subscriptionID));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to confirm subscription";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
