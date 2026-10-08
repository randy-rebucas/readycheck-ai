import { NextResponse } from "next/server";
import { cancelSubscription, errorResponse } from "../../../../lib/api";
import { getCurrentUser } from "../../../../lib/get-current-user";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await cancelSubscription());
  } catch (err) {
    return errorResponse(err, "Failed to cancel subscription");
  }
}
