import { NextResponse } from "next/server";
import { cancelScan } from "../../../../../lib/api";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const result = await cancelScan(id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel scan";
    const status = err instanceof Error && message.includes("404") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
