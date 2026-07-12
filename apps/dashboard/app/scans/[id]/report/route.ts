import { NextRequest, NextResponse } from "next/server";
import { fetchReport } from "../../../../lib/api";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "markdown";

  let upstream: Response;
  try {
    upstream = await fetchReport(id, format);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch report";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const body = await upstream.text();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "text/plain",
      "Content-Disposition": upstream.headers.get("content-disposition") ?? "attachment",
    },
  });
}
