import { NextRequest, NextResponse } from "next/server";
import { getScan, errorResponse } from "../../../../lib/api";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const scan = await getScan(id);
    return NextResponse.json(scan);
  } catch (err) {
    return errorResponse(err, "Failed to load scan");
  }
}
