const API_URL = process.env.READYCHECK_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Server-only. Never exposed to the browser -- all fetches in this file run
// in Server Components / Server Actions, not client code.
const API_KEY = process.env.READYCHECK_API_KEY;

function authHeaders(): HeadersInit {
  return API_KEY ? { "x-api-key": API_KEY } : {};
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

export async function listScans(userId: string): Promise<Scan[]> {
  const res = await fetch(`${API_URL}/scans?userId=${encodeURIComponent(userId)}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to list scans: ${res.status}`);
  return res.json();
}

export async function getScan(id: string): Promise<ScanDetail> {
  const res = await fetch(`${API_URL}/scans/${id}`, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to load scan ${id}: ${res.status}`);
  return res.json();
}

export async function fetchReport(id: string, format: string, userId: string): Promise<Response> {
  const res = await fetch(
    `${API_URL}/scans/${id}/report?format=${format}&userId=${encodeURIComponent(userId)}`,
    { cache: "no-store", headers: authHeaders() }
  );
  if (!res.ok) throw new Error(`Failed to fetch report: ${res.status}`);
  return res;
}

export interface UserPreferences {
  scanComplete: boolean;
  weeklyDigest: boolean;
  productUpdates: boolean;
}

export async function getPreferences(userId: string): Promise<UserPreferences> {
  const res = await fetch(`${API_URL}/users/${userId}/preferences`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to load preferences: ${res.status}`);
  return res.json();
}

export async function savePreferences(
  userId: string,
  prefs: UserPreferences
): Promise<UserPreferences> {
  const res = await fetch(`${API_URL}/users/${userId}/preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(prefs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to save preferences: ${res.status}`);
  return res.json();
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

export async function listNotifications(userId: string): Promise<NotificationsPage> {
  const res = await fetch(`${API_URL}/notifications?userId=${encodeURIComponent(userId)}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to load notifications: ${res.status}`);
  return res.json();
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/notifications/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ userId, id }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to mark notification read: ${res.status}`);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const res = await fetch(`${API_URL}/notifications/read-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ userId }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to mark all notifications read: ${res.status}`);
}

export async function triggerScan(
  path: string,
  userId: string
): Promise<{ scanId: string; status: string }> {
  const res = await fetch(`${API_URL}/scans`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ path, userId }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Failed to trigger scan: ${res.status}`);
  }
  return res.json();
}

export async function cancelScan(id: string): Promise<{ scanId: string; status: string }> {
  const res = await fetch(`${API_URL}/scans/${id}/cancel`, {
    method: "POST",
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to cancel scan: ${res.status}`);
  return res.json();
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

export async function getBillingPlan(userId: string): Promise<PlanSummary> {
  const res = await fetch(`${API_URL}/billing/plan?userId=${encodeURIComponent(userId)}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to load billing plan: ${res.status}`);
  return res.json();
}

export async function confirmSubscription(
  userId: string,
  paypalSubscriptionId: string
): Promise<PlanSummary> {
  const res = await fetch(`${API_URL}/billing/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ userId, paypalSubscriptionId }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to confirm subscription: ${res.status}`);
  return res.json();
}

export async function cancelSubscription(userId: string): Promise<PlanSummary> {
  const res = await fetch(`${API_URL}/billing/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ userId }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to cancel subscription: ${res.status}`);
  return res.json();
}
