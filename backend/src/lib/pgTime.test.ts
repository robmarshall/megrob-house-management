import { describe, it, expect } from 'vitest';
import { toIso, toDate } from './pgTime.js';

/**
 * Timestamp coercion for raw-SQL rows.
 *
 * Worth pinning down because the failure mode is invisible: every timestamp on
 * the collector-health endpoint's raw-SQL rows came back `null` in production
 * while the typed-builder timestamps beside them rendered normally, so the
 * admin panel looked merely sparse rather than broken. The two shapes below
 * are the two that actually arrive — Drizzle's typed queries yield `Date`,
 * `db.execute()` yields postgres-js's own string — and the offset padding is
 * what the first fix missed.
 */
describe('toIso', () => {
  it('renders a Date as ISO', () => {
    const d = new Date('2026-08-26T08:32:05.948Z');
    expect(toIso(d)).toBe('2026-08-26T08:32:05.948Z');
  });

  it('parses postgres-js timestamptz, whose offset is two digits', () => {
    // The exact string the driver hands back for a timestamptz column. The
    // space is what Safari rejects; the bare '+00' is what V8 rejects once
    // that space becomes a 'T'.
    expect(toIso('2026-08-26 08:32:05.948+00')).toBe('2026-08-26T08:32:05.948Z');
  });

  it('respects a non-UTC offset rather than assuming Z', () => {
    expect(toIso('2026-08-26 09:32:05.948+01')).toBe('2026-08-26T08:32:05.948Z');
    expect(toIso('2026-08-26 03:32:05.948-05')).toBe('2026-08-26T08:32:05.948Z');
  });

  it('accepts an offset that is already fully qualified', () => {
    expect(toIso('2026-08-26T08:32:05.948+00:00')).toBe('2026-08-26T08:32:05.948Z');
    expect(toIso('2026-08-26T08:32:05.948Z')).toBe('2026-08-26T08:32:05.948Z');
  });

  it('returns null for absent values', () => {
    expect(toIso(null)).toBeNull();
    expect(toIso(undefined)).toBeNull();
  });

  it('returns null rather than "Invalid Date" for junk', () => {
    expect(toIso('not a timestamp')).toBeNull();
    expect(toIso(new Date('nonsense'))).toBeNull();
  });
});

describe('toDate', () => {
  it('returns a Date for both shapes, and null for neither', () => {
    expect(toDate('2026-08-26 08:32:05.948+00')?.toISOString())
      .toBe('2026-08-26T08:32:05.948Z');
    const d = new Date('2026-08-26T08:32:05.948Z');
    expect(toDate(d)).toBe(d);
    expect(toDate(null)).toBeNull();
    expect(toDate('nonsense')).toBeNull();
  });
});
