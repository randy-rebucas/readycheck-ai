import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";
import { QUEUE_NAMES, type BuildJobData, type FixJobData, type ScanJobData } from "./types";

let scanQueue: Queue<ScanJobData> | undefined;

export function getScanQueue(): Queue<ScanJobData> {
  if (!scanQueue) {
    scanQueue = new Queue<ScanJobData>(QUEUE_NAMES.SCAN, {
      connection: getRedisConnection(),
    });
  }
  return scanQueue;
}

let fixQueue: Queue<FixJobData> | undefined;
let buildQueue: Queue<BuildJobData> | undefined;

export function getFixQueue(): Queue<FixJobData> {
  if (!fixQueue) fixQueue = new Queue<FixJobData>(QUEUE_NAMES.FIX, { connection: getRedisConnection() });
  return fixQueue;
}

export function getBuildQueue(): Queue<BuildJobData> {
  if (!buildQueue) buildQueue = new Queue<BuildJobData>(QUEUE_NAMES.BUILD, { connection: getRedisConnection() });
  return buildQueue;
}
