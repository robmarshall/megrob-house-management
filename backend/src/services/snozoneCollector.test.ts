import { describe, it, expect } from 'vitest';
import { hasSlotChanged, validateReading, type SlotState } from './snozoneCollector.js';
import { normaliseSlot, type NormalisedSlot } from '../lib/snozoneClient.js';
import raw from '../lib/__fixtures__/snozoneTimesRaw.json' with { type: 'json' };

/**
 * Diff and validation logic. DB-free by design: these two functions decide what
 * gets written to a record that cannot be rebuilt, so they are worth testing in
 * isolation rather than only through a live run.
 */

const tomorrow = raw.tomorrow as Record<string, Record<string, unknown>>;
const live = () => normaliseSlot('10:00', tomorrow['10:00']);

function stateOf(slot: NormalisedSlot): SlotState {
  const { time, label, full, ...rest } = slot;
  void time; void label; void full;
  return rest;
}

describe('hasSlotChanged', () => {
  it('writes the first observation of a slot', () => {
    expect(hasSlotChanged(undefined, live())).toBe(true);
  });

  it('does not rewrite an unchanged slot', () => {
    const slot = live();
    expect(hasSlotChanged(stateOf(slot), slot)).toBe(false);
  });

  it('detects a booking', () => {
    const prev = stateOf(live());
    const next = { ...live(), starting: 15, onSlope: 15, qtyAvailable: 65 };
    expect(hasSlotChanged(prev, next)).toBe(true);
  });

  it('detects a cancellation', () => {
    const prev = stateOf(live());
    const next = { ...live(), starting: 13, onSlope: 13, qtyAvailable: 67 };
    expect(hasSlotChanged(prev, next)).toBe(true);
  });

  it('detects carried-over riders changing even when starting does not', () => {
    // A booking on an earlier slot moves fromPrior here without touching
    // starting. That is real occupancy movement and must be recorded.
    const prev = stateOf(live());
    const next = { ...live(), fromPrior: 5, onSlope: 19 };
    expect(hasSlotChanged(prev, next)).toBe(true);
  });

  it('detects state flags flipping', () => {
    const prev = stateOf(live());
    for (const patch of [
      { available: false }, { soldOut: true }, { blocked: true },
      { lowAvailability: true }, { callToBook: true },
    ]) {
      expect(hasSlotChanged(prev, { ...live(), ...patch }), JSON.stringify(patch)).toBe(true);
    }
  });

  it('detects capacity changing', () => {
    // total_qty moving is a lesson block or private hire, not a booking, and
    // it distorts any fill-fraction that ignores it.
    expect(hasSlotChanged(stateOf(live()), { ...live(), totalQty: 60 })).toBe(true);
  });

  it('does not churn on numeric-scale differences in price', () => {
    // Postgres returns numeric(8,2) as '34.90'; upstream may send '34.9'.
    // Comparing raw strings would rewrite every slot on every run forever.
    const prev = { ...stateOf(live()), price: '34.90' };
    expect(hasSlotChanged(prev, { ...live(), price: '34.9' })).toBe(false);
    expect(hasSlotChanged(prev, { ...live(), price: '39.99' })).toBe(true);
  });

  it('treats a price appearing or disappearing as a change', () => {
    const prev = { ...stateOf(live()), price: null };
    expect(hasSlotChanged(prev, { ...live(), price: '34.99' })).toBe(true);
  });

  it('detects the peak/off-peak label changing', () => {
    // slot_type encodes Snozone's own demand model and is a seasonal signal.
    const prev = { ...stateOf(live()), slotType: 'Summer Off Peak' };
    expect(hasSlotChanged(prev, { ...live(), slotType: 'Summer Peak' })).toBe(true);
  });
});

describe('validateReading', () => {
  const slots = Object.entries(tomorrow).map(([t, s]) => normaliseSlot(t, s));
  const full = Array.from({ length: 121 }, (_, i) => ({
    ...normaliseSlot(`${String(10 + Math.floor(i / 12)).padStart(2, '0')}:00`, tomorrow['10:00']),
  }));

  it('accepts a normal reading', () => {
    expect(validateReading({ date: '2026-08-26', slots: full }, 121, 500).ok).toBe(true);
  });

  it('accepts the first ever reading of a date', () => {
    expect(validateReading({ date: '2026-08-26', slots }, 0, 0).ok).toBe(true);
  });

  it('rejects an empty reading', () => {
    const v = validateReading({ date: '2026-08-26', slots: [] }, 121, 500);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/zero slots/);
  });

  it('rejects a collapsed slot count', () => {
    // ~121 slots dropping to a handful is a half-primed session, not a day
    // that suddenly lost its timetable.
    const v = validateReading({ date: '2026-08-26', slots: slots.slice(0, 2) }, 121, 500);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/slot count collapsed/);
  });

  it('rejects occupancy vanishing across every slot', () => {
    const emptied = full.map((s) => ({ ...s, starting: 0, fromPrior: 0, onSlope: 0 }));
    const v = validateReading({ date: '2026-08-26', slots: emptied }, 121, 500);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/occupancy collapsed/);
  });

  it('allows a genuinely quiet future date to read zero', () => {
    // A date far out legitimately has no bookings yet; the guard must only
    // fire when occupancy we previously saw has disappeared.
    const emptied = full.map((s) => ({ ...s, starting: 0, fromPrior: 0, onSlope: 0 }));
    expect(validateReading({ date: '2026-09-24', slots: emptied }, 121, 0).ok).toBe(true);
  });

  it('tolerates a modest slot-count change', () => {
    // Opening hours do shift seasonally; only a collapse is suspicious.
    expect(validateReading({ date: '2026-08-26', slots: full.slice(0, 100) }, 121, 500).ok)
      .toBe(true);
  });
});
