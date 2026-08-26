import { describe, it, expect } from 'vitest';
import {
  backoffMinutes,
  countConsecutiveFailures,
  evaluateGate,
  shouldAlertOnFailure,
  shouldAlertOnRecovery,
  assessCollectorHealth,
  type RunHistoryEntry,
  type RunOutcome,
} from './snozoneHealth.js';

const T0 = new Date('2026-08-26T12:00:00Z');
const minsAgo = (n: number) => new Date(T0.getTime() - n * 60_000);

/** History is most-recent-first; `at` is minutes before T0. */
function h(...entries: [RunOutcome, number][]): RunHistoryEntry[] {
  return entries.map(([status, at]) => ({ status, startedAt: minsAgo(at) }));
}

describe('backoffMinutes', () => {
  it('does not delay after a single failure', () => {
    // The next scheduled run is 30 minutes out regardless — that is already a
    // gentle retry, and delaying further would cost data for a one-off blip.
    expect(backoffMinutes(0)).toBe(0);
    expect(backoffMinutes(1)).toBe(0);
  });

  it('escalates then caps at four hours', () => {
    expect(backoffMinutes(2)).toBe(30);
    expect(backoffMinutes(3)).toBe(60);
    expect(backoffMinutes(4)).toBe(120);
    expect(backoffMinutes(5)).toBe(240);
    expect(backoffMinutes(50)).toBe(240);
  });
});

describe('countConsecutiveFailures', () => {
  it('counts back to the most recent success', () => {
    expect(countConsecutiveFailures(h(['error', 0], ['blocked', 30], ['ok', 60]))).toBe(2);
  });

  it('is zero when the latest run succeeded', () => {
    expect(countConsecutiveFailures(h(['ok', 0], ['error', 30]))).toBe(0);
  });

  it('ignores skipped runs, which are our own backoff not a failure', () => {
    expect(countConsecutiveFailures(h(['skipped', 0], ['skipped', 30], ['blocked', 60], ['ok', 90])))
      .toBe(1);
  });

  it('is zero for an empty history', () => {
    expect(countConsecutiveFailures([])).toBe(0);
  });
});

describe('evaluateGate', () => {
  it('proceeds when healthy', () => {
    expect(evaluateGate(h(['ok', 30]), T0)).toMatchObject({ proceed: true, consecutiveFailures: 0 });
  });

  it('proceeds immediately after a single failure', () => {
    expect(evaluateGate(h(['error', 30], ['ok', 60]), T0).proceed).toBe(true);
  });

  it('holds off while inside the backoff window', () => {
    // Two failures -> 30 min; the last was 10 minutes ago.
    const gate = evaluateGate(h(['blocked', 10], ['blocked', 40], ['ok', 70]), T0);
    expect(gate.proceed).toBe(false);
    expect(gate.consecutiveFailures).toBe(2);
    expect(gate.reason).toMatch(/backing off/);
    expect(gate.retryAfter?.toISOString()).toBe(new Date(minsAgo(10).getTime() + 30 * 60_000).toISOString());
  });

  it('proceeds once the backoff window has elapsed', () => {
    const gate = evaluateGate(h(['blocked', 45], ['blocked', 75], ['ok', 105]), T0);
    expect(gate.proceed).toBe(true);
  });

  it('measures backoff from the last real failure, not the last skip', () => {
    // Skips happen every 30 min while backing off; if they reset the clock the
    // collector would never retry.
    const gate = evaluateGate(h(['skipped', 5], ['blocked', 300], ['blocked', 330], ['ok', 360]), T0);
    expect(gate.proceed).toBe(true);
  });

  it('proceeds on an empty history', () => {
    expect(evaluateGate([], T0).proceed).toBe(true);
  });
});

describe('alert thresholds', () => {
  it('alerts on the third consecutive failure, not the first or second', () => {
    expect(shouldAlertOnFailure(1)).toBe(false);
    expect(shouldAlertOnFailure(2)).toBe(false);
    expect(shouldAlertOnFailure(3)).toBe(true);
  });

  it('does not repeat every run during a long outage', () => {
    expect(shouldAlertOnFailure(4)).toBe(false);
    expect(shouldAlertOnFailure(11)).toBe(false);
    expect(shouldAlertOnFailure(12)).toBe(true);
    expect(shouldAlertOnFailure(24)).toBe(true);
  });

  it('alerts on recovery only if the outage was alerted', () => {
    expect(shouldAlertOnRecovery(0)).toBe(false);
    expect(shouldAlertOnRecovery(2)).toBe(false);
    expect(shouldAlertOnRecovery(3)).toBe(true);
  });
});

describe('assessCollectorHealth', () => {
  it('is ok when a recent run succeeded', () => {
    const r = assessCollectorHealth(h(['ok', 20]), T0);
    expect(r.status).toBe('ok');
    expect(r.reasons).toEqual([]);
    expect(r.minutesSinceLastOk).toBe(20);
  });

  it('degrades when success goes stale', () => {
    expect(assessCollectorHealth(h(['ok', 100]), T0).status).toBe('degraded');
  });

  it('goes down when success goes very stale', () => {
    // The case no error can report: a collector that quietly stopped running.
    const r = assessCollectorHealth(h(['ok', 300]), T0);
    expect(r.status).toBe('down');
    expect(r.reasons[0]).toMatch(/no successful run for 300 minutes/);
  });

  it('goes down after three consecutive failures', () => {
    const r = assessCollectorHealth(h(['error', 5], ['error', 35], ['error', 65], ['ok', 95]), T0);
    expect(r.status).toBe('down');
    expect(r.consecutiveFailures).toBe(3);
  });

  it('degrades on one or two failures', () => {
    expect(assessCollectorHealth(h(['error', 5], ['ok', 35]), T0).status).toBe('degraded');
  });

  it('reports never-run as degraded, not down', () => {
    // Nothing is wrong yet; it just has not started.
    const r = assessCollectorHealth([], T0);
    expect(r.status).toBe('degraded');
    expect(r.reasons).toEqual(['collector has never run']);
  });

  it('reports ran-but-never-succeeded as down', () => {
    const r = assessCollectorHealth(h(['error', 5]), T0);
    expect(r.status).toBe('down');
    expect(r.reasons).toContain('collector has never completed a successful run');
  });

  it('does not let a skip mask a stale success', () => {
    const r = assessCollectorHealth(h(['skipped', 5], ['ok', 300]), T0);
    expect(r.status).toBe('down');
    expect(r.lastRunAt).toEqual(minsAgo(5));
    expect(r.lastOkAt).toEqual(minsAgo(300));
  });
});
