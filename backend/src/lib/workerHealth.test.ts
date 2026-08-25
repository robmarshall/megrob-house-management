import { describe, it, expect } from 'vitest';
import type { WipData } from 'pg-boss';
import {
  assessWorkerHealth,
  healthHttpStatus,
  HEALTH_DEFAULTS,
  type AssessOptions,
} from './workerHealth.js';

/**
 * Unit tests for the worker health assessment. Deliberately DB-free: the states
 * worth checking (stale, stopped, never-polled) are exactly the ones that are
 * awkward to reproduce against a live worker, so the assessment is a pure
 * function over fabricated WipData.
 */

const NOW = 1_800_000_000_000;
const QUEUE = 'recipe-import';

function wip(over: Partial<WipData> = {}): WipData {
  return {
    id: 'worker-1',
    workId: 'work-1',
    name: QUEUE,
    options: {},
    state: 'active',
    count: 0,
    createdOn: NOW - 600_000,
    lastFetchedOn: NOW - 2_000,
    lastJobStartedOn: null,
    lastJobEndedOn: null,
    lastJobDuration: null,
    lastError: null,
    lastErrorOn: null,
    ...over,
  } as WipData;
}

function assess(over: Partial<AssessOptions> = {}) {
  return assessWorkerHealth({
    expectedQueues: [QUEUE],
    wip: [wip()],
    now: NOW,
    startedAt: NOW - 600_000, // booted 10 minutes ago
    ...HEALTH_DEFAULTS,
    ...over,
  });
}

describe('assessWorkerHealth', () => {
  it('reports ok for an active worker polling normally', () => {
    const r = assess();
    expect(r.status).toBe('ok');
    expect(r.reasons).toEqual([]);
    expect(r.queues[0]).toMatchObject({ queue: QUEUE, state: 'active', lastFetchedAgoMs: 2_000 });
  });

  it('tolerates a 30s idle gap — the NOTIFY backstop poll, not a fault', () => {
    // pg-boss relaxes an idle notify-active queue to max(30_000, pollingInterval),
    // so a healthy worker can legitimately be this stale. A 60s threshold would flap.
    expect(assess({ wip: [wip({ lastFetchedOn: NOW - 31_000 })] }).status).toBe('ok');
  });

  it('goes down when the poll loop stops advancing', () => {
    const r = assess({ wip: [wip({ lastFetchedOn: NOW - 121_000 })] });
    expect(r.status).toBe('down');
    expect(r.reasons[0]).toMatch(/last polled 121s ago/);
  });

  it('goes down when no worker is registered for an expected queue', () => {
    const r = assess({ wip: [] });
    expect(r.status).toBe('down');
    expect(r.reasons[0]).toMatch(/no worker registered/);
    expect(r.queues[0].state).toBe('missing');
  });

  it('goes down for a stopped worker', () => {
    expect(assess({ wip: [wip({ state: 'stopped' })] }).status).toBe('down');
  });

  it('treats a shutting-down worker as degraded, not down', () => {
    // A graceful redeploy passes through 'stopping'; failing the probe there
    // would just add a spurious alert to every deploy.
    const r = assess({ wip: [wip({ state: 'stopping' })] });
    expect(r.status).toBe('degraded');
    expect(healthHttpStatus(r.status)).toBe(200);
  });

  it('suppresses false alarms during the startup grace period', () => {
    const booting = { now: NOW, startedAt: NOW - 5_000 };
    // Registered but has not completed a first poll yet.
    expect(assess({ ...booting, wip: [wip({ state: 'created', lastFetchedOn: null })] }).status).toBe('ok');
    // Not yet registered at all — suspicious, but not fatal this early.
    expect(assess({ ...booting, wip: [] }).status).toBe('degraded');
  });

  it('fails a worker that never polled once the grace period has passed', () => {
    const r = assess({ wip: [wip({ state: 'created', lastFetchedOn: null })] });
    expect(r.status).toBe('down');
    expect(r.reasons[0]).toMatch(/never started polling/);
  });

  it('degrades on a recent error but stays serving', () => {
    const r = assess({ wip: [wip({ lastErrorOn: NOW - 10_000, lastError: { message: 'boom' } })] });
    expect(r.status).toBe('degraded');
    expect(r.reasons[0]).toMatch(/errored 10s ago/);
    expect(healthHttpStatus(r.status)).toBe(200);
  });

  it('ignores an error older than the error window', () => {
    expect(assess({ wip: [wip({ lastErrorOn: NOW - 400_000 })] }).status).toBe('ok');
  });

  it('reports unexpected queues without failing the probe', () => {
    const r = assess({ wip: [wip(), wip({ name: 'some-other-queue', id: 'worker-2' })] });
    expect(r.status).toBe('ok');
    expect(r.queues.map((q) => q.queue)).toContain('some-other-queue');
  });

  it('takes the worst status across multiple queues', () => {
    const r = assess({
      expectedQueues: [QUEUE, 'nutrition-enrich'],
      wip: [wip(), wip({ name: 'nutrition-enrich', id: 'worker-2', state: 'stopped' })],
    });
    expect(r.status).toBe('down');
    expect(r.queues).toHaveLength(2);
  });

  it('maps only a hard down to 503', () => {
    expect(healthHttpStatus('ok')).toBe(200);
    expect(healthHttpStatus('degraded')).toBe(200);
    expect(healthHttpStatus('down')).toBe(503);
  });
});
