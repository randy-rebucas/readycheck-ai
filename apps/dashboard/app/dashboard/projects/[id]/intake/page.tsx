import { notFound } from "next/navigation";
import { getProject } from "../../../../../lib/api";
import { getMode } from "../../../../../lib/get-mode";
import IntakeClient from "./IntakeClient";

export const metadata = {
  title: "Intake — ReadyCheck AI",
};

export default async function IntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  let project;
  try {
    project = await getProject(id);
  } catch {
    notFound();
  }
  return <IntakeClient project={project} mode={await getMode()} startAt={q} />;
}
