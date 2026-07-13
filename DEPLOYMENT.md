# Deployment

This covers taking ReadyCheck AI from a laptop checkout to a running environment:
Docker image builds, single-host deployment with `docker-compose`, multi-node
deployment with the Kubernetes manifests in `infrastructure/kubernetes/`, and a
managed-platform path using Vercel (dashboard) + Render (api, worker, Postgres, Redis).

For local development (no containers), see the [README](README.md) instead.

## Services

| Service | Image / entrypoint | Port | Statefulness |
|---|---|---|---|
| `api` | `apps/api/Dockerfile` → `node dist/main.js` | 3001 | Stateless (reads/writes Postgres + Redis) |
| `worker` | `apps/worker/Dockerfile` → `node dist/main.js` | none (no HTTP surface) | Stateless BullMQ consumer |
| `dashboard` | `apps/dashboard/Dockerfile` → `next start` | 3000 | Stateless |
| `postgres` | `postgres:16-alpine` | 5432 | Stateful — primary datastore |
| `redis` | `redis:7-alpine` | 6379 | Stateful for in-flight jobs only; safe to lose (BullMQ jobs, not the scan results) |

A scan's actual data lives in Postgres (`Scan`, `Issue`, `CategoryScore`, ... — see
`packages/db/prisma/schema.prisma`). Redis only holds the BullMQ job queue, so it
can be treated as ephemeral/cache-tier infra, not backed up like Postgres.

## Building the images

Each Dockerfile is a multi-stage build that runs from the **repo root** as build
context (it needs the full pnpm workspace, not just the one app), and targets one
`turbo` package via `--filter`:

```bash
docker build -f apps/api/Dockerfile       -t readycheck-ai/api:latest       .
docker build -f apps/worker/Dockerfile    -t readycheck-ai/worker:latest    .
docker build -f apps/dashboard/Dockerfile -t readycheck-ai/dashboard:latest .
```

Push to whatever registry your cluster pulls from before deploying to Kubernetes
(the manifests currently reference `readycheck-ai/api:latest` etc. unqualified —
tag/retag to your registry, e.g. `ghcr.io/<org>/readycheck-ai-api:latest`, and
update the `image:` field in each `infrastructure/kubernetes/*.yaml` deployment).

There is no CI step that builds and pushes these images yet (`.github/workflows/ci.yml`
only typechecks/builds/tests) — wire that up before relying on `latest` tags in a
real environment.

## Database migrations

Migrations are Prisma, tracked in `packages/db/prisma/migrations/`. They are **not**
run automatically by any Dockerfile or Kubernetes manifest — run them explicitly
against the target database before (or during) a rollout:

```bash
cd packages/db
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

For Kubernetes, the simplest safe pattern is a one-off `Job` using the `api` image
(it already has `@prisma/client` and the compiled `packages/db` in its
`node_modules`) run before applying the new `api`/`worker` deployments:

```bash
kubectl run readycheck-migrate -n readycheck-ai --rm -it --restart=Never \
  --image=readycheck-ai/api:latest \
  --env="DATABASE_URL=$(kubectl get secret readycheck-secrets -n readycheck-ai -o jsonpath='{.data.DATABASE_URL}' | base64 -d)" \
  -- node_modules/.bin/prisma migrate deploy --schema=node_modules/@readycheck/db/prisma/schema.prisma
```

(Adjust the schema path to wherever `packages/db/prisma/schema.prisma` actually
lands in the built `api` image — verify with `docker run --rm readycheck-ai/api:latest find / -name schema.prisma` if unsure.) A dedicated migration `Job` manifest isn't checked into `infrastructure/kubernetes/` yet — this is a manual step until one is added.

## Single-host deployment (`docker-compose`)

`docker-compose.yml` at the repo root wires Postgres, Redis, `api`, `worker`, and
`dashboard` together on one host. This is the fastest path to a real deployment
and is a reasonable fit for a small/staging environment.

```bash
# Required secrets — export or put in a .env file next to docker-compose.yml
export AUTH_JWT_SECRET=$(openssl rand -hex 32)
export READYCHECK_API_KEY=$(openssl rand -hex 32)
export ANTHROPIC_API_KEY=...        # optional — AI narratives are skipped without it
export API_URL=https://api.example.com
export DASHBOARD_URL=https://example.com
# GITHUB_CLIENT_ID/SECRET, GOOGLE_CLIENT_ID/SECRET, SMTP_* — optional, see table below

docker-compose up -d --build

# One-time (and after every deploy that adds migrations):
docker-compose run --rm api sh -c "cd node_modules/@readycheck/db 2>/dev/null || true" # see note below
```

Migrations aren't wired into `docker-compose.yml` as a step — the simplest option
locally is what the README already documents: run `npx prisma migrate deploy` from
`packages/db` with `DATABASE_URL` pointed at the compose Postgres
(`postgresql://readycheck:readycheck@localhost:5432/readycheck` by default).

Put a reverse proxy (nginx, Caddy, Traefik) in front of ports 3000/3001 for TLS —
`docker-compose.yml` exposes them on the host directly with no TLS termination.

## Kubernetes deployment

Manifests live in `infrastructure/kubernetes/`, applied via `kustomize`:

```bash
cd infrastructure/kubernetes
cp secret.example.yaml secret.yaml   # gitignored — fill in real values
kubectl apply -k .
```

Resources, in dependency order (`kustomization.yaml` lists them, `kubectl apply -k`
handles ordering):

1. `namespace.yaml` — the `readycheck-ai` namespace everything else lives in
2. `configmap.yaml` / `secret.yaml` — shared env vars (see gap below)
3. `postgres.yaml` — a `StatefulSet` + `Service`. **Dev/staging only** — the file's
   own comment says to point `DATABASE_URL` at a managed database (RDS, Cloud SQL,
   ...) in production and skip applying this file.
4. `redis.yaml` — `Deployment` + `Service`, single replica (fine — it's not the
   source of truth for anything)
5. `api.yaml` — 2 replicas, `/health` readiness/liveness probes, 5s `preStop` sleep
   + 30s termination grace so in-flight HTTP requests drain before SIGKILL
6. `worker.yaml` — 2 replicas, CPU-based HPA (2–10 replicas at 70% CPU), 120s
   termination grace so `Worker.close()` can drain an in-flight scan. No liveness
   probe by design (no HTTP surface) — see the in-file comment about a KEDA
   queue-depth-based `ScaledObject` being the better long-term autoscaling fit
7. `dashboard.yaml` — 2 replicas, probes against `/`
8. `ingress.yaml` — assumes `ingress-nginx` is already installed; routes
   `/api(/|$)(.*)` → `api:3001` (stripped via `rewrite-target: /$2`, since
   `apps/api`'s NestJS routes have no `/api` prefix) and everything else → `dashboard:3000`.
   **Edit the `host:` field** (`readycheck.example.com` is a placeholder) and add
   TLS (`tls:` block + cert-manager annotation, or your ingress controller's
   equivalent) before going live — this file ships with no TLS configured.

### ⚠️ `configmap.yaml` / `secret.example.yaml` are incomplete

Only these env vars are wired through to the pods today:

- ConfigMap: `REDIS_URL`, `READYCHECK_API_URL`, `PORT`
- Secret: `DATABASE_URL`, `READYCHECK_API_KEY`, `ANTHROPIC_API_KEY`, `POSTGRES_PASSWORD`

Compare against the full variable list below (and `docker-compose.yml`, which *does*
wire all of them) — missing from the k8s manifests: `AUTH_JWT_SECRET` (required —
both `api` and `dashboard` refuse to start in production without it),
`API_URL`/`DASHBOARD_URL` (OAuth callback URLs), `NEXT_PUBLIC_API_URL`/
`NEXT_PUBLIC_DASHBOARD_URL` (browser-facing, needed by the dashboard's OAuth kickoff),
`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`,
the `SMTP_*` vars for password-reset email, and the `PAYPAL_*`/`NEXT_PUBLIC_PAYPAL_*`
vars for Pro-plan billing. Add the ones you need to `configmap.yaml` (non-secret) or
`secret.yaml` (secret) and to the relevant deployment's `envFrom`/`env` before relying
on OAuth login, password reset, or Pro checkout in a cluster deployment — right now
they'll silently 503 (OAuth), log-instead-of-send (password reset), or fail
`/billing/subscribe` (PayPal), same as leaving them unset locally. Free-tier scan
limits and gating work regardless, since they don't depend on PayPal being configured.

### Rolling updates / rollback

```bash
kubectl set image deployment/api api=readycheck-ai/api:v1.2.3 -n readycheck-ai
kubectl rollout status deployment/api -n readycheck-ai
kubectl rollout undo deployment/api -n readycheck-ai   # rollback if it goes bad
```

Run migrations (see above) before rolling out a version whose migrations haven't
been applied yet — none of these Deployments run migrations themselves, and an
`api`/`worker` pod started against a schema it doesn't expect will error at the
first query, not at startup (no migration check on boot).

## Vercel + Render deployment

A no-Docker-ops-required path: `dashboard` on Vercel (it's a Next.js app — this is
Vercel's home turf), and `api` + `worker` + Postgres + Redis on Render, which builds
straight from the existing Dockerfiles. Good fit for a small team that doesn't want
to run Kubernetes.

### Dashboard on Vercel

The dashboard lives in a pnpm-workspace subdirectory and depends on a workspace
package (`@readycheck/billing`), so Vercel needs to install/build from the repo
root rather than just `apps/dashboard`. `apps/dashboard/vercel.json` handles this:

```json
{
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "buildCommand": "cd ../.. && pnpm turbo run build --filter=@readycheck/dashboard",
  "outputDirectory": ".next"
}
```

Vercel project setup:

1. Import the repo, set **Root Directory** to `apps/dashboard` (Project Settings →
   General). Framework Preset auto-detects Next.js; the `vercel.json` above
   overrides the install/build commands to reach up to the workspace root first —
   `turbo`'s dependency graph builds `@readycheck/billing` before `dashboard` itself.
2. Set environment variables (Project Settings → Environment Variables) — same
   dashboard variables as the table below (`READYCHECK_API_URL`, `READYCHECK_API_KEY`,
   `AUTH_JWT_SECRET`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DASHBOARD_URL`,
   `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `NEXT_PUBLIC_PAYPAL_PRO_PLAN_ID`, ...), pointed at
   the Render `api` service's public URL. Unlike the Kubernetes path, Vercel runs the
   build fresh per-deploy with these variables present, so the `NEXT_PUBLIC_*`
   build-time-inlining gap documented under Kubernetes doesn't apply here.
3. Push to the connected branch — Vercel builds and deploys automatically. Custom
   domain + TLS are handled in Project Settings → Domains (no separate ingress/proxy
   step needed, unlike `docker-compose`/Kubernetes).

### `api` + `worker` + Postgres + Redis on Render

`render.yaml` at the repo root is a Render **Blueprint** — Render reads it
automatically when you create a new Blueprint instance pointed at this repo (New →
Blueprint in the Render dashboard), provisioning all four resources at once:

- `readycheck-api` — Docker web service built from `apps/api/Dockerfile`
  (`dockerContext: .` — same repo-root-as-build-context requirement as the plain
  Docker builds above), health-checked on `/health`.
- `readycheck-worker` — Docker background worker built from `apps/worker/Dockerfile`.
  Render background workers have no public URL/port, matching the worker's "no HTTP
  surface" design.
- `readycheck-postgres` — managed Postgres; its connection string is wired to both
  services automatically via `fromDatabase`.
- `readycheck-redis` — managed Redis; wired to both services via `fromService`.

Secrets marked `sync: false` in `render.yaml` (`READYCHECK_API_KEY`,
`AUTH_JWT_SECRET`, `ANTHROPIC_API_KEY`, OAuth/SMTP/PayPal credentials, ...) are
intentionally left blank in the Blueprint — Render prompts for them once at
Blueprint creation, then they live in the Render dashboard, not in the repo.
`AUTH_JWT_SECRET` must be set to the **same value** you put in Vercel's dashboard
env vars.

Migrations: run them from your machine (or CI) against Render Postgres's
**external** connection string (Render Postgres dashboard → Connections → External
Database URL), the same "migrations are a manual step, not baked into the image"
approach as the Docker/Kubernetes paths above:

```bash
cd packages/db
DATABASE_URL="<render external connection string>" npx prisma migrate deploy
```

(Running `prisma migrate deploy` *inside* the deployed `api` container isn't set up
as a pre-deploy step — the runtime image only copies `apps/api/node_modules` +
hoisted root `node_modules`, not `packages/db/node_modules` where the `prisma` CLI
binary lives, so it isn't reliably on `PATH` inside the container. Running it
externally from `packages/db` sidesteps that entirely.)

## Environment variables

Full reference (mirrors the README, repeated here for deployment context):

| Variable | Used by | Required in production? |
|---|---|---|
| `DATABASE_URL` | api, worker, db migrations | Yes |
| `REDIS_URL` | api, worker | Yes |
| `READYCHECK_API_KEY` | api, dashboard | Strongly recommended — unset disables all `/scans*` auth |
| `READYCHECK_API_URL` | dashboard | Yes — internal API address (`http://api:3001` in-cluster) |
| `AUTH_JWT_SECRET` | api, dashboard | Yes — must match on both; apps refuse to start in production without it |
| `ANTHROPIC_API_KEY` | worker | No — AI narratives skipped gracefully if unset |
| `AI_PROVIDER`, `AI_MODEL` | worker | No |
| `PORT` | api | No (defaults 3001) |
| `API_URL` | api | Yes if using OAuth — public API URL for callback registration |
| `DASHBOARD_URL` | api | Yes if using OAuth — restricts CORS + post-login redirect target |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DASHBOARD_URL` | dashboard | Yes if using OAuth — browser-facing, must be publicly reachable (not the internal `api:3001` hostname) |
| `GITHUB_CLIENT_ID`/`SECRET`, `GOOGLE_CLIENT_ID`/`SECRET` | api | No — that provider's login button 503s if unset |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE` | api | No — reset links log to the API console instead of emailing if `SMTP_HOST` unset (fine for staging, not production) |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_PRO_PLAN_ID`, `PAYPAL_WEBHOOK_ID` | api | Yes if selling Pro plans — unset breaks `/billing/subscribe` and webhook verification; Free-tier gating works without them |
| `PAYPAL_ENV` | api | No (defaults `sandbox`) — set to `live` in production |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `NEXT_PUBLIC_PAYPAL_PRO_PLAN_ID` | dashboard | Yes if selling Pro plans — not secret, must match the API's `PAYPAL_CLIENT_ID`/`PAYPAL_PRO_PLAN_ID` |

### PayPal billing setup

1. Create a PayPal Billing Plan for the Pro tier (via the PayPal developer dashboard
   or the Subscriptions API) and set its id as `PAYPAL_PRO_PLAN_ID` /
   `NEXT_PUBLIC_PAYPAL_PRO_PLAN_ID`.
2. Register a webhook pointed at `<API_URL>/billing/webhook`, subscribed to at least
   `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`,
   `BILLING.SUBSCRIPTION.SUSPENDED`, `BILLING.SUBSCRIPTION.EXPIRED`, and
   `PAYMENT.SALE.COMPLETED`; set the webhook's id as `PAYPAL_WEBHOOK_ID`. This route
   has no `x-api-key` guard (PayPal can't send it) — it verifies authenticity via
   PayPal's own signature-verification endpoint instead, so `PAYPAL_WEBHOOK_ID` must
   be correct or every webhook call is rejected.
3. Use `PAYPAL_ENV=sandbox` (default) with sandbox credentials until ready to accept
   real payments, then switch to `live`.

## Health checks

- `api`: `GET /health` (`apps/api/src/health.controller.ts`)
- `dashboard`: `GET /` (no dedicated health route — the manifests probe the landing page)
- `worker`: none — pure BullMQ consumer, no HTTP surface. Monitor via BullMQ queue
  metrics (job counts, stalled jobs) or process-level liveness (`kubectl get pods`)
  instead of an HTTP probe.

## Post-deploy smoke test

```bash
# userId must be a real User row's id -- POST/GET /scans require it (used for
# per-plan repository/scan-rate limits and per-user scan listing).
curl -X POST https://api.example.com/scans \
  -H "Content-Type: application/json" -H "x-api-key: $READYCHECK_API_KEY" \
  -d '{"path": "https://github.com/octocat/Hello-World.git", "userId": "<userId>"}'
# -> {"scanId": "...", "status": "queued"}

curl -H "x-api-key: $READYCHECK_API_KEY" https://api.example.com/scans/<scanId>
```

A scan reaching `status: "completed"` confirms `api` → Redis → `worker` →
Postgres → `api` is fully wired end to end.
