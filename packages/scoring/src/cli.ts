#!/usr/bin/env node
import { scanRepository } from "@readycheck/scanner";
import { coreRules, evaluateRules } from "@readycheck/rules";
import { scoreIssues } from "./index.js";

const target = process.argv[2] ?? process.cwd();

const facts = scanRepository(target);
const issues = evaluateRules(coreRules, facts);
const result = scoreIssues(issues);

console.log(`\nReadyCheck AI — scan of ${target}\n`);
console.log("Detected:", facts);
console.log("\nIssues found:");
for (const issue of issues) {
  console.log(`  [${issue.severity.toUpperCase()}] ${issue.ruleId} — ${issue.message}`);
  console.log(`    -> ${issue.recommendation}`);
}
console.log("\nCategory scores:");
for (const c of result.categoryScores) {
  console.log(`  ${c.category.padEnd(14)} ${c.score}%`);
}
console.log(`\nOverall Production Score: ${result.overallScore}%`);
console.log(`Verdict: ${result.verdict}\n`);
