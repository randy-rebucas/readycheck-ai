import { notFound } from "next/navigation";
import { getScan } from "../../../lib/api";
import { getCurrentUser } from "../../../lib/get-current-user";
import ScanDetailClient from "./ScanDetailClient";

export default async function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let scan;
  try {
    scan = await getScan(id);
  } catch {
    notFound();
  }

  // Guaranteed by middleware.ts (which gates /scans/*).
  const user = await getCurrentUser();

  return <ScanDetailClient initialScan={scan} user={user} />;
}
