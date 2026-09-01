import { Hono, type Context } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';
import { getSnozoneStatus } from '../services/snozoneStatusService.js';
import {
  getDefaultProduct,
  getBookableDates,
  getDaySnapshot,
  getDayHistory,
  getTrustworthySlots,
} from '../services/snozoneAvailabilityService.js';
import {
  rankPresenceWindows,
  DEFAULT_RECOMMEND_PARAMS,
  type RecommendParams,
} from '../services/snozoneRecommendService.js';
import {
  getCollectedDates,
  getBusyness,
  getBookingTimes,
  getLeadTimes,
  getTrend,
  getFillCurves,
  type DateRange,
} from '../services/snozoneAnalyticsService.js';
import { venueNow, addDays } from '../lib/snozoneWindow.js';

/**
 * Snozone routes (docs/snozone-frontend-plan.md §4). Every handler here reads
 * Postgres only and never calls Snozone — the collector is the sole upstream
 * caller (PLAN.md §1), at a fixed rate regardless of how much this API is
 * browsed.
 *
 * Auth is split, not uniform: availability is for any signed-in household
 * member (frontend plan §2 — "any signed-in user"), so only `/health` keeps
 * the admin gate. It exposes run errors, upstream call counts and collection
 * internals, which is collector diagnostics rather than anything a household
 * member needs.
 */
const app = new Hono();

app.use('*', authMiddleware);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Regex plus a round-trip through Date, so '2026-02-30' is rejected too. */
export function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

function parseParam(raw: string | undefined, fallback: number): number | null {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * `after` is an hour of day, and callers reasonably express it either way:
 * phase 0 used a bare hour (`16`), while a UI naturally sends a clock time
 * (`16:00`). Both are accepted rather than making the caller guess which the
 * API wants, and a half-hour like `16:30` resolves to 16.5 — which the
 * ranking's `mins >= after * 60` comparison already handles.
 */
export function parseAfter(raw: string | undefined, fallback: number): number | null {
  if (raw === undefined || raw === '') return fallback;

  const clock = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (clock) {
    const hours = Number(clock[1]);
    const minutes = Number(clock[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours + minutes / 60;
  }

  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : null;
}

/** Collector health, run ledger, and what has actually been collected. Admin only. */
app.get('/health', adminOnly, async (c) => {
  return c.json(await getSnozoneStatus());
});

/** Bookable dates the collector has observed, from the DB — never upstream. */
app.get('/dates', async (c) => {
  const product = await getDefaultProduct();
  if (!product) return c.json({ dates: [], lastRunAt: null });
  return c.json(await getBookableDates(product.id));
});

/** Latest observation per slot for a date, plus a summary. */
app.get('/days/:date', async (c) => {
  const date = c.req.param('date');
  if (!isValidDate(date)) {
    return c.json({ error: 'Invalid date, expected YYYY-MM-DD' }, 400);
  }

  const product = await getDefaultProduct();
  if (!product) {
    return c.json({
      date,
      observedAt: null,
      isStale: true,
      slots: [],
      summary: { total: 0, available: 0, capacity: 0, peakOnSlope: null },
    });
  }

  return c.json(await getDaySnapshot(product.id, date));
});

/** Every stored observation for a date — the raw change history, for the fill-curve chart. */
app.get('/days/:date/history', async (c) => {
  const date = c.req.param('date');
  if (!isValidDate(date)) {
    return c.json({ error: 'Invalid date, expected YYYY-MM-DD' }, 400);
  }

  const product = await getDefaultProduct();
  if (!product) return c.json({ date, points: [] });

  return c.json({ date, points: await getDayHistory(product.id, date) });
});

/** The presence-window pick for a date, computed server-side (frontend plan §4). */
app.get('/recommend', async (c) => {
  const date = c.req.query('date');
  if (!date || !isValidDate(date)) {
    return c.json({ error: 'Invalid or missing date, expected YYYY-MM-DD' }, 400);
  }

  const after = parseAfter(c.req.query('after'), DEFAULT_RECOMMEND_PARAMS.after);
  const session = parseParam(c.req.query('session'), DEFAULT_RECOMMEND_PARAMS.session);
  const early = parseParam(c.req.query('early'), DEFAULT_RECOMMEND_PARAMS.early);
  const stay = parseParam(c.req.query('stay'), DEFAULT_RECOMMEND_PARAMS.stay);
  if (after === null || session === null || early === null || stay === null) {
    return c.json(
      { error: 'after must be an hour (16) or clock time (16:00); session, early and stay must be numbers' },
      400
    );
  }
  const params: RecommendParams = { after, session, early, stay };

  const product = await getDefaultProduct();
  if (!product) {
    return c.json({
      date,
      params,
      pick: null,
      ranked: [],
      confidence: 'none',
      note: 'No Snozone product configured.',
    });
  }

  const slots = await getTrustworthySlots(product.id, date);
  const now = venueNow(new Date());
  const result = rankPresenceWindows(slots, date, now, params);

  return c.json({ date, params, ...result });
});

/* ------------------------------------------------------------- analytics */

/**
 * How far back an analytic looks when the caller does not say.
 *
 * A year, because the questions these answer are seasonal and the finals table
 * is sized for exactly that (~44k rows a year). Nothing here is expensive
 * enough to need a tighter default.
 */
const DEFAULT_ANALYTICS_DAYS = 365;

/**
 * Resolve `from`/`to` query parameters into a range, defaulting to the last
 * year and ending today. Returns null if either is present but malformed, so
 * a typo produces a 400 rather than silently widening the window.
 */
export function parseRange(
  from: string | undefined,
  to: string | undefined,
  today: string
): DateRange | null {
  const resolvedTo = to === undefined || to === '' ? today : to;
  // `to` has to be validated BEFORE it is used to derive the default `from`:
  // addDays runs it through `new Date`, which throws RangeError on junk, so
  // validating afterwards turns a typo'd query parameter into a 500 rather
  // than the 400 it should be.
  if (!isValidDate(resolvedTo)) return null;

  const resolvedFrom =
    from === undefined || from === ''
      ? addDays(resolvedTo, -DEFAULT_ANALYTICS_DAYS)
      : from;

  if (!isValidDate(resolvedFrom)) return null;
  if (resolvedFrom > resolvedTo) return null;
  return { from: resolvedFrom, to: resolvedTo };
}

/**
 * Analytics change at most once a night (the rollup), and the booking-event
 * view moves only as fast as the 30-minute poll, so a short shared cache is
 * free. Kept modest rather than matching the rollup cadence because a stale
 * hour on a chart that is switching itself on as data matures is confusing.
 */
const ANALYTICS_CACHE_CONTROL = 'private, max-age=900';

/** Every analytics route resolves its range identically; this is that shape. */
async function analytics<T>(
  c: Context,
  load: (range: DateRange) => Promise<T>
) {
  const today = venueNow(new Date()).date;
  const range = parseRange(c.req.query('from'), c.req.query('to'), today);
  if (!range) {
    return c.json(
      { error: 'from and to must be YYYY-MM-DD, with from on or before to' },
      400
    );
  }
  const result = await load(range);
  c.header('Cache-Control', ANALYTICS_CACHE_CONTROL);
  return c.json({ range, ...result });
}

/**
 * Past dates that have been rolled up.
 *
 * Not one of the four analytics, but the Patterns page cannot do without it:
 * `/dates` lists *bookable* dates, which are all in the future, so this is the
 * only way the frontend can know which prior same-weekday dates exist to ghost
 * behind a fill curve.
 */
app.get('/analytics/collected-dates', async (c) => {
  c.header('Cache-Control', ANALYTICS_CACHE_CONTROL);
  return c.json({ dates: await getCollectedDates() });
});

/** Median occupancy by weekday and time of day. */
app.get('/analytics/busyness', (c) => analytics(c, getBusyness));

/** When bookings are made, by hour of week. */
app.get('/analytics/booking-times', (c) => analytics(c, getBookingTimes));

/** How far ahead people book. */
app.get('/analytics/lead-times', (c) => analytics(c, getLeadTimes));

/** Weekly peaks and totals, normalised by opening hours. */
app.get('/analytics/trend', (c) => analytics(c, getTrend));

/** Venue-local 'HH:MM', the form slot times are stored in. */
const SLOT_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** How many prior same-weekday dates to ghost behind the target curve. */
const DEFAULT_FILL_CURVE_COMPARE = 3;
const MAX_FILL_CURVE_COMPARE = 8;

/**
 * One slot's fill curve, with prior same-weekday dates behind it.
 *
 * Takes a slot rather than a range: this chart is a single slot against lead
 * time, which is exactly why opening hours never enter it (frontend plan §5.1).
 */
app.get('/analytics/fill-curve', async (c) => {
  const date = c.req.query('date');
  if (!date || !isValidDate(date)) {
    return c.json({ error: 'Invalid or missing date, expected YYYY-MM-DD' }, 400);
  }

  const slotTime = c.req.query('slot');
  if (!slotTime || !SLOT_TIME_RE.test(slotTime)) {
    return c.json({ error: 'Invalid or missing slot, expected HH:MM' }, 400);
  }

  const rawCompare = c.req.query('compare');
  let compare = DEFAULT_FILL_CURVE_COMPARE;
  if (rawCompare !== undefined && rawCompare !== '') {
    const n = Number(rawCompare);
    if (!Number.isInteger(n) || n < 0 || n > MAX_FILL_CURVE_COMPARE) {
      return c.json(
        { error: `compare must be a whole number between 0 and ${MAX_FILL_CURVE_COMPARE}` },
        400
      );
    }
    compare = n;
  }

  c.header('Cache-Control', ANALYTICS_CACHE_CONTROL);
  return c.json(await getFillCurves({ date, slotTime, compare }));
});

export default app;
