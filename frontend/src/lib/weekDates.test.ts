import { describe, it, expect } from 'vitest';
import {
  toLocalISODate,
  getMonday,
  getDayDate,
  getWeekEndDate,
} from './weekDates';

describe('toLocalISODate', () => {
  it('formats a locally-constructed date to its local calendar date', () => {
    expect(toLocalISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toLocalISODate(new Date(2026, 2, 9))).toBe('2026-03-09');
  });

  it('keeps the same local day for a late-evening time (regression guard)', () => {
    // The old `toISOString()` implementation would roll this to the next day
    // for users at positive UTC offsets. Local-component formatting must not.
    expect(toLocalISODate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('zero-pads month and day', () => {
    expect(toLocalISODate(new Date(2026, 8, 3))).toBe('2026-09-03');
  });
});

describe('getMonday', () => {
  it('returns the Monday of the week for a mid-week date', () => {
    // Wednesday 2026-01-07 -> Monday 2026-01-05
    expect(toLocalISODate(getMonday(new Date(2026, 0, 7)))).toBe('2026-01-05');
  });

  it('maps a Sunday back to the prior Monday', () => {
    // Sunday 2026-01-11 -> Monday 2026-01-05 (day === 0 ? -6 : 1)
    expect(toLocalISODate(getMonday(new Date(2026, 0, 11)))).toBe('2026-01-05');
  });

  it('returns a Date at local midnight', () => {
    expect(getMonday(new Date(2026, 0, 7, 14, 45)).getHours()).toBe(0);
  });
});

describe('getDayDate / getWeekEndDate', () => {
  const monday = getMonday(new Date(2026, 0, 7)); // 2026-01-05

  it('getDayDate(monday, 0) equals toLocalISODate(monday)', () => {
    expect(getDayDate(monday, 0)).toBe(toLocalISODate(monday));
  });

  it('getDayDate(monday, 6) equals getWeekEndDate(monday)', () => {
    expect(getDayDate(monday, 6)).toBe(getWeekEndDate(monday));
  });
});
