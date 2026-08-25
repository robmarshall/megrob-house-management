# Deploying the pg-boss worker to Coolify

## Why this exists

The backend has two processes. `dist/index.js` is the Hono API; `dist/worker.js`
consumes queued jobs. **Only the API is currently deployed** — see
`docs/mcp-server-plan.md:206-207`, which scopes recipe-import-via-MCP out
precisely because *"the worker process is not wired up as a Coolify resource in
prod"*.

The consequence is bigger than one deferred MCP tool. Anything that reaches
`enqueue*()` in production writes a row into the pg-boss tables that nothing
ever picks up:

- **Recipe import** — `enqueueRecipeImport()` queues and never runs.
- **Nutrition enrichment** — `enqueueNutritionEnrichSafe()` queues and never runs.
- **Anything scheduled** — `boss.schedule()` registers a cron entry, but the cron
  monitor lives in the process that called `boss.start()`. No worker means no
  monitor, and a schedule that fires for nobody.

None of these surface as errors. The API returns 200, the job row sits in
`pgboss.job`, and the work silently never happens.

## Shape of the deployment

One extra Coolify **Application**, from the same repository and the same build
as the API, differing only in start command. Not a separate repo, not a separate
image.

| | API (existing) | Worker (new) |
|---|---|---|
| Base directory | `backend` | `backend` |
| Build command | `npm run build` | `npm run build` |
| Start command | `npm start` | `npm run worker:start` |
| Port exposed | 3000 | 3001 (health only, internal) |
| Public domain | `api.megrob.uk` | **none** |
| Health check path | `/health` | `/health` |

`npm run build` (`tsup src/index.ts src/worker.ts`) already emits both entry
points, so no build change is needed.

## Steps

1. **New resource** → Application → same Git repository and branch (`main`) as
   the existing backend.

2. **Build settings**
   - Base Directory: `backend`
   - Build Command: `npm run build`
   - Start Command: `npm run worker:start`
   - Nixpacks, matching the API. Note the existing convention from
     `mcp-server-plan.md:197`: Coolify builds `backend/` in isolation and
     re-resolves caret ranges, so **new dependencies must be pinned to exact
     versions**. This change adds no new dependencies — `@hono/node-server` and
     `hono` were already backend dependencies.

3. **No public domain.** The worker must not be reachable from the internet. The
   health endpoint carries queue names, worker states and error timings; that is
   internal diagnostics, not something to expose. Leave Domains empty so Coolify
   does not attach it to the proxy.

4. **Environment variables.** The worker needs far less than the API — it
   validates only `DATABASE_URL` at boot, deliberately, so it cannot fail to
   start over an unset `FRONTEND_URL` that could not affect it.

   Required:
   - `DATABASE_URL` — **the same value as the API**, including
     `sslmode=no-verify` (the DB cert is self-signed; see
     `.github/workflows/deploy-migrations.yml`).

   Recommended:
   - `NODE_ENV=production` — switches the logger off `pino-pretty` to JSON.
   - `WORKER_HEALTH_PORT=3001`

   Optional, only if the relevant feature is wanted:
   - `DEEPSEEK_API_KEY` — without it the worker still starts and logs a warning,
     but nutrition enrichment resolves ingredients by cache and Open Food Facts
     only.
   - `PGBOSS_SCHEMA` — only if the API sets it; the two **must** match or they
     will use different queues and never see each other's jobs.

5. **Health check**
   - Path: `/health`
   - Port: `3001`
   - Interval: 30s, Timeout: 5s, Retries: 3
   - Start period: at least 60s — the worker's own startup grace is 60s, and a
     shorter platform start period will kill it mid-boot on a cold database
     (pg-boss runs its schema migrations on first start).

6. **Deploy**, then verify with §"Verifying" below.

## The health check

A worker has no HTTP surface, so the usual options are "is the container
running" or nothing. Neither detects the failure that actually matters here: a
process that is **alive but no longer consuming**, because pg-boss lost its
database connection or the work loop unwound. That looks perfectly healthy from
the outside, and the symptom is silently unprocessed jobs.

`GET /health` on port 3001 reports per-queue worker state derived from
`boss.getWipData()`. The load-bearing field is `lastFetchedOn`: pg-boss assigns
it immediately after every successful fetch and *before* checking whether any
jobs came back (`pg-boss/dist/worker.js`, `this.lastFetchedOn = Date.now()` sits
above the `if (jobs)` branch; the catch path sets `lastErrorOn` instead). So it
advances on empty polls and stops advancing the moment fetching starts failing.

That makes the poll loop its own database health check — if `lastFetchedOn` is
moving, the worker is running *and* Postgres is reachable — so a probe costs no
query at all.

**Status mapping**

| Condition | Status | HTTP |
|---|---|---|
| All expected queues polling recently | `ok` | 200 |
| Worker shutting down (`stopping`) | `degraded` | 200 |
| Job error within the last 5 minutes | `degraded` | 200 |
| No worker registered for an expected queue | `down` | 503 |
| Worker `stopped`, or never started polling | `down` | 503 |
| `lastFetchedOn` older than `WORKER_HEALTH_STALE_MS` | `down` | 503 |

Only a hard `down` returns 503. A graceful redeploy passes through `stopping`,
and failing the probe there would add a spurious alert to every single deploy.

**On the 120s default staleness threshold.** pg-boss's base poll is 2s, but an
idle queue with NOTIFY active falls back to a relaxed backstop of
`max(30_000, pollingInterval)` — so a perfectly healthy idle worker is routinely
up to 30 seconds stale. 120s is 4× that. Anything at or below 60s will flap and
get the worker restart-looped for being idle.

### Verifying

From the Coolify terminal on the worker container:

```sh
curl -s localhost:3001/health | jq
curl -s 'localhost:3001/health?verbose=1' | jq   # adds registered cron schedules
```

Healthy output:

```json
{
  "status": "ok",
  "reasons": [],
  "uptimeMs": 431020,
  "queues": [
    { "queue": "recipe-import",    "state": "active", "lastFetchedAgoMs": 1840, "lastErrorAgoMs": null, "jobsInFlight": 0 },
    { "queue": "nutrition-enrich", "state": "active", "lastFetchedAgoMs": 1841, "lastErrorAgoMs": null, "jobsInFlight": 0 }
  ],
  "checkedAt": "..."
}
```

An unhealthy response says what is wrong rather than just failing:

```json
{ "status": "down", "reasons": ["worker for \"recipe-import\" last polled 200s ago"] }
```

`?verbose=1` additionally lists registered cron schedules — that is the check
that a `boss.schedule()` entry is actually live, and it costs a query, which is
why it is off the default path.

### End-to-end check

The health endpoint proves the worker is polling. To prove it is *processing*,
import a recipe by URL in the app and watch the worker logs. Before this
deployment that request would queue and nothing would happen.

## Local development

`npm run dev` at the repo root already runs `dev:worker` alongside the API, so
the worker and its health endpoint come up automatically:

```sh
curl -s localhost:3001/health | jq
```

`WORKER_HEALTH_PORT` must differ from `PORT` locally, since both processes share
a host. Defaults (3000 / 3001) already do.

## Follow-on

With the worker deployed, `boss.schedule()` becomes usable in production. That
is the prerequisite for the Snozone collector — see `PLAN.md` in the
`snozone-booking` repo, work item A2 — and it also revives the recipe-import and
nutrition-enrichment queues that are inert today.
