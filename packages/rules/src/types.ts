import type { RepoFacts } from "@readycheck/scanner";

export type RuleCategory =
  | "architecture"
  | "security"
  | "devops"
  | "testing"
  | "documentation"
  | "performance";

export type Severity = "critical" | "high" | "medium" | "low";
export type Effort = "XS" | "S" | "M" | "L" | "XL";

export interface Issue {
  ruleId: string;
  category: RuleCategory;
  severity: Severity;
  message: string;
  recommendation: string;
  estimatedEffort: Effort;
}

export interface Rule {
  id: string;
  category: RuleCategory;
  description: string;
  severityDefault: Severity;
  estimatedEffort: Effort;
  evaluate(facts: RepoFacts): Issue | null;
}
