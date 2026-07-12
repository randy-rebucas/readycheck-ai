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
  status: "queued" | "active" | "completed" | "failed";
  overallScore: number | null;
  verdict: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ScanDetail extends Scan {
  facts: Record<string, unknown> | null;
  aiNarrative: string | null;
  issues: Issue[];
  categoryScores: CategoryScore[];
}

export async function listScans(): Promise<Scan[]> {
  const res = await fetch(`${API_URL}/scans`, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to list scans: ${res.status}`);
  return res.json();
}

export async function getScan(id: string): Promise<ScanDetail> {
  const res = await fetch(`${API_URL}/scans/${id}`, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to load scan ${id}: ${res.status}`);
  return res.json();
}

export async function fetchReport(id: string, format: string): Promise<Response> {
  const res = await fetch(`${API_URL}/scans/${id}/report?format=${format}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch report: ${res.status}`);
  return res;
}

export async function triggerScan(path: string): Promise<{ scanId: string; status: string }> {
  const res = await fetch(`${API_URL}/scans`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ path }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to trigger scan: ${res.status}`);
  return res.json();
}
