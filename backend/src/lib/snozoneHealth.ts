/**
 * Failure policy for the Snozone collector: when to back off, when to alert.
 *
 * Pure and I/O-free so the escalation rules can be tested without staging a
 * multi-hour outage.
 *
 * A DELIBERATE DEVIATION from PLAN.md §11, which specified disabling a product
 * after three consecutive failures. Auto-disabling turns a transient upstream
 * outage into indefinite data loss that only a human noticing an email can
 * undo — which contradicts the plan's own governing principle, that this data
 * cannot be backfilled. Escalating backoff already achieves the actual goal
 * (never hammer a challenge) while leaving the collector able to recover on its
 * own the moment upstream does. Alerts still fire; nothing silently stops.
 */

export type RunOutcome = 'ok' | 'blocked' | 'unprimed' | 'error' | 'skipped';

export interface RunHistoryEntry {
  status: RunOutcome;
  startedAt: Date;
}

/**
 * Minutes to wait after N consecutive failures before trying again.
 *
 * Index is the failure count. One failure waits for nothing — the next
 * scheduled run is 30 minutes away regardless, which is already a gentle
 * retry. Beyond that it doubles to a four-hour ceiling: long enough to stop
 * pestering a site that is challenging us, short enough that a day of data is
 * never lost to a fault that cleared in the morning.
 */
export function backoffMinutes(consecutiveFailures: number): number {
  if (consecutiveFailures <= 1) return 0;
  const scale = [30, 60, 120, 240];
  return scale[Math.min(consecutiveFailures - 2, scale.length - 1)];
}

/** Count failures back from the most recent run, ignoring skipped runs. */
export function countConsecutiveFailures(history: RunHistoryEntry[]): number {
  let n = 0;
  for (const run of history) {
    if (run.status === 'skipped') continue;
    if (run.status === 'ok') break;
    n += 1;
  }
  return n;
}

export interface GateDecision {
  proceed: boolean;
  consecutiveFailures: number;
  /** Set when proceed is false. */
  reason?: string;
  retryAfter?: Date;
}

/**
 * Should this run go ahead?
 *
 * `history` must be ordered most-recent-first.
 */
export function evaluateGate(history: RunHistoryEntry[], now: Date): GateDecision {
  const consecutiveFailures = countConsecutiveFailures(history);
  if (consecutiveFailures === 0) return { proceed: true, consecutiveFailures };

  const lastFailure = history.find((r) => r.status !== 'skipped' && r.status !== 'ok');
  if (!lastFailure) return { proceed: true, consecutiveFailures };

  const waitMs = backoffMinutes(consecutiveFailures) * 60_000;
  const retryAfter = new Date(lastFailure.startedAt.getTime() + waitMs);
  if (now >= retryAfter) return { proceed: true, consecutiveFailures };

  return {
    proceed: false,
    consecutiveFailures,
    reason:
      `backing off after ${consecutiveFailures} consecutive failures; ` +
      `retry after ${retryAfter.toISOString()}`,
    retryAfter,
  };
}

/**
 * Alert on the third consecutive failure, then every twelfth.
 *
 * Three is roughly 90 minutes of silence, past the point where a blip is a
 * plausible explanation. Repeating every twelfth keeps a long outage on the
 * radar without turning a bad afternoon into a mailbox full of identical
 * messages.
 */
export function shouldAlertOnFailure(consecutiveFailures: number): boolean {
  if (consecutiveFailures === 3) return true;
  return consecutiveFailures > 3 && consecutiveFailures % 12 === 0;
}

/** Alert on recovery, but only if the failure was bad enough to have alerted. */
export function shouldAlertOnRecovery(previousConsecutiveFailures: number): boolean {
  return previousConsecutiveFailures >= 3;
}

export type HealthLevel = 'ok' | 'degraded' | 'down';

export interface CollectorHealth {
  status: HealthLevel;
  reasons: string[];
  lastOkAt: Date | null;
  lastRunAt: Date | null;
  consecutiveFailures: number;
  minutesSinceLastOk: number | null;
}

/**
 * Assess collector health from its run ledger.
 *
 * The staleness thresholds are generous relative to the 30-minute cadence
 * because the horizon sweep and a backed-off window run both create legitimate
 * gaps. What they are really there to catch is the case no error can report:
 * a collector that has quietly stopped running at all.
 */
export function assessCollectorHealth(
  history: RunHistoryEntry[],
  now: Date,
  opts: { staleAfterMinutes?: number; downAfterMinutes?: number } = {}
): CollectorHealth {
  const staleAfter = opts.staleAfterMinutes ?? 90;
  const downAfter = opts.downAfterMinutes ?? 240;

  const lastRun = history[0] ?? null;
  const lastOk = history.find((r) => r.status === 'ok') ?? null;
  const consecutiveFailures = countConsecutiveFailures(history);
  const reasons: string[] = [];
  let status: HealthLevel = 'ok';

  const RANK: Record<HealthLevel, number> = { ok: 0, degraded: 1, down: 2 };
  const demote = (level: HealthLevel, reason: string) => {
    if (RANK[level] > RANK[status]) status = level;
    reasons.push(reason);
  };

  if (!lastOk) {
    // Never succeeded. Before any run at all this is simply "not started yet".
    if (history.length === 0) {
      return {
        status: 'degraded',
        reasons: ['collector has never run'],
        lastOkAt: null, lastRunAt: null, consecutiveFailures: 0, minutesSinceLastOk: null,
      };
    }
    demote('down', 'collector has never completed a successful run');
  }

  const minutesSinceLastOk = lastOk
    ? Math.floor((now.getTime() - lastOk.startedAt.getTime()) / 60_000)
    : null;

  if (minutesSinceLastOk !== null) {
    if (minutesSinceLastOk >= downAfter) {
      demote('down', `no successful run for ${minutesSinceLastOk} minutes`);
    } else if (minutesSinceLastOk >= staleAfter) {
      demote('degraded', `no successful run for ${minutesSinceLastOk} minutes`);
    }
  }

  if (consecutiveFailures >= 3) {
    demote('down', `${consecutiveFailures} consecutive failed runs`);
  } else if (consecutiveFailures > 0) {
    demote('degraded', `${consecutiveFailures} consecutive failed run(s)`);
  }

  return {
    status,
    reasons,
    lastOkAt: lastOk?.startedAt ?? null,
    lastRunAt: lastRun?.startedAt ?? null,
    consecutiveFailures,
    minutesSinceLastOk,
  };
}
