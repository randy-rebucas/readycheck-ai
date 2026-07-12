export const QUEUE_NAMES = {
  SCAN: "scan",
} as const;

export interface ScanJobData {
  scanId: string;
  /** Exactly one of these is set. */
  path?: string;
  repoUrl?: string;
}

export type ScanJobStatus = "queued" | "active" | "completed" | "failed";
