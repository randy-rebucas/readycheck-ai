import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";
import { QUEUE_NAMES, type ScanJobData } from "./types";

let scanQueue: Queue<ScanJobData> | undefined;

export function getScanQueue(): Queue<ScanJobData> {
  if (!scanQueue) {
    scanQueue = new Queue<ScanJobData>(QUEUE_NAMES.SCAN, {
      connection: getRedisConnection(),
    });
  }
  return scanQueue;
}
