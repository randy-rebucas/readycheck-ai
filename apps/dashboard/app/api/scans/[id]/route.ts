import { NextRequest, NextResponse } from "next/server";
import { getScan } from "../../../../lib/api";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const scan = await getScan(id);
    return NextResponse.json(scan);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load scan";
    const status = err instanceof Error && message.includes("404") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
