import type { RepoFacts } from "@readycheck/scanner";
import type { Issue, Rule } from "./types.js";

export function evaluateRules(rules: Rule[], facts: RepoFacts): Issue[] {
  const issues: Issue[] = [];
  for (const rule of rules) {
    const issue = rule.evaluate(facts);
    if (issue) issues.push(issue);
  }
  return issues;
}
