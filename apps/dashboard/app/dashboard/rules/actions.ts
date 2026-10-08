"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setRuleEnabled } from "../../../lib/api";
import { getCurrentUser } from "../../../lib/get-current-user";

export async function toggleRuleAction(id: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!(await getCurrentUser())) redirect("/login?next=/dashboard/rules");
  try {
    await setRuleEnabled(id, enabled);
    revalidatePath("/dashboard/rules");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not change the rule" };
  }
}
