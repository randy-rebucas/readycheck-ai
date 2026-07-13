import { notFound } from "next/navigation";
import { getBillingPlan, getScan } from "../../../../lib/api";
import { getCurrentUser } from "../../../../lib/get-current-user";
import ScanDetailClient from "./ScanDetailClient";

export default async function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let scan;
  try {
    scan = await getScan(id);
  } catch {
    notFound();
  }

  // Guaranteed by middleware.ts (which gates /dashboard/*).
  const user = await getCurrentUser();
  const plan = user ? (await getBillingPlan(user.id).catch(() => null))?.plan ?? "FREE" : "FREE";

  return <ScanDetailClient initialScan={scan} user={user} plan={plan} />;
}
