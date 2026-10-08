"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  askAssistant,
  createFix,
  listScanFixes,
  retryFix,
  setTriage,
  type FixRequest,
  type Triage,
} from "../../../lib/api";
import { getCurrentUser } from "../../../lib/get-current-user";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

async function attempt<T>(fn: () => Promise<T>, fallback: string): Promise<Result<T>> {
  if (!(await getCurrentUser())) redirect("/login?next=/dashboard");
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : fallback };
  }
}

export async function createFixAction(scanId: string, ruleIds: string[]): Promise<Result<FixRequest>> {
  const result = await attempt(() => createFix(scanId, ruleIds), "Could not start the fix");
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}

/** Polled by the fix panel while a fix is being written. */
export async function scanFixesAction(scanId: string): Promise<Result<FixRequest[]>> {
  return attempt(() => listScanFixes(scanId), "Could not load fixes");
}

export async function retryFixAction(id: string): Promise<Result<FixRequest>> {
  return attempt(() => retryFix(id), "Could not retry the fix");
}

export async function askAction(scanId: string, issueId: string, question: string): Promise<Result<string>> {
  return attempt(async () => (await askAssistant(scanId, issueId, question)).answer, "The assistant didn't answer");
}

export async function triageAction(input: {
  repoPath: string;
  ruleId: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  dismissed?: boolean;
  reason?: string;
}): Promise<Result<Triage>> {
  const result = await attempt(() => setTriage(input), "Could not save");
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}
