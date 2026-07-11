import type { Issue, RuleCategory, Severity } from "@readycheck/rules";

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 40,
  high: 20,
  medium: 10,
  low: 4,
};

const DEFAULT_CATEGORY_WEIGHTS: Record<RuleCategory, number> = {
  architecture: 0.2,
  security: 0.25,
  devops: 0.2,
  testing: 0.2,
  documentation: 0.05,
  performance: 0.1,
};

export interface CategoryScore {
  category: RuleCategory;
  score: number;
}

export type Verdict = "Ready" | "Ready with Minor Improvements" | "Not Ready" | "High Risk";

export interface ScoreResult {
  categoryScores: CategoryScore[];
  overallScore: number;
  verdict: Verdict;
}

function verdictFor(score: number): Verdict {
  if (score >= 90) return "Ready";
  if (score >= 70) return "Ready with Minor Improvements";
  if (score >= 50) return "Not Ready";
  return "High Risk";
}

export function scoreIssues(
  issues: Issue[],
  categoryWeights: Record<RuleCategory, number> = DEFAULT_CATEGORY_WEIGHTS
): ScoreResult {
  const categories = Object.keys(categoryWeights) as RuleCategory[];

  const categoryScores: CategoryScore[] = categories.map((category) => {
    const categoryIssues = issues.filter((i) => i.category === category);
    const penalty = categoryIssues.reduce((sum, i) => sum + SEVERITY_WEIGHT[i.severity], 0);
    const score = Math.max(0, 100 - penalty);
    return { category, score };
  });

  const overallScore = Math.round(
    categoryScores.reduce((sum, c) => sum + c.score * (categoryWeights[c.category] ?? 0), 0)
  );

  return {
    categoryScores,
    overallScore,
    verdict: verdictFor(overallScore),
  };
}
