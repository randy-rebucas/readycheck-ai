import { notFound } from "next/navigation";
import { getScan } from "../../../lib/api";
import ScanDetailClient from "./ScanDetailClient";

export default async function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let scan;
  try {
    scan = await getScan(id);
  } catch {
    notFound();
  }

  return <ScanDetailClient initialScan={scan} />;
}
