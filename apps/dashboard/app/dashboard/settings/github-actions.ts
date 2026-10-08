"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectGitHub, disconnectGitHub, type GitHubConnection } from "../../../lib/api";
import { getCurrentUser } from "../../../lib/get-current-user";

export async function connectGitHubAction(
  token: string
): Promise<{ ok: true; value: GitHubConnection } | { ok: false; error: string }> {
  if (!(await getCurrentUser())) redirect("/login?next=/dashboard/settings");
  try {
    const value = await connectGitHub(token);
    revalidatePath("/dashboard", "layout");
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not connect GitHub" };
  }
}

export async function disconnectGitHubAction(): Promise<{ ok: boolean; error?: string }> {
  if (!(await getCurrentUser())) redirect("/login?next=/dashboard/settings");
  try {
    await disconnectGitHub();
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not disconnect GitHub" };
  }
}
