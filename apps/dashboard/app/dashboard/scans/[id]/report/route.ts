import { NextRequest, NextResponse } from "next/server";
import { fetchReport } from "../../../../../lib/api";
import { getCurrentUser } from "../../../../../lib/get-current-user";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "markdown";

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetchReport(id, format, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch report";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // arrayBuffer, not text() -- pdf is binary and .text() would mangle it.
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "text/plain",
      "Content-Disposition": upstream.headers.get("content-disposition") ?? "attachment",
    },
  });
}
