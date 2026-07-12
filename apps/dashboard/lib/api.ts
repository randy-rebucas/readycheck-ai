const API_URL = process.env.READYCHECK_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
  const res = await fetch(`${API_URL}/scans`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list scans: ${res.status}`);
  return res.json();
}

export async function getScan(id: string): Promise<ScanDetail> {
  const res = await fetch(`${API_URL}/scans/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load scan ${id}: ${res.status}`);
  return res.json();
}

export async function triggerScan(path: string): Promise<{ scanId: string; status: string }> {
  const res = await fetch(`${API_URL}/scans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to trigger scan: ${res.status}`);
  return res.json();
}
