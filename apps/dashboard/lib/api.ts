import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ORG_COOKIE } from "./org";
import { SESSION_COOKIE } from "./session";

const API_URL = process.env.READYCHECK_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Server-only. Never exposed to the browser -- all fetches in this file run
// in Server Components / Server Actions / Route Handlers, not client code.
const API_KEY = process.env.READYCHECK_API_KEY;

/**
 * Every API call carries the caller's own session token (the API derives
 * identity from it -- never from a user id we pass) and, if one is selected,
 * the active org (which the API checks against the user's memberships).
 */
async function authHeaders(): Promise<Record<string, string>> {
  const store = await cookies();
  const headers: Record<string, string> = {};
  if (API_KEY) headers["x-api-key"] = API_KEY;
  const session = store.get(SESSION_COOKIE)?.value;
  if (session) headers.authorization = `Bearer ${session}`;
  const orgId = store.get(ORG_COOKIE)?.value;
  if (orgId) headers["x-org-id"] = orgId;
  return headers;
}

/** An API error that keeps the upstream status so route handlers can pass 4xx through. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const NOT_A_MEMBER = "You are not a member of this organization.";

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = { ...(await authHeaders()), ...(init.headers as Record<string, string> | undefined) };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  let res = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });

  // A stale org cookie (the user left or was removed from that org) would
  // otherwise 403 every page. Fall back to the personal workspace; the org
  // switcher then shows that as current and the next switch rewrites the cookie.
  if (res.status === 403 && headers["x-org-id"]) {
    const body = await res.clone().json().catch(() => null);
    if (body?.message === NOT_A_MEMBER) {
      delete headers["x-org-id"];
      res = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message : `API request failed: ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return res;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  return (await request(path, init)).json();
}

/** Route-handler helper: 4xx from the API passes through; anything else is a 502. */
export function errorResponse(err: unknown, fallback: string): NextResponse {
  if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : fallback;
  return NextResponse.json({ error: message }, { status: 502 });
}

export interface CategoryScore {
  id: string;
  category: string;
  score: number;
}

export interface Issue {
  id: string;
  ruleId: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  recommendation: string;
  estimatedEffort: string;
}

export type IssueCounts = Record<Issue["severity"], number>;

export interface RepoFacts {
  languages?: string[];
  frameworks?: string[];
  packageManager?: string;
}

export interface Scan {
  id: string;
  path: string;
  sourceType: "local" | "git";
  status: "queued" | "active" | "completed" | "failed" | "cancelled";
  overallScore: number | null;
  verdict: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  facts?: RepoFacts | null;
  /** Present on list responses only. */
  issueCounts?: IssueCounts;
}

export interface ScanDetail extends Scan {
  facts: RepoFacts | null;
  aiNarrative: string | null;
  progress?: string | null;
  issues: Issue[];
  categoryScores: CategoryScore[];
}

export async function listScans(limit = 100): Promise<Scan[]> {
  return requestJson(`/scans?limit=${limit}`);
}

export async function getScan(id: string): Promise<ScanDetail> {
  return requestJson(`/scans/${encodeURIComponent(id)}`);
}

export async function fetchReport(id: string, format: string): Promise<Response> {
  return request(`/scans/${encodeURIComponent(id)}/report?format=${encodeURIComponent(format)}`);
}

export interface UserPreferences {
  scanComplete: boolean;
  weeklyDigest: boolean;
  productUpdates: boolean;
}

export async function getPreferences(): Promise<UserPreferences> {
  return requestJson("/users/me/preferences");
}

export async function savePreferences(prefs: UserPreferences): Promise<UserPreferences> {
  return requestJson("/users/me/preferences", { method: "PUT", body: JSON.stringify(prefs) });
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  scanId: string | null;
  createdAt: string;
  read: boolean;
}

export interface NotificationsPage {
  notifications: Notification[];
  unreadCount: number;
}

export async function listNotifications(): Promise<NotificationsPage> {
  return requestJson("/notifications");
}

export async function markNotificationRead(id: string): Promise<void> {
  await request("/notifications/read", { method: "POST", body: JSON.stringify({ id }) });
}

export async function markAllNotificationsRead(): Promise<void> {
  await request("/notifications/read-all", { method: "POST" });
}

export async function triggerScan(path: string): Promise<{ scanId: string; status: string }> {
  return requestJson("/scans", { method: "POST", body: JSON.stringify({ path }) });
}

export async function cancelScan(id: string): Promise<{ scanId: string; status: string }> {
  return requestJson(`/scans/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}

export interface PlanSummary {
  plan: "FREE" | "PRO" | "ENTERPRISE";
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  usage: {
    repositories: number;
    repositoryLimit: number;
  };
}

export async function getBillingPlan(): Promise<PlanSummary> {
  return requestJson("/billing/plan");
}

export async function confirmSubscription(paypalSubscriptionId: string): Promise<PlanSummary> {
  return requestJson("/billing/subscribe", {
    method: "POST",
    body: JSON.stringify({ paypalSubscriptionId }),
  });
}

export async function cancelSubscription(): Promise<PlanSummary> {
  return requestJson("/billing/cancel", { method: "POST" });
}

export type OrgRole = "owner" | "admin" | "member";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  personal: boolean;
  role: OrgRole;
}

export interface OrgMember {
  userId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  role: OrgRole;
  joinedAt: string;
}

export async function listOrgs(): Promise<{ currentOrgId: string; orgs: OrgSummary[] }> {
  return requestJson("/orgs");
}

export async function createOrg(name: string): Promise<OrgSummary> {
  return requestJson("/orgs", { method: "POST", body: JSON.stringify({ name }) });
}

export async function listMembers(): Promise<OrgMember[]> {
  return requestJson("/orgs/current/members");
}

export async function addMember(email: string, role: OrgRole): Promise<OrgMember> {
  return requestJson("/orgs/current/members", {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export async function changeMemberRole(userId: string, role: OrgRole): Promise<void> {
  await request(`/orgs/current/members/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function removeMember(userId: string): Promise<void> {
  await request(`/orgs/current/members/${encodeURIComponent(userId)}`, { method: "DELETE" });
}

/** An app being built here. Answers are keyed by intake question id (see lib/intake.ts). */
export interface Project {
  id: string;
  name: string;
  answers: Record<string, string | string[]>;
  /** Hand-completed lifecycle stages, keyed by stage id. */
  signoffs: Record<string, { at: string; by: string | null }>;
  repoPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SignoffStage = "plan" | "design" | "build" | "uat" | "deploy";

export async function listProjects(): Promise<Project[]> {
  return requestJson("/projects");
}

export async function getProject(id: string): Promise<Project> {
  return requestJson(`/projects/${encodeURIComponent(id)}`);
}

export async function createProject(name: string): Promise<Project> {
  return requestJson("/projects", { method: "POST", body: JSON.stringify({ name }) });
}

export async function updateProject(
  id: string,
  patch: { name?: string; answers?: Project["answers"]; repoPath?: string | null }
): Promise<Project> {
  return requestJson(`/projects/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function setSignoff(id: string, stage: SignoffStage, done: boolean): Promise<Project> {
  return requestJson(`/projects/${encodeURIComponent(id)}/signoffs`, {
    method: "POST",
    body: JSON.stringify({ stage, done }),
  });
}

// ---------- GitHub ----------

export interface GitHubConnection {
  connected: boolean;
  login: string | null;
  connectedAt: string | null;
}

export async function getGitHubConnection(): Promise<GitHubConnection> {
  return requestJson("/github/connection");
}

export async function connectGitHub(token: string): Promise<GitHubConnection> {
  return requestJson("/github/connection", { method: "PUT", body: JSON.stringify({ token }) });
}

export async function disconnectGitHub(): Promise<void> {
  await request("/github/connection", { method: "DELETE" });
}

export interface Deployment {
  id: number;
  environment: string;
  ref: string;
  sha: string;
  createdAt: string;
  creator: string | null;
  state: string | null;
  url: string | null;
}

export async function listDeployments(repoPath: string): Promise<Deployment[]> {
  return requestJson(`/github/deployments?repoPath=${encodeURIComponent(repoPath)}`);
}

// ---------- Rule packs ----------

export interface FixInfo {
  kind: "template" | "ai" | "guided";
  confidence: "high" | "review" | null;
  plan: string[];
  caveat?: string;
}

export interface CatalogRule {
  id: string;
  pack: string;
  category: string;
  description: string;
  severity: Issue["severity"];
  standards: string[];
  fix: FixInfo;
  enabled: boolean;
}

export interface RulesCatalog {
  packs: { id: string; name: string; description: string }[];
  rules: CatalogRule[];
}

export async function getRules(): Promise<RulesCatalog> {
  return requestJson("/rules");
}

export async function setRuleEnabled(id: string, enabled: boolean): Promise<void> {
  await request(`/rules/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ enabled }) });
}

// ---------- Triage, fixes, assistant ----------

export interface Triage {
  repoPath: string;
  ruleId: string;
  assigneeId: string | null;
  dueDate: string | null;
  dismissedAt: string | null;
  dismissReason: string | null;
}

export async function listTriage(repoPath?: string): Promise<Triage[]> {
  return requestJson(`/triage${repoPath ? `?repoPath=${encodeURIComponent(repoPath)}` : ""}`);
}

export async function setTriage(input: {
  repoPath: string;
  ruleId: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  dismissed?: boolean;
  reason?: string;
}): Promise<Triage> {
  return requestJson("/triage", { method: "PUT", body: JSON.stringify(input) });
}

export interface ChecksSummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  runs: { name: string; status: string; conclusion: string | null }[];
}

export interface PullStatus {
  state: "open" | "merged" | "closed";
  mergedAt: string | null;
  checks: ChecksSummary | null;
}

export interface FixRequest {
  id: string;
  scanId: string;
  repoPath: string;
  ruleIds: string[];
  /** queued | working | opened | merged | closed | failed */
  status: string;
  branch: string | null;
  prNumber: number | null;
  prUrl: string | null;
  summary: string | null;
  diff: string | null;
  verification: { resolved: string[]; stillOpen: string[]; introduced: string[] } | null;
  error: string | null;
  createdAt: string;
  pull: PullStatus | null;
}

export async function listScanFixes(scanId: string): Promise<FixRequest[]> {
  return requestJson(`/scans/${encodeURIComponent(scanId)}/fixes`);
}

export async function listFixes(): Promise<FixRequest[]> {
  return requestJson("/fixes");
}

export async function createFix(scanId: string, ruleIds: string[]): Promise<FixRequest> {
  return requestJson(`/scans/${encodeURIComponent(scanId)}/fixes`, {
    method: "POST",
    body: JSON.stringify({ ruleIds }),
  });
}

export async function retryFix(id: string): Promise<FixRequest> {
  return requestJson(`/fixes/${encodeURIComponent(id)}/retry`, { method: "POST" });
}

export async function askAssistant(scanId: string, issueId: string, question: string): Promise<{ answer: string }> {
  return requestJson(`/scans/${encodeURIComponent(scanId)}/issues/${encodeURIComponent(issueId)}/ask`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

// ---------- Build slices ----------

export interface BuildSlice {
  id: string;
  position: number;
  title: string;
  stories: string[];
  /** planned | queued | generating | review | merged | closed | failed */
  status: string;
  branch: string | null;
  prNumber: number | null;
  prUrl: string | null;
  summary: string | null;
  testsAdded: number | null;
  issuesFound: { ruleId: string; severity: string; message: string }[] | null;
  error: string | null;
  mergedAt: string | null;
  pull: PullStatus | null;
}

export async function listSlices(projectId: string): Promise<BuildSlice[]> {
  return requestJson(`/projects/${encodeURIComponent(projectId)}/slices`);
}

export async function planSlices(
  projectId: string,
  slices: { title: string; stories: string[] }[],
  spec: string
): Promise<BuildSlice[]> {
  return requestJson(`/projects/${encodeURIComponent(projectId)}/slices`, {
    method: "POST",
    body: JSON.stringify({ slices, spec }),
  });
}

export async function startSlices(projectId: string): Promise<BuildSlice[]> {
  return requestJson(`/projects/${encodeURIComponent(projectId)}/slices/start`, { method: "POST" });
}

export async function retrySlice(projectId: string, sliceId: string): Promise<BuildSlice[]> {
  return requestJson(
    `/projects/${encodeURIComponent(projectId)}/slices/${encodeURIComponent(sliceId)}/retry`,
    { method: "POST" }
  );
}
