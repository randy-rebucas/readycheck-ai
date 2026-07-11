import { Worker, type Job } from "bullmq";
import { QUEUE_NAMES, getRedisConnection, type ScanJobData } from "@readycheck/queue";
import { scanRepository } from "@readycheck/scanner";
import { coreRules, evaluateRules } from "@readycheck/rules";
import { scoreIssues } from "@readycheck/scoring";

async function processScan(job: Job<ScanJobData>) {
  await job.updateProgress({ stage: "scanning" });
  const facts = scanRepository(job.data.path);

  await job.updateProgress({ stage: "evaluating_rules" });
  const issues = evaluateRules(coreRules, facts);

  await job.updateProgress({ stage: "scoring" });
  const result = scoreIssues(issues);

  await job.updateProgress({ stage: "done" });
  return { facts, issues, ...result };
}

const worker = new Worker<ScanJobData>(QUEUE_NAMES.SCAN, processScan, {
  connection: getRedisConnection(),
  concurrency: 4,
});

worker.on("completed", (job) => {
  console.log(`[worker] scan ${job.data.scanId} completed (job ${job.id})`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] scan ${job?.data.scanId} failed (job ${job?.id}):`, err.message);
});

console.log("ReadyCheck worker listening on queue:", QUEUE_NAMES.SCAN);
