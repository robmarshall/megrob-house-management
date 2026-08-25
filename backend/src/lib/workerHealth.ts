import type { WipData, WorkerState } from 'pg-boss';

/**
 * Health assessment for the pg-boss worker process.
 *
 * The worker has no HTTP surface of its own, so a platform health check has
 * nothing to probe and "the container is running" is the only signal available.
 * That signal is close to worthless here: the failure mode that actually costs
 * us data is a process that is alive but no longer consuming — pg-boss lost the
 * database, or the work loop threw and unwound — which looks identical to a
 * healthy worker from the outside.
 *
 * `boss.getWipData()` exposes each registered worker's `lastFetchedOn`, and
 * pg-boss sets it immediately after every successful fetch, *before* checking
 * whether any jobs came back (see pg-boss `dist/worker.js`: `this.lastFetchedOn
 * = Date.now()` sits above the `if (jobs)` branch, and the catch path sets
 * `lastErrorOn` instead). So it advances on empty polls but stops advancing the
 * moment fetching starts failing.
 *
 * That makes the poll loop its own database health check: if `lastFetchedOn` is
 * moving, the worker is running *and* Postgres is reachable. No extra query is
 * issued per probe.
 */

/** Worst-to-best ordering matters: `worst()` relies on this index. */
const LEVELS = ['down', 'degraded', 'ok'] as const;

export type WorkerHealthLevel = (typeof LEVELS)[number];

function worst(a: WorkerHealthLevel, b: WorkerHealthLevel): WorkerHealthLevel {
  return LEVELS.indexOf(a) < LEVELS.indexOf(b) ? a : b;
}

export interface QueueHealth {
  queue: string;
  /** 'missing' when no worker is registered for an expected queue at all. */
  state: WorkerState | 'missing';
  lastFetchedAgoMs: number | null;
  lastErrorAgoMs: number | null;
  jobsInFlight: number;
}

export interface WorkerHealthReport {
  status: WorkerHealthLevel;
  /** Human-readable causes, empty when status is 'ok'. */
  reasons: string[];
  uptimeMs: number;
  queues: QueueHealth[];
  checkedAt: string;
}

export interface AssessOptions {
  /** Queues this process is expected to have registered a worker for. */
  expectedQueues: string[];
  wip: WipData[];
  now: number;
  /** Process start time, used to suppress false alarms while booting. */
  startedAt: number;
  /**
   * How long `lastFetchedOn` may go without advancing before the worker counts
   * as dead. pg-boss's base poll is 2s, but a NOTIFY-active queue falls back to
   * a relaxed backstop of `max(30_000, pollingInterval)` — so an *idle* worker
   * can legitimately be 30s stale. Anything under ~60s would flap.
   */
  staleAfterMs: number;
  /** Grace period after boot before a never-fetched worker is a failure. */
  startupGraceMs: number;
  /** A job error this recent downgrades to 'degraded'. */
  errorWindowMs: number;
}

export const HEALTH_DEFAULTS = {
  staleAfterMs: 120_000,
  startupGraceMs: 60_000,
  errorWindowMs: 300_000,
} as const;

/**
 * Pure assessment — no I/O, so the interesting states (stale, stopped, never
 * started) are unit-testable without a database or a live worker.
 */
export function assessWorkerHealth(opts: AssessOptions): WorkerHealthReport {
  const { expectedQueues, wip, now, startedAt, staleAfterMs, startupGraceMs, errorWindowMs } = opts;

  const uptimeMs = now - startedAt;
  const booting = uptimeMs < startupGraceMs;
  const reasons: string[] = [];
  const queues: QueueHealth[] = [];
  let status: WorkerHealthLevel = 'ok';

  const demote = (level: WorkerHealthLevel, reason: string) => {
    status = worst(status, level);
    reasons.push(reason);
  };

  for (const queue of expectedQueues) {
    const workers = wip.filter((w) => w.name === queue);

    if (workers.length === 0) {
      queues.push({ queue, state: 'missing', lastFetchedAgoMs: null, lastErrorAgoMs: null, jobsInFlight: 0 });
      // Registration happens during boot, so absence is only fatal once booted.
      demote(booting ? 'degraded' : 'down', `no worker registered for queue "${queue}"`);
      continue;
    }

    for (const w of workers) {
      const lastFetchedAgoMs = w.lastFetchedOn === null ? null : now - w.lastFetchedOn;
      const lastErrorAgoMs = w.lastErrorOn == null ? null : now - w.lastErrorOn;

      queues.push({
        queue,
        state: w.state,
        lastFetchedAgoMs,
        lastErrorAgoMs,
        jobsInFlight: w.count,
      });

      if (w.state === 'stopped') {
        demote('down', `worker for "${queue}" is stopped`);
        continue;
      }
      if (w.state === 'stopping') {
        // Expected during a graceful redeploy; do not fail the probe over it.
        demote('degraded', `worker for "${queue}" is shutting down`);
        continue;
      }
      if (w.state === 'created' && !booting) {
        demote('down', `worker for "${queue}" never started polling`);
        continue;
      }

      if (lastFetchedAgoMs === null) {
        if (!booting) demote('down', `worker for "${queue}" has never completed a poll`);
      } else if (lastFetchedAgoMs > staleAfterMs) {
        demote('down', `worker for "${queue}" last polled ${Math.round(lastFetchedAgoMs / 1000)}s ago`);
      }

      if (lastErrorAgoMs !== null && lastErrorAgoMs < errorWindowMs) {
        demote('degraded', `worker for "${queue}" errored ${Math.round(lastErrorAgoMs / 1000)}s ago`);
      }
    }
  }

  // Workers for queues we did not expect are reported but never fail the probe:
  // another process legitimately registering a queue is not this one's problem.
  for (const w of wip) {
    if (expectedQueues.includes(w.name)) continue;
    queues.push({
      queue: w.name,
      state: w.state,
      lastFetchedAgoMs: w.lastFetchedOn === null ? null : now - w.lastFetchedOn,
      lastErrorAgoMs: w.lastErrorOn == null ? null : now - w.lastErrorOn,
      jobsInFlight: w.count,
    });
  }

  return {
    status,
    reasons,
    uptimeMs,
    queues,
    checkedAt: new Date(now).toISOString(),
  };
}

/** HTTP status for a probe: only a hard 'down' should take the container out. */
export function healthHttpStatus(level: WorkerHealthLevel): 200 | 503 {
  return level === 'down' ? 503 : 200;
}
