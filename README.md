# ReadyCheck AI

AI-powered production readiness platform. Point it at a repository (local path or public git URL) and get back a scored, evidence-backed readiness verdict with prioritized, actionable fixes — automated CTO-style due diligence instead of a pile of disconnected lint warnings.

This implements the MVP scan pipeline and dashboard from a larger 30-section product plan (architecture, DB schema, roadmap, pricing, etc.) covering the full platform vision; this repo is the working slice of that plan built so far.

## Architecture

```
apps/
  api/         NestJS — REST API (POST /scans, GET /scans, GET /scans/:id, GET /scans/:id/report)
  worker/      BullMQ consumer — clone -> scan -> plugin rules -> score -> AI narrative -> persist
  dashboard/   Next.js — trigger scans, browse results, download reports

packages/
  scanner/     Repo introspection (languages, frameworks, CI, Docker, tests, license, ...)
  rules/       Core rule engine + built-in rule pack
  plugins/     Framework-specific plugins (currently: Next.js)
  scoring/     Weighted category scoring -> overall score + verdict
  ai/          AI provider abstraction + context builder + narrative generation (best-effort)
  reports/     Markdown/HTML/CSV/JSON report generators
  db/          Prisma schema + client (Scan, Issue, CategoryScore)
  queue/       Shared BullMQ job types + Redis connection helper
```

A scan flows: `POST /scans` creates a `Scan` row in Postgres and enqueues a BullMQ job → `apps/worker` picks it up, optionally clones a git URL, runs the scanner + core rules + framework plugins, scores the result, generates an AI narrative (if a provider is configured), and persists everything back to Postgres → the dashboard and `GET /scans/:id` read straight from Postgres, independent of the job's lifetime in Redis.

## Prerequisites

- Node.js 20+, pnpm 10+ (`corepack enable` or `npm i -g pnpm`)
- Docker (for local Postgres/Redis)
- `git` on PATH (used both by you and by the worker's clone stage)

## Setup

```bash
pnpm install

# Start local infra
docker run -d --name readycheck-postgres -p 5432:5432 \
  -e POSTGRES_USER=readycheck -e POSTGRES_PASSWORD=readycheck -e POSTGRES_DB=readycheck \
  postgres:16-alpine
docker run -d --name readycheck-redis -p 6379:6379 redis:7-alpine

# Apply the database schema
cd packages/db && npx prisma migrate deploy && cd ../..

# Build everything
pnpm build
```

(Or use `docker-compose up` instead of the two manual `docker run` commands and separate service processes below — it wires the same Postgres/Redis/api/worker/dashboard together. You'll still need to run the migration once against the compose Postgres.)

## Running locally

Three processes, each in its own terminal, from the repo root:

```bash
# Worker (scan pipeline)
DATABASE_URL="postgresql://readycheck:readycheck@localhost:5432/readycheck" \
REDIS_URL=redis://localhost:6379 \
node apps/worker/dist/main.js

# API
DATABASE_URL="postgresql://readycheck:readycheck@localhost:5432/readycheck" \
REDIS_URL=redis://localhost:6379 \
node apps/api/dist/main.js

# Dashboard
cd apps/dashboard && READYCHECK_API_URL=http://localhost:3001 npx next dev -p 3000
```

Dashboard: http://localhost:3000. API: http://localhost:3001.

## Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | api, worker, db migrations | Postgres connection string |
| `REDIS_URL` | api, worker | Redis connection for the BullMQ queue |
| `READYCHECK_API_KEY` | api, dashboard | If set on the API, `POST/GET /scans*` require a matching `x-api-key` header. Unset = auth disabled (local dev only). Set the same value on the dashboard so its server-side fetches authenticate. |
| `READYCHECK_API_URL` | dashboard | Where the dashboard's server-side code reaches the API (`http://api:3001` inside docker-compose, `http://localhost:3001` for local dev processes) |
| `ANTHROPIC_API_KEY` | worker | Enables AI narrative generation (Claude). Unset = narratives are skipped gracefully; score/issues are unaffected. |
| `AI_PROVIDER`, `AI_MODEL` | worker | Override the AI provider/model (defaults: `anthropic` / `claude-sonnet-5`) |
| `PORT` | api | API listen port (default 3001) |

## Testing

```bash
pnpm turbo run test        # per-package test scripts (vitest)
npx vitest run --workspace vitest.workspace.ts   # same tests, single runner
```

## Triggering a scan

```bash
curl -X POST http://localhost:3001/scans \
  -H "Content-Type: application/json" \
  -d '{"path": "https://github.com/octocat/Hello-World.git"}'
# -> {"scanId": "...", "status": "queued"}

curl http://localhost:3001/scans/<scanId>
curl http://localhost:3001/scans/<scanId>/report?format=markdown
```

`path` accepts either a local filesystem path or a public git URL (github/gitlab/bitbucket, or anything ending in `.git`) — the API auto-detects which.

## What's implemented vs. what's still a gap

Implemented: full async scan pipeline, Postgres persistence, git cloning, a framework plugin system (Next.js), AI narrative generation with graceful degradation, report export (MD/HTML/CSV/JSON), basic API key auth, rate limiting on scan triggering.

Not yet implemented: multi-tenant org/user model (all scans currently share one global list), GitHub App/OAuth integration (only public unauthenticated git clone is supported — no private repos), additional framework plugins beyond Next.js, PDF report export, Kubernetes/Terraform IaC files.
