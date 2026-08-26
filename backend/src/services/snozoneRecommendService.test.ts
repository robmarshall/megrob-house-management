import { describe, it, expect } from 'vitest';
import {
  rankPresenceWindows,
  occupancyWindowStats,
  presenceWindow,
  DEFAULT_RECOMMEND_PARAMS,
  type RecommendSlotInput,
  type RecommendParams,
} from './snozoneRecommendService.js';
import { normaliseSlot } from '../lib/snozoneClient.js';
import type { VenueNow } from '../lib/snozoneWindow.js';
import raw from '../lib/__fixtures__/snozoneTimesRaw.json' with { type: 'json' };

/**
 * The presence-window ranking, ported from phase 0's app.js (see
 * snozoneRecommendService.ts's module doc). DB-free by design: it is the
 * subtlest logic in the project, so it is worth pinning down exactly.
 */

const DATE = '2026-08-25';
const nowAt = (minutes: number, date = DATE): VenueNow => ({ date, minutes });

function timeOf(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/** A full published day, 10:00-20:00 on the real 5-minute grid. */
function daySlots(
  onSlopeAt: (mins: number) => number,
  opts: { totalQty?: number; unavailable?: Set<string> } = {}
): RecommendSlotInput[] {
  const { totalQty = 80, unavailable = new Set<string>() } = opts;
  const slots: RecommendSlotInput[] = [];
  for (let m = 10 * 60; m <= 20 * 60; m += 5) {
    const time = timeOf(m);
    slots.push({ time, onSlope: onSlopeAt(m), available: !unavailable.has(time), totalQty });
  }
  return slots;
}

// A day that is busy (60) everywhere except a quiet trough (10) centred on
// 18:40 (mins 1120), +/- 60 minutes either side (17:40-19:40).
const QUIET_CENTRE = 18 * 60 + 40;
const QUIET_HALF_WIDTH = 60;
const busyDay = () =>
  daySlots((m) => (Math.abs(m - QUIET_CENTRE) <= QUIET_HALF_WIDTH ? 10 : 60));

describe('occupancyWindowStats', () => {
  it('reports full coverage when the window sits entirely inside the data', () => {
    const pts = [
      { mins: 100, onSlope: 4 },
      { mins: 105, onSlope: 6 },
      { mins: 110, onSlope: 8 },
    ];
    const stats = occupancyWindowStats(pts, 100, 115)!;
    expect(stats.avg).toBeCloseTo(6);
    expect(stats.peak).toBe(8);
    expect(stats.min).toBe(4);
    expect(stats.complete).toBe(true);
  });

  it('reports partial coverage when the published day runs out early', () => {
    // Window wants [100, 130) but data stops at 110 (+5 = 115 covered).
    const pts = [{ mins: 100, onSlope: 4 }, { mins: 105, onSlope: 6 }, { mins: 110, onSlope: 8 }];
    const stats = occupancyWindowStats(pts, 100, 130)!;
    expect(stats.coverageMinutes).toBe(15);
    expect(stats.complete).toBe(false);
  });

  it('returns null when nothing falls in the window', () => {
    expect(occupancyWindowStats([{ mins: 10, onSlope: 1 }], 100, 130)).toBeNull();
  });
});

describe('presenceWindow', () => {
  it('spans early minutes before the start to session+stay after it', () => {
    const params: RecommendParams = { after: 16, session: 60, early: 15, stay: 10 };
    expect(presenceWindow(18 * 60, params)).toEqual({ from: 18 * 60 - 15, to: 18 * 60 + 70 });
  });
});

describe('rankPresenceWindows', () => {
  it('picks the earliest fully-quiet presence window, not just the quietest instant', () => {
    const slots = busyDay();
    const now = nowAt(9 * 60); // well before opening; nothing is expired
    const result = rankPresenceWindows(slots, DATE, now, DEFAULT_RECOMMEND_PARAMS);

    // Windows starting 17:55-18:30 sit entirely inside the quiet trough
    // (start-15 >= 1060 and start+70 <= 1180), so they tie on avg (10) and
    // peak (10); the earliest, 17:55, must win the tie-break.
    expect(result.pick).not.toBeNull();
    expect(result.pick!.time).toBe('17:55');
    expect(result.pick!.avgOnSlope).toBe(10);
    expect(result.pick!.peakOnSlope).toBe(10);
    expect(result.pick!.capacity).toBe(80);
    expect(result.pick!.presenceFrom).toBe('17:40');
    expect(result.pick!.presenceTo).toBe('19:05');

    // The tied candidates come first, in ascending start-time order.
    const tiedTimes = result.ranked.filter((p) => p.avgOnSlope === 10).map((p) => p.time);
    expect(tiedTimes).toEqual([
      '17:55', '18:00', '18:05', '18:10', '18:15', '18:20', '18:25', '18:30', '18:35',
    ]);
    expect(result.ranked.length).toBeLessThanOrEqual(10);
    // No candidate outside the trough can beat the tied ones.
    for (let i = 1; i < result.ranked.length; i++) {
      expect(result.ranked[i].avgOnSlope).toBeGreaterThanOrEqual(result.ranked[i - 1].avgOnSlope);
    }
  });

  it('skips an unavailable slot in favour of the next-quietest one', () => {
    const slots = daySlots((m) => (Math.abs(m - QUIET_CENTRE) <= QUIET_HALF_WIDTH ? 10 : 60), {
      unavailable: new Set(['17:55']),
    });
    const now = nowAt(9 * 60);
    const result = rankPresenceWindows(slots, DATE, now, DEFAULT_RECOMMEND_PARAMS);
    expect(result.pick!.time).toBe('18:00');
    expect(result.ranked.some((p) => p.time === '17:55')).toBe(false);
  });

  it('excludes a slot once it has started, however quiet it reads', () => {
    // Cutoff removed (after: 0) so only expiry decides.
    const params: RecommendParams = { after: 0, session: 60, early: 15, stay: 10 };
    const slots = daySlots(() => 5); // uniformly quiet, so expiry is the only filter
    const now = nowAt(11 * 60); // 11:00 local -> every slot before 11:00 has started
    const result = rankPresenceWindows(slots, DATE, now, params);
    expect(result.ranked.every((p) => p.time >= '11:00')).toBe(true);
    expect(result.ranked.some((p) => p.time < '11:00')).toBe(false);
  });

  it('reports confidence "none" and no pick when nothing is bookable', () => {
    const slots = daySlots(() => 5, { unavailable: new Set(daySlots(() => 5).map((s) => s.time)) });
    const result = rankPresenceWindows(slots, DATE, nowAt(9 * 60), DEFAULT_RECOMMEND_PARAMS);
    expect(result.pick).toBeNull();
    expect(result.ranked).toEqual([]);
    expect(result.confidence).toBe('none');
    expect(result.note).toMatch(/no bookable slots/i);
  });

  it('reports confidence "none" for a date far out with near-zero occupancy', () => {
    // Realistic future-date shape: almost nobody has booked yet (brief §10.5a).
    const slots = daySlots(() => 0);
    const farDate = '2026-09-05'; // well beyond the "beyond ~2 days" boundary
    const result = rankPresenceWindows(slots, farDate, nowAt(9 * 60, DATE), DEFAULT_RECOMMEND_PARAMS);
    expect(result.confidence).toBe('none');
    expect(result.pick).toBeNull();
    expect(result.note).toMatch(/days out/i);
    // The ranked list can still be populated (it's just not a confident pick).
    expect(result.ranked.length).toBeGreaterThan(0);
  });

  it('reports confidence "thin" for modest same-day occupancy', () => {
    // Enough of a signal to be above "none" but not a lot of data yet.
    const slots = daySlots((m) => (m === QUIET_CENTRE ? 1 : 0));
    const result = rankPresenceWindows(slots, DATE, nowAt(9 * 60), DEFAULT_RECOMMEND_PARAMS);
    expect(result.confidence).toBe('thin');
  });

  it('reports confidence "good" for a well-populated near date', () => {
    const result = rankPresenceWindows(busyDay(), DATE, nowAt(9 * 60), DEFAULT_RECOMMEND_PARAMS);
    expect(result.confidence).toBe('good');
    expect(result.note).toBeNull();
  });

  it('respects custom tunables (after/session/early/stay)', () => {
    const params: RecommendParams = { after: 10, session: 30, early: 5, stay: 5 };
    const slots = busyDay();
    const result = rankPresenceWindows(slots, DATE, nowAt(9 * 60), params);
    expect(result.pick).not.toBeNull();
    // Window span is now 5+30+5 = 40 minutes; coverage floor is session/2 = 15.
    const span =
      (Number(result.pick!.presenceTo.slice(0, 2)) * 60 + Number(result.pick!.presenceTo.slice(3))) -
      (Number(result.pick!.presenceFrom.slice(0, 2)) * 60 + Number(result.pick!.presenceFrom.slice(3)));
    expect(span).toBe(40);
  });
});

describe('rankPresenceWindows against the real captured fixture', () => {
  const tomorrow = raw.tomorrow as Record<string, Record<string, unknown>>;
  const today = raw.today as Record<string, Record<string, unknown>>;

  function toInput(entries: Record<string, Record<string, unknown>>): RecommendSlotInput[] {
    return Object.entries(entries).map(([time, r]) => {
      const s = normaliseSlot(time, r);
      return { time: s.time, onSlope: s.onSlope, available: s.available, totalQty: s.totalQty };
    });
  }

  it('reports no candidates from the sparse two-slot tomorrow fixture (insufficient window coverage)', () => {
    // Only 10:00 and 19:00 are captured -- nowhere near the 5-minute density
    // real data has, so no presence window can reach the coverage floor.
    const slots = toInput(tomorrow);
    const result = rankPresenceWindows(slots, '2026-08-26', nowAt(9 * 60, '2026-08-26'), DEFAULT_RECOMMEND_PARAMS);
    expect(result.ranked).toEqual([]);
    expect(result.pick).toBeNull();
    expect(result.confidence).toBe('none');
  });

  it('never treats an expired, corrupted slot as a bookable candidate', () => {
    // These slots report onSlope well past their own totalQty (the expiry
    // corruption from PLAN.md §12.1) -- if the ranking ever used them, the
    // avg/peak figures would be nonsense. Force `available: true` so this
    // isolates the expiry check specifically, rather than piggy-backing on
    // the fixture's own (also-false) `available` flag.
    const slots = toInput(today).map((s) => ({ ...s, available: true }));
    // 10:30: starting 13 + fromPrior 73 = 86 on an 80-place slope -- the
    // exact captured example PLAN.md §12.1 describes.
    const corrupted = slots.find((s) => s.time === '10:30')!;
    expect(corrupted.onSlope).toBeGreaterThan(corrupted.totalQty); // sanity: this really is the corruption

    const result = rankPresenceWindows(
      slots,
      DATE,
      nowAt(23 * 60, DATE), // late in the day -- every one of these has long since started
      { after: 0, session: 60, early: 15, stay: 10 }
    );
    expect(result.ranked).toEqual([]);
    expect(result.pick).toBeNull();
  });
});
