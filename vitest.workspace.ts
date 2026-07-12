import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/scanner",
  "packages/rules",
  "packages/scoring",
  "packages/ai",
  "packages/plugins",
  "packages/reports",
]);
