import { existsSync } from "node:fs";
import { join } from "node:path";

// Nothing else auto-loads env files for this app (no Next.js, no dotenv), so
// do it here for dev convenience. Must be imported before any module that
// reads process.env at import time (e.g. auth.module.ts). Real environment
// variables take precedence over file values, so docker-compose / production
// env is unaffected.
for (const dir of [join(__dirname, ".."), process.cwd()]) {
  for (const name of [".env.local", ".env"]) {
    const path = join(dir, name);
    if (existsSync(path)) {
      try {
        process.loadEnvFile(path);
      } catch {
        // best-effort: malformed file or very old Node -- just skip
      }
    }
  }
}
