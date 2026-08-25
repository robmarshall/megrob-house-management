# Deploying the pg-boss worker to Coolify

## Current state

**The worker is deployed and working.** Verified directly in Coolify on
2026-08-25 (`megrob.uk` → `production` → `megrob-worker`).

`docs/mcp-server-plan.md:206-207` says the opposite — that the worker "is not
wired up as a Coolify resource in prod". **That note is stale.** It was written
before the resource existed, and taking it at face value leads to the wrong
conclusion that recipe import and nutrition enrichment are inert in production.
They are not; the worker logs show both completing.

Verified running config:

| Setting | Value |
|---|---|
| Application | `megrob-worker` (project `megrob.uk`, env `production`) |
| Repository / branch | `robmarshall/megrob-house-management` / `main` @ `HEAD` |
| Build Pack | Nixpacks |
| Base Directory | `/backend` |
| Install / Build / Start | `npm install` / `npm run build` / `npm run worker:start` |
| Env | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `FRONTEND_URL`, `PORT`, `DEEPSEEK_API_KEY`, `NIXPACKS_NODE_VERSION` |

Worker logs confirm it is consuming, not merely running:

```
{"queues":["recipe-import","nutrition-enrich"],"msg":"Worker started"}
{"recipeId":6,"name":"Oreo cheesecake","msg":"Successfully imported recipe"}
{"matchedCount":6,"totalCount":6,"estimated":true,"msg":"Nutrition enrichment complete"}
```

So `boss.schedule()` **will** fire in production, and anything reaching
`enqueue*()` is processed.

## The gap that remains

Coolify reports the worker as **"Running (unknown)"** with a warning, because
its health check is **disabled**. "Running" here means only that the container
process has not exited.

That is the weak spot. The failure mode for a queue consumer is not the process
dying — Coolify would restart that — it is the process staying alive while no
longer consuming, because pg-boss lost the database or the work loop unwound.
Nothing in the current setup can tell the difference, and the symptom is jobs
silently accumulating unprocessed. For the Snozone collector, which depends on
`boss.schedule()`, that would mean silently collecting nothing while the
dashboard shows green.

This document covers closing that gap.

## Steps to close it

> **Done — 2026-08-25.** All steps below were carried out. The worker now reports
> **`Running (healthy)`** in Coolify. Kept as the record of what was changed, and
> as the procedure if it ever has to be redone.
>
> ```
> Healthcheck URL (inside the container): GET: http://localhost:3001/health
> Waiting for the start period (60 seconds) before starting healthcheck.
> "healthy"  →  New container is healthy.  →  Rolling update completed.
> ```
>
> Docker's own probe log showed `ExitCode: 0` at 22:21:21 and 22:21:51 — 30s
> apart, matching the configured interval. Step 6 (removing the public domain)
> was **not** done and is not needed: Coolify proxies that domain to the app's
> configured port, not 3001, so the endpoint is not publicly reachable. Verified
> by an external request returning 502 while the endpoint was serving fine
> inside the container.

Order matters. The health endpoint ships in application code, so it must be
**deployed before the check is enabled** — otherwise Coolify probes a port
nothing is listening on, marks the container unhealthy, and restart-loops a
worker that was working fine.

1. **Merge the health endpoint to `main`.** The worker deploys from
   `main` @ `HEAD`, so nothing reaches production until the branch lands. This
   adds no new dependencies — `hono` and `@hono/node-server` were already
   backend dependencies, which matters given the convention in
   `mcp-server-plan.md:197` (Coolify builds `backend/` in isolation and
   re-resolves caret ranges, so new deps must be pinned exactly).

2. **Add `WORKER_HEALTH_PORT=3001`** to the worker's environment variables.
   Strictly optional — 3001 is the default — but explicit beats implicit for a
   value the platform health check has to match. Do **not** reuse `PORT`, which
   is already set for the API's sake.

3. **Deploy / redeploy the worker.** Confirm from the logs that it comes up:
   `Worker health endpoint listening` alongside the existing `Worker started`.

4. **Verify the endpoint before wiring the platform to it** (see §Verifying).
   If this step does not return 200, stop — enabling the check now would take a
   healthy worker offline.

5. **Enable the health check**, with these values rather than the defaults:

   | Field | Default | Set to | Why |
   |---|---|---|---|
   | Path | `/health` | `/health` | correct already |
   | Port | *(empty → 80)* | **3001** | nothing serves 80 |
   | Interval | 5s | **30s** | 5s is needless probe traffic |
   | Timeout | 5s | 5s | fine |
   | Retries | 10 | **3** | 10 × 30s = 5 min to notice |
   | Start Period | 5s | **60s** | see below |

   The start period must be at least 60s: the worker's own startup grace is 60s,
   and pg-boss runs its schema migrations on a cold start. A 5s start period will
   kill it mid-boot.

6. ~~**Consider removing the public domain.**~~ **Not needed.** The worker has
   `http://m0gs0gwgkw0scg40k4swso0k.168.231.79.120.sslip.io` attached, and the
   concern was that it would expose queue names and worker states once something
   was listening. It does not: Coolify proxies that domain to the application's
   configured port, not to 3001, so an external request returns 502 while the
   endpoint serves normally inside the container. The health check probes
   `localhost` from within the container and never touches the proxy. Leave the
   domain alone — but if the proxied port is ever pointed at 3001, revisit this.

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
import a recipe by URL in the app and watch the worker logs for
`Successfully imported recipe`.

## Local development

`npm run dev` at the repo root already runs `dev:worker` alongside the API, so
the worker and its health endpoint come up automatically:

```sh
curl -s localhost:3001/health | jq
```

`WORKER_HEALTH_PORT` must differ from `PORT` locally, since both processes share
a host. Defaults (3000 / 3001) already do.

## Follow-on

`boss.schedule()` is already usable in production, since the worker is running.
That prerequisite for the Snozone collector (`PLAN.md` in the `snozone-booking`
repo) is therefore **already satisfied** — what the health check adds is the
ability to notice when the collector stops collecting, which for a job whose
data cannot be backfilled is worth having before it starts rather than after.
