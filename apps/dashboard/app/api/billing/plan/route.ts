import { NextResponse } from "next/server";
import { getBillingPlan } from "../../../../lib/api";
import { getCurrentUser } from "../../../../lib/get-current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await getBillingPlan(user.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load billing plan";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
