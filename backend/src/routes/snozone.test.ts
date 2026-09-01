import { describe, it, expect } from 'vitest';
import { isValidDate, parseAfter, parseRange } from './snozone.js';

/**
 * The pure request-parsing helpers. `parseAfter` in particular guards a real
 * seam: the ranking inherited phase 0's bare-hour tunable (AFTER_HOUR = 16)
 * while a UI naturally sends a clock time, and getting that wrong turns every
 * recommendation request into a 400.
 */

describe('isValidDate', () => {
  it('accepts real dates', () => {
    for (const d of ['2026-08-26', '2026-02-28', '2024-02-29']) {
      expect(isValidDate(d), d).toBe(true);
    }
  });

  it('rejects malformed input', () => {
    for (const d of ['', '2026-8-26', '26-08-2026', 'today', '2026-08-26T00:00:00Z']) {
      expect(isValidDate(d), d).toBe(false);
    }
  });

  it('rejects dates that do not exist', () => {
    // A regex alone would accept these; the Date round-trip is what catches them.
    for (const d of ['2026-02-30', '2026-13-01', '2026-04-31', '2026-02-29']) {
      expect(isValidDate(d), d).toBe(false);
    }
  });
});

describe('parseAfter', () => {
  it('falls back when absent', () => {
    expect(parseAfter(undefined, 16)).toBe(16);
    expect(parseAfter('', 16)).toBe(16);
  });

  it('accepts a bare hour, as phase 0 expressed it', () => {
    expect(parseAfter('16', 0)).toBe(16);
    expect(parseAfter('0', 16)).toBe(0);
    expect(parseAfter('23', 16)).toBe(23);
  });

  it('accepts a clock time, as a UI would send it', () => {
    expect(parseAfter('16:00', 0)).toBe(16);
    expect(parseAfter('09:00', 0)).toBe(9);
    expect(parseAfter('9:00', 0)).toBe(9);
  });

  it('resolves a half hour to a fraction the ranking can use', () => {
    // The comparison is `mins >= after * 60`, so 16.5 means 990 minutes.
    expect(parseAfter('16:30', 0)).toBe(16.5);
    expect(parseAfter('16:45', 0)).toBe(16.75);
  });

  it('rejects out-of-range and nonsense values', () => {
    for (const bad of ['24:00', '16:60', '25', '-1', 'evening', '16:0', '::']) {
      expect(parseAfter(bad, 16), bad).toBeNull();
    }
  });
});

describe('parseRange', () => {
  const TODAY = '2026-09-01';

  it('defaults to the last year ending today', () => {
    expect(parseRange(undefined, undefined, TODAY)).toEqual({
      from: '2025-09-01',
      to: TODAY,
    });
  });

  it('accepts an explicit range', () => {
    expect(parseRange('2026-08-01', '2026-08-31', TODAY)).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('defaults only the end that is missing', () => {
    expect(parseRange('2026-08-01', undefined, TODAY)).toEqual({
      from: '2026-08-01',
      to: TODAY,
    });
    expect(parseRange(undefined, '2026-08-31', TODAY)).toEqual({
      from: '2025-08-31',
      to: '2026-08-31',
    });
  });

  it('rejects a malformed date rather than silently widening the window', () => {
    // A typo that fell back to the default would quietly answer a different
    // question than the one asked, which is worse than a 400.
    expect(parseRange('2026-8-1', undefined, TODAY)).toBeNull();
    expect(parseRange(undefined, 'yesterday', TODAY)).toBeNull();
    expect(parseRange('2026-02-30', undefined, TODAY)).toBeNull();
  });

  it('rejects a backwards range', () => {
    expect(parseRange('2026-08-31', '2026-08-01', TODAY)).toBeNull();
  });

  it('allows a single-day range', () => {
    expect(parseRange('2026-08-15', '2026-08-15', TODAY)).toEqual({
      from: '2026-08-15',
      to: '2026-08-15',
    });
  });
});
