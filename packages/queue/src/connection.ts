import type { ConnectionOptions } from "bullmq";

export function getRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
  };
}
