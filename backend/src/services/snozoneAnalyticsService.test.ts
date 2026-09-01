import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { rollupFinals } from './snozoneRollup.js';
import {
  getCollectedDates,
  getBusyness,
  getBookingTimes,
  getLeadTimes,
  getTrend,
  getFillCurves,
  TIGHT_BRACKET_MINUTES,
  THRESHOLDS,
} from './snozoneAnalyticsService.js';

/**
 * DB-backed tests for the Patterns analytics and the `snozone_booking_events`
 * view underneath them.
 *
 * These need a real Postgres because the logic under test IS the SQL — window
 * functions, venue-local EXTRACTs, width_bucket boundaries and the view's diff
 * rule. Mocking the database would leave every one of those unexercised and
 * assert only that the service calls a query builder.
 *
 * The fixture is deliberately tiny and hand-computed rather than generated, so
 * each expectation below can be checked by reading it.
 */

const PRODUCT_LABEL = 'analytics-test-slope';
const VENUE = 'Europe/London';

/** A Wednesday and the Wednesday before it, plus a Friday. Fixed, not relative
 *  to today, so a test cannot start passing or failing with the calendar. */
const WED_A = '2026-08-12';
const WED_B = '2026-08-19';
const FRI = '2026-08-21';

let productId: number;
let runId: number;

/**
 * Write one observation. `bracketMinutes` sets prev_seen_at, which is what
 * makes a row a booking event and how wide its bracket is.
 */
async function observe(opts: {
  date: string;
  slot: string;
  /** Hours before the slot's venue-local start that this reading was taken. */
  hoursBefore: number;
  starting: number;
  fromPrior?: number;
  bracketMinutes: number | null;
  totalQty?: number;
}) {
  const { date, slot, hoursBefore, starting, bracketMinutes } = opts;
  const fromPrior = opts.fromPrior ?? 0;
  const totalQty = opts.totalQty ?? 80;
  await db.execute(sql`
    INSERT INTO snozone_slot_observations
      (run_id, product_row_id, session_date, slot_time, observed_at, prev_seen_at,
       starting, from_prior, on_slope, qty_available, total_qty,
       available, sold_out, blocked, low_availability, call_to_book, slot_type)
    VALUES (
      ${runId}, ${productId}, ${date}::date, ${slot},
      ((${date} || ' ' || ${slot})::timestamp AT TIME ZONE ${VENUE})
        - (${hoursBefore}::numeric * interval '1 hour'),
      ${bracketMinutes === null
        ? sql`NULL`
        : sql`((${date} || ' ' || ${slot})::timestamp AT TIME ZONE ${VENUE})
              - (${hoursBefore}::numeric * interval '1 hour')
              - (${bracketMinutes}::int * interval '1 minute')`},
      ${starting}, ${fromPrior}, ${starting + fromPrior},
      ${Math.max(0, totalQty - starting - fromPrior)}, ${totalQty},
      true, false, false, false, false, 'Off Peak'
    )
  `);
}

beforeAll(async () => {
  await db.execute(sql`
    DELETE FROM snozone_slot_observations
    WHERE product_row_id IN (SELECT id FROM snozone_products WHERE label = ${PRODUCT_LABEL})
  `);
  await db.execute(sql`
    DELETE FROM snozone_slot_finals
    WHERE product_row_id IN (SELECT id FROM snozone_products WHERE label = ${PRODUCT_LABEL})
  `);
  await db.execute(sql`
    DELETE FROM snozone_poll_runs
    WHERE product_row_id IN (SELECT id FROM snozone_products WHERE label = ${PRODUCT_LABEL})
  `);
  await db.execute(sql`DELETE FROM snozone_products WHERE label = ${PRODUCT_LABEL}`);

  const [p] = await db.execute<{ id: number }>(sql`
    INSERT INTO snozone_products (label, location_id, category_id, product_id, qty, prime_body)
    VALUES (${PRODUCT_LABEL}, 999, 999, 999, 1, 'x=1')
    RETURNING id
  `);
  productId = p.id;

  const [r] = await db.execute<{ id: number }>(sql`
    INSERT INTO snozone_poll_runs (product_row_id, mode, status)
    VALUES (${productId}, 'window', 'ok') RETURNING id
  `);
  runId = r.id;

  // --- WED_A, one slot, a clean three-reading lifecycle -------------------
  //
  // Carry-over moves independently of, and far faster than, `starting` here.
  // That is what the real data looks like -- from_prior is ~96% of slope
  // headcount, because a booking in one slot also raises the next twelve --
  // and it is what makes this fixture able to tell a correct diff from the
  // §6 trap. Diffing on_slope instead of starting would read these three
  // readings as 33 then 12 bookings rather than 3 then 2.
  //
  // First sight: 4 already booked before we ever looked. No prev_seen_at, so
  // this must NOT become an event.
  await observe({ date: WED_A, slot: '18:00', hoursBefore: 48, starting: 4, fromPrior: 20, bracketMinutes: null });
  // +3 booked, seen on the daily horizon sweep: a 24-hour bracket.
  await observe({ date: WED_A, slot: '18:00', hoursBefore: 24, starting: 7, fromPrior: 50, bracketMinutes: 1440 });
  // +2 booked, seen by the 30-minute window poll: a tight bracket.
  await observe({ date: WED_A, slot: '18:00', hoursBefore: 2, starting: 9, fromPrior: 60, bracketMinutes: 30 });
  // A reading taken AFTER the slot started, reporting corrupt nonsense. Must
  // be excluded from both the view and the rollup.
  await observe({ date: WED_A, slot: '18:00', hoursBefore: -1, starting: 999, fromPrior: 999, bracketMinutes: 30 });

  // --- WED_B, same slot, so Wednesday has two samples ---------------------
  await observe({ date: WED_B, slot: '18:00', hoursBefore: 48, starting: 0, bracketMinutes: null });
  await observe({ date: WED_B, slot: '18:00', hoursBefore: 2, starting: 5, bracketMinutes: 30 });
  // A cancellation: starting falls. Negative deltas are real and kept.
  await observe({ date: WED_B, slot: '18:00', hoursBefore: 1, starting: 3, bracketMinutes: 30 });

  // --- FRI, a slot Wednesday does not have, and a second slot -------------
  // Friday runs an hour later than midweek: 20:30 exists here and nowhere else.
  await observe({ date: FRI, slot: '18:00', hoursBefore: 48, starting: 0, bracketMinutes: null });
  await observe({ date: FRI, slot: '18:00', hoursBefore: 2, starting: 8, bracketMinutes: 30 });
  await observe({ date: FRI, slot: '20:30', hoursBefore: 48, starting: 0, bracketMinutes: null });
  await observe({ date: FRI, slot: '20:30', hoursBefore: 2, starting: 2, bracketMinutes: 30 });

  await rollupFinals(WED_A, FRI);
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM snozone_slot_observations WHERE product_row_id = ${productId}`);
  await db.execute(sql`DELETE FROM snozone_slot_finals WHERE product_row_id = ${productId}`);
  await db.execute(sql`DELETE FROM snozone_poll_runs WHERE product_row_id = ${productId}`);
  await db.execute(sql`DELETE FROM snozone_products WHERE id = ${productId}`);
});

const RANGE = { from: WED_A, to: FRI };

describe('snozone_booking_events view', () => {
  async function events() {
    const rows = await db.execute<{
      session_date: string; slot_time: string; delta_starting: number;
      bracket_minutes: number; lead_minutes: number;
    }>(sql`
      SELECT session_date::text AS session_date, slot_time, delta_starting,
             bracket_minutes, lead_minutes
      FROM snozone_booking_events
      WHERE product_row_id = ${productId}
      ORDER BY session_date, slot_time, bracket_to
    `);
    return [...rows];
  }

  it('diffs sessions STARTING here, never headcount on the slope', async () => {
    // The whole point of the view (brief.md §6). One booking also bumps
    // from_prior on the next twelve slots, so diffing on_slope counts it
    // thirteen times. WED_A's carry-over jumps 20 -> 50 -> 60 while only 3
    // then 2 places are actually sold; an on_slope diff would report 33 and 12.
    const wedA = (await events()).filter((e) => e.session_date === WED_A);
    expect(wedA.map((e) => e.delta_starting)).toEqual([3, 2]);
    expect(wedA.map((e) => e.delta_starting)).not.toEqual([33, 12]);
  });

  it('never emits an event for a slot it is seeing for the first time', async () => {
    // WED_A's first reading already had 4 booked. Attributing those to the
    // moment collection started would pile every pre-existing booking onto one
    // instant; the truncation is reported by finals.firstSeenOnSlope instead.
    const first = (await events()).filter((e) => e.session_date === WED_A);
    expect(first.map((e) => e.delta_starting)).toEqual([3, 2]);
  });

  it('excludes readings taken after the slot started', async () => {
    // The 999 reading would otherwise show up as a delta of +990.
    const all = await events();
    expect(all.some((e) => e.delta_starting > 100)).toBe(false);
  });

  it('keeps cancellations as negative deltas', async () => {
    const wedB = (await events()).filter((e) => e.session_date === WED_B);
    expect(wedB.map((e) => e.delta_starting)).toEqual([5, -2]);
  });

  it('records how wide the bracket containing the booking was', async () => {
    const wedA = (await events()).filter((e) => e.session_date === WED_A);
    expect(wedA.map((e) => e.bracket_minutes)).toEqual([1440, 30]);
  });

  it('estimates the booking at the midpoint of its bracket', async () => {
    const wedA = (await events()).filter((e) => e.session_date === WED_A);
    // Seen 24h before start with a 24h bracket -> booked between 48h and 24h
    // before, best estimate 36h = 2160 minutes.
    expect(wedA[0].lead_minutes).toBe(36 * 60);
    // Seen 2h before with a 30 minute bracket -> estimate 2h15m = 135 minutes.
    expect(wedA[1].lead_minutes).toBe(135);
  });
});

describe('getBusyness', () => {
  it('groups by weekday and slot, using the median across dates', async () => {
    const { cells } = await getBusyness(RANGE);
    // Wednesday 18:00 headcount ON THE SLOPE: WED_A finished at 9 starting +
    // 60 carry-over = 69, WED_B at 3 with none. Median of 69 and 3 is 36.
    // Busyness is about how crowded the slope is, so carry-over counts here --
    // unlike the booking events above, where only `starting` may be diffed.
    const wed = cells.find((c) => c.dow === 3 && c.slotTime === '18:00');
    expect(wed?.samples).toBe(2);
    expect(wed?.medianOnSlope).toBe(36);
  });

  it('reports fill as a fraction of that slot own capacity', async () => {
    const { cells } = await getBusyness(RANGE);
    const fri = cells.find((c) => c.dow === 5 && c.slotTime === '18:00');
    expect(fri?.medianFill).toBeCloseTo(8 / 80, 5);
  });

  it('distinguishes a closed slot from an unobserved weekday', async () => {
    const { cells, datesPerDow } = await getBusyness(RANGE);
    const dates = new Map(datesPerDow.map((d) => [d.dow, d.dates]));

    // Friday's 20:30 exists; Wednesday's does not, because midweek shuts
    // earlier. Wednesday HAS dates, so that absence means closed, not unknown.
    expect(cells.some((c) => c.dow === 5 && c.slotTime === '20:30')).toBe(true);
    expect(cells.some((c) => c.dow === 3 && c.slotTime === '20:30')).toBe(false);
    expect(dates.get(3)).toBe(2);

    // Monday has no dates at all: genuinely unobserved, a different thing.
    expect(dates.get(1) ?? 0).toBe(0);
  });

  it('rates maturity by the least-covered weekday, not the best', async () => {
    const { maturity } = await getBusyness(RANGE);
    // Most weekdays have nothing here, so the worst is 0 however good Wednesday is.
    expect(maturity.have).toBe(0);
    expect(maturity.needs).toBe(THRESHOLDS.busynessDatesPerWeekday);
    expect(maturity.ready).toBe(false);
  });
});

describe('getBookingTimes', () => {
  it('counts only tight brackets, and says how many it dropped', async () => {
    const result = await getBookingTimes(RANGE);
    // Positive events: WED_A +3 (1440min bracket, dropped) and +2; WED_B +5;
    // FRI +8 and +2. So 4 kept, 1 excluded.
    expect(result.excludedWideBracket).toBe(1);
    expect(result.totalBookings).toBe(2 + 5 + 8 + 2);
  });

  it('excludes cancellations from "when do people book"', async () => {
    const { cells } = await getBookingTimes(RANGE);
    expect(cells.every((c) => c.bookings > 0)).toBe(true);
  });

  it('buckets by venue-local hour, not UTC', async () => {
    const { cells } = await getBookingTimes(RANGE);
    // WED_A's tight event is estimated 2h15m before an 18:00 BST start, i.e.
    // 15:45 local -- hour 15. In UTC that instant is 14:45, so a UTC bucket
    // would file it under 14 and quietly shift every summer reading.
    expect(cells.some((c) => c.hour === 15)).toBe(true);
    expect(cells.some((c) => c.hour === 14)).toBe(false);
  });
});

describe('getLeadTimes', () => {
  it('places each booking in the bucket its estimate falls in', async () => {
    const { buckets } = await getLeadTimes(RANGE);
    const byLabel = new Map(buckets.map((b) => [b.label, b]));
    // 36h estimate -> "1-2 days" (1440-2880 minutes).
    expect(byLabel.get('1-2 days')?.bookings).toBe(3);
    // The four 135-minute estimates -> "1-3h".
    expect(byLabel.get('1-3h')?.bookings).toBe(2 + 5 + 8 + 2);
  });

  it('keeps wide brackets, unlike the hour-of-week analytic', async () => {
    // A day of imprecision is immaterial against a lead time in days, and
    // dropping those rows would bias the distribution towards short leads.
    const { buckets } = await getLeadTimes(RANGE);
    expect(buckets.find((b) => b.label === '1-2 days')?.events).toBe(1);
  });

  it('reports the ceiling the distribution is truncated at', async () => {
    const { observableLeadDays } = await getLeadTimes(RANGE);
    expect(observableLeadDays).toBeGreaterThanOrEqual(0);
  });
});

describe('getTrend', () => {
  it('normalises weekly totals by the slots the timetable actually offered', async () => {
    const { weeks } = await getTrend(RANGE);
    const withFriday = weeks.find((w) => w.openSlots === 3);
    // The Friday week has three rolled-up slots (18:00 and 20:30 on Friday,
    // 18:00 on WED_B) against 13 bookings, so the per-slot figure must divide
    // rather than compare raw totals -- Friday is open longer by design.
    expect(withFriday?.startingPerOpenSlot).toBeCloseTo(
      (withFriday?.totalStarting ?? 0) / 3,
      5
    );
  });

  it('surfaces Snozone own slot_type as an overlay', async () => {
    const { slotTypes } = await getTrend(RANGE);
    expect(slotTypes.map((s) => s.slotType)).toContain('Off Peak');
  });
});

describe('getCollectedDates', () => {
  it('reports each date with its weekday and how much was pre-booked', async () => {
    const dates = await getCollectedDates();
    const wedA = dates.find((d) => d.sessionDate === WED_A);
    expect(wedA?.dow).toBe(3);
    // 24 people were already on the slope the first time we saw this slot (4
    // starting here, 20 carrying over). That is the measure of what the
    // dataset structurally cannot see, and it is deliberately headcount rather
    // than bookings.
    expect(wedA?.firstSeenOnSlope).toBe(24);
  });
});

describe('getFillCurves', () => {
  it('ghosts prior same-weekday dates behind the target', async () => {
    const { series } = await getFillCurves({ date: WED_B, slotTime: '18:00', compare: 3 });

    // WED_A and WED_B are both Wednesdays; FRI is not and must not appear,
    // however recent it is. Same weekday is the comparison a rider makes.
    expect(series.map((s) => s.sessionDate).sort()).toEqual([WED_A, WED_B]);
    expect(series.find((s) => s.sessionDate === WED_B)?.isTarget).toBe(true);
    expect(series.find((s) => s.sessionDate === WED_A)?.isTarget).toBe(false);
  });

  it('honours the compare limit', async () => {
    const { series } = await getFillCurves({ date: WED_B, slotTime: '18:00', compare: 0 });
    expect(series.map((s) => s.sessionDate)).toEqual([WED_B]);
  });

  it('plots hours before the slot started, counting down to zero', async () => {
    const { series } = await getFillCurves({ date: WED_A, slotTime: '18:00', compare: 0 });
    const points = series[0].points;

    // Seeded at 48h, 24h and 2h before start, in that order.
    expect(points.map((p) => Math.round(p.hoursBefore))).toEqual([48, 24, 2]);
    // Ascending observation time means descending lead time; a chart that
    // assumed the other order would draw every curve backwards.
    expect(points[0].hoursBefore).toBeGreaterThan(points[points.length - 1].hoursBefore);
  });

  it('excludes the corrupt post-start reading', async () => {
    const { series } = await getFillCurves({ date: WED_A, slotTime: '18:00', compare: 0 });
    // The 999 reading sits at hoursBefore = -1 and would spike the curve at
    // exactly the moment the chart is read.
    expect(series[0].points.every((p) => p.hoursBefore > 0)).toBe(true);
    expect(series[0].points.some((p) => p.onSlope > 500)).toBe(false);
  });

  it('reports where the curve actually starts, so it is not drawn back to zero', async () => {
    const { series } = await getFillCurves({ date: WED_A, slotTime: '18:00', compare: 0 });
    // First sight was 48h out with 24 already on the slope. Extrapolating to
    // (72h, 0) would invent a booking history nobody observed.
    expect(Math.round(series[0].firstSeenHoursBefore)).toBe(48);
    expect(series[0].firstSeenOnSlope).toBe(24);
  });

  it('counts a curve as a lifecycle only if it was seen early enough', async () => {
    const early = await getFillCurves({ date: WED_A, slotTime: '18:00', compare: 0 });
    expect(early.maturity.have).toBe(1);
    expect(early.maturity.ready).toBe(true);

    // WED_B's slot was first seen 48h out too, but its 20:30 counterpart on
    // Friday only ever had a 48h first sight; a slot first seen inside the
    // window would not qualify.
    const late = await getFillCurves({ date: FRI, slotTime: '20:30', compare: 0 });
    expect(late.maturity.needs).toBe(THRESHOLDS.fillCurveLifecycles);
  });

  it('returns nothing rather than throwing for a slot that never existed', async () => {
    const { series, maturity } = await getFillCurves({
      date: WED_A, slotTime: '23:55', compare: 3,
    });
    expect(series).toEqual([]);
    expect(maturity.ready).toBe(false);
  });
});

describe('TIGHT_BRACKET_MINUTES', () => {
  it('is wide enough for a late 30-minute poll but not a daily sweep', () => {
    expect(TIGHT_BRACKET_MINUTES).toBeGreaterThan(30);
    expect(TIGHT_BRACKET_MINUTES).toBeLessThan(1440);
  });
});
