export interface ReportIssue {
  ruleId: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  recommendation: string;
  estimatedEffort: string;
}

export interface ReportCategoryScore {
  category: string;
  score: number;
}

export interface ReportInput {
  id: string;
  path: string;
  sourceType: string;
  status: string;
  overallScore: number | null;
  verdict: string | null;
  aiNarrative: string | null;
  errorMessage: string | null;
  createdAt: Date | string;
  completedAt: Date | string | null;
  issues: ReportIssue[];
  categoryScores: ReportCategoryScore[];
}
