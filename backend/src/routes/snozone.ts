import { Hono } from 'hono';
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
import { venueNow } from '../lib/snozoneWindow.js';

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

export default app;
