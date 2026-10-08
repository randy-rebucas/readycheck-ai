import { NextResponse } from "next/server";
import { cancelScan, errorResponse } from "../../../../../lib/api";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const result = await cancelScan(id);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "Failed to cancel scan");
  }
}
