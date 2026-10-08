import type { Job } from "bullmq";
import { CodingAgentError, runCodingAgent } from "@readycheck/ai";
import { getPrismaClient } from "@readycheck/db";
import { slugify } from "@readycheck/github";
import type { FixJobData } from "@readycheck/queue";
import { fixInfo, RULE_CATALOG } from "@readycheck/rules";
import { analyze } from "./analyze";
import { checkout, JobError, openPullRequest, stageAndDiff, type Checkout } from "./checkout";
import { FIXERS } from "./fixers";

const prisma = getPrismaClient();

function agentTask(issue: { ruleId: string; message: string; recommendation: string }, facts: object): string {
  return `Fix this production-readiness finding in the repository.

Finding ${issue.ruleId}: ${issue.message}
Recommendation: ${issue.recommendation}

What the scanner detected about the repository:
${JSON.stringify(facts, null, 2)}

Make the smallest change that resolves the finding in a way that fits this codebase.`;
}

/** Applies each finding's fix in the checkout: the template when one fits, the coding agent otherwise. */
async function applyFixes(
  co: Checkout,
  issues: { ruleId: string; message: string; recommendation: string }[],
  owner: string
): Promise<{ applied: string[]; notes: string[]; usedAgent: boolean }> {
  const applied: string[] = [];
  const notes: string[] = [];
  let usedAgent = false;
  for (const issue of issues) {
    const info = fixInfo(issue.ruleId);
    if (info.kind === "guided") {
      notes.push(`${issue.ruleId}: no automatic fix; follow the guided steps.`);
      continue;
    }
    const { facts } = analyze(co.dir);
    const fixer = FIXERS[issue.ruleId];
    if (fixer && (await fixer({ root: co.dir, facts, git: co.git, owner, baseBranch: co.baseBranch }))) {
      applied.push(issue.ruleId);
      continue;
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      notes.push(`${issue.ruleId}: needs the AI fixer, which isn't configured (ANTHROPIC_API_KEY on the worker).`);
      continue;
    }
    try {
      const result = await runCodingAgent({ root: co.dir, task: agentTask(issue, facts) });
      usedAgent = true;
      if (result.changed.length) applied.push(issue.ruleId);
      notes.push(`${issue.ruleId}: ${result.summary}`);
    } catch (err) {
      if (!(err instanceof CodingAgentError)) throw err;
      notes.push(`${issue.ruleId}: ${err.message}`);
    }
  }
  return { applied, notes, usedAgent };
}

export async function processFix(job: Job<FixJobData>): Promise<void> {
  const fix = await prisma.fixRequest.update({
    where: { id: job.data.fixRequestId },
    data: { status: "working", error: null },
  });
  const org = await prisma.organization.findUnique({ where: { id: fix.orgId }, select: { disabledRules: true } });
  const scan = await prisma.scan.findUnique({ where: { id: fix.scanId }, include: { issues: true } });
  if (!scan) throw new JobError("The scan behind this fix no longer exists.");
  const issues = scan.issues.filter((i) => fix.ruleIds.includes(i.ruleId));

  const branch = `readycheck/fix-${slugify(fix.ruleIds.join("-").toLowerCase(), 30)}-${fix.id.slice(0, 6)}`;
  const co = await checkout(fix.orgId, fix.repoPath, branch);
  try {
    const before = analyze(co.dir, org?.disabledRules).issues.map((i) => i.ruleId);
    const { applied, notes, usedAgent } = await applyFixes(co, issues, co.ref.owner);
    if (applied.length === 0) throw new JobError(notes.join(" ") || "Nothing could be fixed automatically.");

    const { diff, files } = await stageAndDiff(co);
    if (files.length === 0) throw new JobError("The fix produced no changes; the finding may already be resolved.");

    // Verify against what the branch will contain: drop ignored leftovers
    // (e.g. untracked .env files) before re-scanning.
    await co.git.raw(["clean", "-fdX"]);
    const after = analyze(co.dir, org?.disabledRules).issues.map((i) => i.ruleId);
    const verification = {
      resolved: fix.ruleIds.filter((r) => !after.includes(r)),
      stillOpen: fix.ruleIds.filter((r) => after.includes(r)),
      introduced: after.filter((r) => !before.includes(r)),
    };

    const caveats = fix.ruleIds.map((r) => fixInfo(r).caveat).filter(Boolean);
    const titles = issues.map((i) => `- **${i.ruleId}** ${i.message}`).join("\n");
    const title =
      issues.length === 1 ? `Fix ${issues[0].ruleId}: ${issues[0].message.replace(/\.$/, "")}` : `Fix ${issues.length} readiness findings`;
    const body = `Opened by ReadyCheck from a readiness check of \`${co.baseBranch}\`.

### Findings
${titles}

### Re-scan of this branch
- Resolved: ${verification.resolved.join(", ") || "none"}
- Still open: ${verification.stillOpen.join(", ") || "none"}
- New findings: ${verification.introduced.join(", ") || "none"}
${caveats.length ? `\n### Before merging\n${caveats.map((c) => `- ${c}`).join("\n")}\n` : ""}${
      notes.length ? `\n### Notes\n${notes.map((n) => `- ${n}`).join("\n")}\n` : ""
    }${usedAgent ? "\nPart of this change was written by an AI model. Review it like any other pull request.\n" : ""}`;

    const pr = await openPullRequest(co, {
      title,
      body,
      commitMessage: `${title}\n\nGenerated by ReadyCheck.`,
    });

    const ruleNames = new Map(RULE_CATALOG.map((r) => [r.id, r.description]));
    await prisma.fixRequest.update({
      where: { id: fix.id },
      data: {
        status: "opened",
        branch,
        prNumber: pr.number,
        prUrl: pr.url,
        diff,
        verification,
        summary: applied.map((r) => ruleNames.get(r) ?? r).join(" "),
      },
    });
  } finally {
    co.cleanup();
  }
}
