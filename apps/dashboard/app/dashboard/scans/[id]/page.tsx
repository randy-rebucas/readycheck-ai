import { notFound } from "next/navigation";
import {
  getBillingPlan,
  getGitHubConnection,
  getRules,
  getScan,
  listProjects,
  listScanFixes,
  listScans,
  listTriage,
  type FixInfo,
} from "../../../../lib/api";
import ScanDetailClient from "./ScanDetailClient";

export default async function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let scan;
  try {
    scan = await getScan(id);
  } catch {
    notFound();
  }

  const [plan, scans, projects, rules, triage, fixRequests, github] = await Promise.all([
    getBillingPlan()
      .then((p) => p.plan)
      .catch(() => "FREE" as const),
    listScans().catch(() => []),
    listProjects().catch(() => []),
    getRules().catch(() => null),
    listTriage(scan.path).catch(() => []),
    listScanFixes(scan.id).catch(() => []),
    getGitHubConnection().catch(() => null),
  ]);
  const history = scans.filter((s) => s.path === scan.path);

  const projectId = projects.find((p) => p.repoPath === scan.path)?.id ?? null;

  const fixes: Record<string, FixInfo> = Object.fromEntries((rules?.rules ?? []).map((r) => [r.id, r.fix]));
  const dismissed = Object.fromEntries(
    triage.filter((t) => t.dismissedAt).map((t) => [t.ruleId, t.dismissReason ?? ""])
  );
  const fixing = fixRequests
    .filter((f) => ["queued", "working", "opened"].includes(f.status))
    .flatMap((f) => f.ruleIds);
  const canAutoFix = Boolean(github?.connected) && /^https?:\/\/(www\.)?github\.com\//i.test(scan.path);

  return (
    <ScanDetailClient
      initialScan={scan}
      plan={plan}
      history={history}
      projectId={projectId}
      fixes={fixes}
      dismissed={dismissed}
      fixing={fixing}
      canAutoFix={canAutoFix}
    />
  );
}
