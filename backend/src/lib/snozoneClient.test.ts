import { describe, it, expect } from 'vitest';
import { normaliseSlot, isTrulyFull, SnozoneError } from './snozoneClient.js';
import raw from './__fixtures__/snozoneTimesRaw.json' with { type: 'json' };

/**
 * Normalisation tests against REAL captured upstream data (2026-08-25,
 * Yorkshire, prodid 818). The fixture is trimmed but untouched: field names and
 * values are exactly what Snozone returned.
 *
 * `today.*` slots are all past their booking cutoff and exhibit the expiry
 * corruption in brief.md §10.2a; `tomorrow.*` are live and bookable.
 */

const today = raw.today as Record<string, Record<string, unknown>>;
const tomorrow = raw.tomorrow as Record<string, Record<string, unknown>>;

describe('normaliseSlot', () => {
  it('maps a live bookable slot', () => {
    const s = normaliseSlot('10:00', tomorrow['10:00']);
    expect(s).toMatchObject({
      time: '10:00',
      available: true,
      soldOut: false,
      blocked: false,
      qtyAvailable: 66,
      totalQty: 80,
      starting: 14,
      fromPrior: 0,
      onSlope: 14,
      full: false,
    });
  });

  it('holds the invariant qtyavailable === totalqty - (starting + fromPrior)', () => {
    // brief.md §10.1 states this holds for every bookable slot. If upstream ever
    // breaks it, our occupancy figures stop meaning what we think they mean.
    for (const [time, slot] of Object.entries(tomorrow)) {
      const s = normaliseSlot(time, slot);
      expect(s.qtyAvailable, `slot ${time}`).toBe(s.totalQty - s.onSlope);
    }
  });

  it('counts carried-over riders, not just those starting', () => {
    // The §6 trap: 7 people "in session" at 19:00 but 48 actually on the slope.
    // Reading totalPeopleInSession as occupancy understates it ~7x here.
    const s = normaliseSlot('19:00', tomorrow['19:00']);
    expect(s.starting).toBe(7);
    expect(s.fromPrior).toBe(41);
    expect(s.onSlope).toBe(48);
    expect(s.onSlope).toBeGreaterThan(s.starting * 6);
  });

  it('treats a sold-out slot as unavailable', () => {
    const s = normaliseSlot('10:00', today['10:00']);
    expect(s.available).toBe(false);
    expect(s.soldOut).toBe(true);
  });

  it('treats a blocked-out slot as unavailable', () => {
    const s = normaliseSlot('10:20', today['10:20']);
    expect(s.available).toBe(false);
    expect(s.blocked).toBe(true);
  });

  it('defaults missing fields rather than producing NaN', () => {
    const s = normaliseSlot('12:00', {});
    expect(s).toMatchObject({
      qtyAvailable: 0, totalQty: 0, starting: 0, fromPrior: 0, onSlope: 0,
      available: false, full: false, price: null, reason: '',
    });
    expect(Number.isNaN(s.onSlope)).toBe(false);
  });
});

describe('isTrulyFull', () => {
  it('does not call an expired-but-empty slot full', () => {
    // today's 10:00 reports soldOut with 67 of 80 taken. Those flags are about
    // TIME, not capacity (brief.md §10.2a) — reading them as "full" would
    // record a two-thirds-empty slope as sold out.
    const s = normaliseSlot('10:00', today['10:00']);
    expect(s.soldOut).toBe(true);
    expect(s.onSlope).toBe(67);
    expect(s.totalQty).toBe(80);
    expect(isTrulyFull(s)).toBe(false);
  });

  it('calls a slot full only once the headcount reaches capacity', () => {
    // 10:30 is the poisoned reading: 86 people on an 80-place slope, because
    // peopleFromPriorSession does not decrement as riders leave.
    const s = normaliseSlot('10:30', today['10:30']);
    expect(s.onSlope).toBe(86);
    expect(s.totalQty).toBe(80);
    expect(isTrulyFull(s)).toBe(true);
  });

  it('is false when capacity is unknown', () => {
    expect(isTrulyFull(normaliseSlot('12:00', {}))).toBe(false);
  });
});

describe('SnozoneError', () => {
  it('carries a typed kind and metadata but no session state', () => {
    const err = new SnozoneError('blocked', 'Blocked by bot protection', {
      path: '/booking/ajaxGrouped.php', status: 403,
    });
    expect(err.kind).toBe('blocked');
    expect(err.meta).toEqual({ path: '/booking/ajaxGrouped.php', status: 403 });
    expect(JSON.stringify(err.meta)).not.toMatch(/PHPSESSID/i);
  });
});
