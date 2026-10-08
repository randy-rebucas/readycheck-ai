export const QUEUE_NAMES = {
  SCAN: "scan",
  FIX: "fix",
  BUILD: "build",
} as const;

/** Opens a pull request fixing the findings of one FixRequest row. */
export interface FixJobData {
  fixRequestId: string;
}

/** Builds one BuildSlice row as a pull request. */
export interface BuildJobData {
  sliceId: string;
}

export interface ScanJobData {
  scanId: string;
  /** Exactly one of these is set. */
  path?: string;
  repoUrl?: string;
}

export type ScanJobStatus = "queued" | "active" | "completed" | "failed";
