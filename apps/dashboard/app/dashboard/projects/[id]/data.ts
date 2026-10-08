import { notFound } from "next/navigation";
import {
  getGitHubConnection,
  getProject,
  getScan,
  listDeployments,
  listScans,
  listSlices,
  type BuildSlice,
  type Deployment,
  type Project,
  type Scan,
  type ScanDetail,
} from "../../../../lib/api";
import { buildLifecycle, type Stage } from "../../../../lib/lifecycle";

export interface ProjectData {
  project: Project;
  /** Scans of the project's repository, newest first. */
  scans: Scan[];
  latest: ScanDetail | null;
  scanning: Scan | null;
  slices: BuildSlice[];
  /** Null when deployments can't be read (no GitHub connection, not a GitHub repo). */
  deployments: Deployment[] | null;
  deploymentsError: string | null;
  githubConnected: boolean;
  stages: Stage[];
}

const isGitHub = (path: string | null) => Boolean(path && /^https?:\/\/(www\.)?github\.com\//i.test(path));

export async function loadProject(id: string): Promise<ProjectData> {
  let project: Project;
  try {
    project = await getProject(id);
  } catch {
    notFound();
  }

  const [allScans, slices, connection] = await Promise.all([
    project.repoPath ? listScans().catch(() => [] as Scan[]) : Promise.resolve([] as Scan[]),
    listSlices(id).catch(() => [] as BuildSlice[]),
    getGitHubConnection().catch(() => null),
  ]);
  const scans = allScans.filter((s) => s.path === project.repoPath);
  const completed = scans.find((s) => s.status === "completed");
  const scanning = scans.find((s) => s.status === "queued" || s.status === "active") ?? null;

  const [latest, { deployments, deploymentsError }] = await Promise.all([
    completed ? getScan(completed.id).catch(() => null) : Promise.resolve(null),
    connection?.connected && isGitHub(project.repoPath)
      ? listDeployments(project.repoPath!).then(
          (d) => ({ deployments: d as Deployment[] | null, deploymentsError: null as string | null }),
          (err) => ({
            deployments: null,
            deploymentsError: err instanceof Error ? err.message : "Could not read deployments",
          })
        )
      : Promise.resolve({ deployments: null, deploymentsError: null }),
  ]);

  return {
    project,
    scans,
    latest,
    scanning,
    slices,
    deployments,
    deploymentsError,
    githubConnected: Boolean(connection?.connected),
    stages: buildLifecycle(project, latest, scanning, { slices, deployments: deployments ?? undefined }),
  };
}
