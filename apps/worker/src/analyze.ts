import { evaluatePlugins } from "@readycheck/plugins";
import { coreRules, evaluateRules, type Issue } from "@readycheck/rules";
import { scanRepository, type RepoFacts } from "@readycheck/scanner";

/** Facts plus findings for a directory, minus rules the org switched off in Rule packs. */
export function analyze(root: string, disabledRules: string[] = []): { facts: RepoFacts; issues: Issue[] } {
  const facts = scanRepository(root);
  const off = new Set(disabledRules);
  const issues = [...evaluateRules(coreRules, facts), ...evaluatePlugins(root, facts)].filter(
    (issue) => !off.has(issue.ruleId)
  );
  return { facts, issues };
}
