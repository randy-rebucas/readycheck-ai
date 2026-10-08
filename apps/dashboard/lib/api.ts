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
}

export interface ScanDetail extends Scan {
  facts: Record<string, unknown> | null;
  aiNarrative: string | null;
  progress?: string | null;
  issues: Issue[];
  categoryScores: CategoryScore[];
}

export async function listScans(): Promise<Scan[]> {
  return requestJson("/scans");
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
