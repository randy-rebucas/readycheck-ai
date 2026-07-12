"use server";

import { redirect } from "next/navigation";
import { triggerScan } from "../lib/api";

export async function triggerScanAction(formData: FormData) {
  const path = String(formData.get("path") ?? "").trim();
  if (!path) return;

  const { scanId } = await triggerScan(path);
  redirect(`/scans/${scanId}`);
}
