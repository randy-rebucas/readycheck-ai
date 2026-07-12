import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker, type Job } from "bullmq";
import simpleGit from "simple-git";
import { QUEUE_NAMES, getRedisConnection, type ScanJobData } from "@readycheck/queue";
import { scanRepository } from "@readycheck/scanner";
import { coreRules, evaluateRules } from "@readycheck/rules";
import { scoreIssues } from "@readycheck/scoring";
import { getPrismaClient } from "@readycheck/db";

const prisma = getPrismaClient();

async function cloneRepo(repoUrl: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "readycheck-clone-"));
  await simpleGit().clone(repoUrl, dir, ["--depth", "1"]);
  return dir;
}

async function processScan(job: Job<ScanJobData>) {
  const { scanId, path, repoUrl } = job.data;
  let scanPath = path;
  let clonedDir: string | undefined;

  await prisma.scan.update({ where: { id: scanId }, data: { status: "active" } });

  try {
    if (repoUrl) {
      await job.updateProgress({ stage: "cloning" });
      clonedDir = await cloneRepo(repoUrl);
      scanPath = clonedDir;
    }

    if (!scanPath) {
      throw new Error("Scan job has neither a local path nor a repoUrl.");
    }

    await job.updateProgress({ stage: "scanning" });
    const facts = scanRepository(scanPath);

    await job.updateProgress({ stage: "evaluating_rules" });
    const issues = evaluateRules(coreRules, facts);

    await job.updateProgress({ stage: "scoring" });
    const result = scoreIssues(issues);

    await job.updateProgress({ stage: "persisting" });
    await prisma.$transaction([
      prisma.issue.createMany({
        data: issues.map((issue) => ({
          scanId,
          ruleId: issue.ruleId,
          category: issue.category,
          severity: issue.severity,
          message: issue.message,
          recommendation: issue.recommendation,
          estimatedEffort: issue.estimatedEffort,
        })),
      }),
      prisma.categoryScore.createMany({
        data: result.categoryScores.map((c) => ({
          scanId,
          category: c.category,
          score: c.score,
        })),
      }),
      prisma.scan.update({
        where: { id: scanId },
        data: {
          status: "completed",
          overallScore: result.overallScore,
          verdict: result.verdict,
          facts: facts as object,
          completedAt: new Date(),
        },
      }),
    ]);

    await job.updateProgress({ stage: "done" });
    return { facts, issues, ...result };
  } finally {
    if (clonedDir) {
      rmSync(clonedDir, { recursive: true, force: true });
    }
  }
}

const worker = new Worker<ScanJobData>(QUEUE_NAMES.SCAN, processScan, {
  connection: getRedisConnection(),
  concurrency: 4,
});

worker.on("completed", (job) => {
  console.log(`[worker] scan ${job.data.scanId} completed (job ${job.id})`);
});

worker.on("failed", async (job, err) => {
  console.error(`[worker] scan ${job?.data.scanId} failed (job ${job?.id}):`, err.message);
  if (job) {
    await prisma.scan.update({
      where: { id: job.data.scanId },
      data: { status: "failed", errorMessage: err.message },
    });
  }
});

console.log("ReadyCheck worker listening on queue:", QUEUE_NAMES.SCAN);
