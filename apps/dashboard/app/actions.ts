"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "../lib/get-current-user";
import { triggerScan } from "../lib/api";

export async function triggerScanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const path = String(formData.get("path") ?? "").trim();
  if (!path) return;

  let scanId: string;
  try {
    ({ scanId } = await triggerScan(path));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to trigger scan";
    redirect(`/dashboard?scanError=${encodeURIComponent(message)}`);
  }
  redirect(`/dashboard/scans/${scanId}`);
}
