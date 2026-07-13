import "./load-env";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker, type Job } from "bullmq";
import simpleGit from "simple-git";
import { QUEUE_NAMES, getRedisConnection, type ScanJobData } from "@readycheck/queue";
import { scanRepository } from "@readycheck/scanner";
import { coreRules, evaluateRules } from "@readycheck/rules";
import { evaluatePlugins } from "@readycheck/plugins";
import { scoreIssues } from "@readycheck/scoring";
import { getPrismaClient } from "@readycheck/db";
import { generateNarrative, getAIProvider } from "@readycheck/ai";

const prisma = getPrismaClient();
const aiProvider = getAIProvider();

async function cloneRepo(repoUrl: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "readycheck-clone-"));
  await simpleGit().clone(repoUrl, dir, ["--depth", "1"]);
  return dir;
}

/** Short label for the notification bell -- the full path is in the scan itself. */
function scanLabel(target: string): string {
  const trimmed = target.replace(/\.git$/, "");
  const segment = trimmed.split(/[\\/]/).filter(Boolean).pop();
  return segment ?? trimmed;
}

/**
 * Thrown by checkCancelled() when a user cancels a scan while it's active.
 * BullMQ can't forcibly kill an in-flight processor, so cancellation is
 * cooperative: we poll the DB between stages and unwind via this error.
 */
class ScanCancelledError extends Error {
  constructor() {
    super("Scan cancelled by user");
    this.name = "ScanCancelledError";
  }
}

async function checkCancelled(scanId: string): Promise<void> {
  const scan = await prisma.scan.findUnique({ where: { id: scanId }, select: { status: true } });
  if (scan?.status === "cancelled") throw new ScanCancelledError();
}

async function processScan(job: Job<ScanJobData>) {
  const { scanId, path, repoUrl } = job.data;
  let scanPath = path;
  let clonedDir: string | undefined;
  const label = scanLabel(repoUrl ?? path ?? scanId);

  await prisma.scan.update({ where: { id: scanId }, data: { status: "active" } });

  try {
    if (repoUrl) {
      await job.updateProgress({ stage: "cloning" });
      await prisma.scan.update({ where: { id: scanId }, data: { progress: "cloning" } });
      clonedDir = await cloneRepo(repoUrl);
      scanPath = clonedDir;
    }

    if (!scanPath) {
      throw new Error("Scan job has neither a local path nor a repoUrl.");
    }

    await checkCancelled(scanId);
    await job.updateProgress({ stage: "scanning" });
    await prisma.scan.update({ where: { id: scanId }, data: { progress: "scanning" } });
    const facts = scanRepository(scanPath);

    await checkCancelled(scanId);
    await job.updateProgress({ stage: "evaluating_rules" });
    await prisma.scan.update({ where: { id: scanId }, data: { progress: "evaluating_rules" } });
    const coreIssues = evaluateRules(coreRules, facts);

    await checkCancelled(scanId);
    await job.updateProgress({ stage: "evaluating_plugins" });
    await prisma.scan.update({ where: { id: scanId }, data: { progress: "evaluating_plugins" } });
    const pluginIssues = evaluatePlugins(scanPath, facts);
    const issues = [...coreIssues, ...pluginIssues];

    await checkCancelled(scanId);
    await job.updateProgress({ stage: "scoring" });
    await prisma.scan.update({ where: { id: scanId }, data: { progress: "scoring" } });
    const result = scoreIssues(issues);

    await checkCancelled(scanId);
    await job.updateProgress({ stage: "ai_narrative" });
    await prisma.scan.update({ where: { id: scanId }, data: { progress: "ai_narrative" } });
    const aiNarrative = await generateNarrative(
      { facts, issues, categoryScores: result.categoryScores, overallScore: result.overallScore, verdict: result.verdict },
      aiProvider
    );

    await checkCancelled(scanId);
    await job.updateProgress({ stage: "persisting" });
    await prisma.scan.update({ where: { id: scanId }, data: { progress: "persisting" } });
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
          aiNarrative,
          progress: "done",
          completedAt: new Date(),
        },
      }),
      prisma.notification.create({
        data: {
          type: "scan_completed",
          title: `Scan completed: ${label}`,
          body: `Readiness score ${result.overallScore}% -- ${result.verdict}.`,
          scanId,
        },
      }),
    ]);

    await job.updateProgress({ stage: "done" });
    return { facts, issues, aiNarrative, ...result };
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
  if (!job) return;

  // Cancellation unwinds through the same throw path as a real failure, but
  // the scan row is already "cancelled" (set by the cancel endpoint) and the
  // user doesn't need a failure notification for something they asked for.
  if (err instanceof ScanCancelledError) {
    console.log(`[worker] scan ${job.data.scanId} cancelled (job ${job.id})`);
    return;
  }

  console.error(`[worker] scan ${job.data.scanId} failed (job ${job.id}):`, err.message);

  // Best-effort: the Scan row may already be gone (e.g. manually deleted while
  // its job was still queued). A failure here must not crash the process --
  // an uncaught error in this handler would take down the whole worker.
  try {
    const { scanId, path, repoUrl } = job.data;
    // checkCancelled() only runs between stages, not during the single
    // blocking cloneRepo() call -- so a cancel requested mid-clone can race
    // with the clone itself erroring out (network drop, disk full, ...)
    // instead of throwing ScanCancelledError. updateMany with a status guard
    // (instead of update) makes sure that race doesn't clobber an
    // already-"cancelled" row back to "failed", or fire a spurious
    // "scan failed" notification for a scan the user intentionally cancelled.
    const { count } = await prisma.scan.updateMany({
      where: { id: scanId, status: { not: "cancelled" } },
      data: { status: "failed", errorMessage: err.message },
    });
    if (count > 0) {
      await prisma.notification.create({
        data: {
          type: "scan_failed",
          title: `Scan failed: ${scanLabel(repoUrl ?? path ?? scanId)}`,
          body: err.message,
          scanId,
        },
      });
    }
  } catch (updateErr) {
    console.error(`[worker] could not record failure for scan ${job.data.scanId}:`, updateErr);
  }
});

console.log("ReadyCheck worker listening on queue:", QUEUE_NAMES.SCAN);
console.log(
  aiProvider
    ? `AI narrative generation enabled (provider: ${aiProvider.name})`
    : "AI narrative generation disabled (no provider configured)"
);

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[worker] received ${signal}, draining active jobs before exit...`);
  try {
    // worker.close() stops pulling new jobs and waits for in-flight jobs to
    // finish (respecting BullMQ's lock renewal) instead of killing them mid-write.
    await worker.close();
    await prisma.$disconnect();
    console.log("[worker] shutdown complete");
    process.exit(0);
  } catch (err) {
    console.error("[worker] error during shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
