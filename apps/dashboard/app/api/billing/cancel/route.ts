import { NextResponse } from "next/server";
import { cancelSubscription } from "../../../../lib/api";
import { getCurrentUser } from "../../../../lib/get-current-user";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await cancelSubscription(user.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel subscription";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
