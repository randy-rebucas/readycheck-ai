export const QUEUE_NAMES = {
  SCAN: "scan",
} as const;

export interface ScanJobData {
  scanId: string;
  /** Local filesystem path to scan. Repo cloning (git URL -> local path) is a later pipeline stage. */
  path: string;
}

export type ScanJobStatus = "queued" | "active" | "completed" | "failed";
