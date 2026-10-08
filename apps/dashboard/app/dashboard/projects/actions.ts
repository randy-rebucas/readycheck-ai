"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProject,
  getProject,
  planSlices,
  retrySlice,
  setSignoff,
  startSlices,
  triggerScan,
  updateProject,
  type Project,
  type SignoffStage,
} from "../../../lib/api";
import { getCurrentUser } from "../../../lib/get-current-user";
import { slicePlan, specText } from "../../../lib/intake";

const STAGES: SignoffStage[] = ["plan", "design", "build", "uat", "deploy"];

async function requireUser() {
  if (!(await getCurrentUser())) redirect("/login?next=/dashboard");
}

function message(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export async function createProjectAction(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  let project: Project;
  try {
    project = await createProject(name);
  } catch (err) {
    redirect(`/dashboard/projects/new?error=${encodeURIComponent(message(err, "Could not create the project"))}`);
  }
  redirect(`/dashboard/projects/${project.id}/intake`);
}

/** Called by the intake wizard on every change, so it returns instead of redirecting. */
export async function saveAnswersAction(
  id: string,
  answers: Project["answers"]
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  try {
    await updateProject(id, { answers });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err, "Could not save your answer") };
  }
}

export async function signoffAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const stage = String(formData.get("stage") ?? "") as SignoffStage;
  if (!STAGES.includes(stage)) return;
  const done = formData.get("done") !== "false";
  try {
    await setSignoff(id, stage, done);
  } catch (err) {
    redirect(`/dashboard/projects/${id}?error=${encodeURIComponent(message(err, "Could not save the sign-off"))}`);
  }
  revalidatePath(`/dashboard/projects/${id}`, "layout");
}

/** Links the project's repository and starts its first readiness check. */
export async function connectRepoAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const repoPath = String(formData.get("repoPath") ?? "").trim();
  try {
    await updateProject(id, { repoPath });
    await triggerScan(repoPath);
  } catch (err) {
    redirect(`/dashboard/projects/${id}?error=${encodeURIComponent(message(err, "Could not connect the repository"))}`);
  }
  revalidatePath(`/dashboard/projects/${id}`, "layout");
  redirect(`/dashboard/projects/${id}`);
}

export async function runCheckAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const repoPath = String(formData.get("repoPath") ?? "");
  try {
    await triggerScan(repoPath);
  } catch (err) {
    redirect(`/dashboard/projects/${id}?error=${encodeURIComponent(message(err, "Could not start the check"))}`);
  }
  revalidatePath(`/dashboard/projects/${id}`, "layout");
}

/** Plans one slice per first-release feature from the approved Blueprint. */
export async function planSlicesAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  try {
    const project = await getProject(id);
    const slices = slicePlan(project.answers);
    if (slices.length === 0) throw new Error("Pick first-release features in the intake before planning slices.");
    await planSlices(id, slices, specText(project.answers, project.name));
  } catch (err) {
    redirect(`/dashboard/projects/${id}?error=${encodeURIComponent(message(err, "Could not plan the slices"))}`);
  }
  revalidatePath(`/dashboard/projects/${id}`, "layout");
}

export async function startSlicesAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  try {
    await startSlices(id);
  } catch (err) {
    redirect(`/dashboard/projects/${id}?error=${encodeURIComponent(message(err, "Could not start the build"))}`);
  }
  revalidatePath(`/dashboard/projects/${id}`, "layout");
}

export async function retrySliceAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const sliceId = String(formData.get("sliceId") ?? "");
  try {
    await retrySlice(id, sliceId);
  } catch (err) {
    redirect(`/dashboard/projects/${id}?error=${encodeURIComponent(message(err, "Could not retry the slice"))}`);
  }
  revalidatePath(`/dashboard/projects/${id}`, "layout");
}
