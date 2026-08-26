import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { snozoneProducts, snozonePollRuns } from '../db/schema.js';
import { venueNow, isSlotExpired, VENUE_TZ } from '../lib/snozoneWindow.js';
import type { RecommendSlotInput } from './snozoneRecommendService.js';

/**
 * Reads for the availability API (docs/snozone-frontend-plan.md §4).
 *
 * Postgres only — this module must never call Snozone. The collector is the
 * sole upstream caller (PLAN.md §1); every request answered here comes from
 * what it already wrote down, however stale that turns out to be (`isStale`
 * says so rather than pretending otherwise).
 */

/** A date's most recent observation older than this counts as stale. */
const STALE_AFTER_MS = 90 * 60 * 1000;

export interface ProductRef {
  id: number;
  sessionMinutes: number;
}

/**
 * The one active product this deploy polls.
 *
 * `snozone_products` is modelled as rows so a second product/location is an
 * insert rather than a migration (PLAN.md §4.1), but only one is seeded today
 * and the API contract (docs/snozone-frontend-plan.md §4) carries no product
 * selector. Picking the lowest-id active row keeps this deterministic if a
 * second product ever is added without the API changing underneath it.
 */
export async function getDefaultProduct(): Promise<ProductRef | null> {
  const [row] = await db
    .select({ id: snozoneProducts.id, sessionMinutes: snozoneProducts.sessionMinutes })
    .from(snozoneProducts)
    .where(eq(snozoneProducts.active, true))
    .orderBy(asc(snozoneProducts.id))
    .limit(1);
  return row ?? null;
}

export interface DatesResult {
  dates: string[];
  lastRunAt: string | null;
}

/**
 * Bookable dates the collector has observed, and when it last ran.
 *
 * Reads `snozone_slot_observations` rather than reconstructing the union of
 * the last window/horizon `snozone_poll_runs.datesPolled` arrays: change-only
 * storage still writes a full set of rows the FIRST time any date is polled
 * (every slot lacks prior state, so `hasSlotChanged` is unconditionally true),
 * so every date the collector has ever seen — near-term or from the daily
 * horizon sweep — has at least one row here. Simpler, and self-correcting if
 * a run's `datesPolled` bookkeeping is ever wrong.
 *
 * Restricted to today-or-later (venue-local) so a date that has fully lapsed
 * does not linger in the strip.
 */
export async function getBookableDates(productId: number): Promise<DatesResult> {
  const today = venueNow(new Date()).date;

  const rows = await db.execute<{ session_date: string }>(sql`
    SELECT DISTINCT session_date::text AS session_date
    FROM snozone_slot_observations
    WHERE product_row_id = ${productId} AND session_date >= ${today}::date
    ORDER BY session_date
  `);

  const [lastRun] = await db
    .select({ startedAt: snozonePollRuns.startedAt })
    .from(snozonePollRuns)
    .where(and(eq(snozonePollRuns.productRowId, productId), eq(snozonePollRuns.status, 'ok')))
    .orderBy(desc(snozonePollRuns.startedAt))
    .limit(1);

  return {
    dates: rows.map((r) => r.session_date),
    lastRunAt: lastRun ? lastRun.startedAt.toISOString() : null,
  };
}

export interface DaySlot {
  time: string;
  label: string;
  starting: number;
  fromPrior: number;
  onSlope: number;
  qtyAvailable: number;
  totalQty: number;
  available: boolean;
  soldOut: boolean;
  blocked: boolean;
  lowAvailability: boolean;
  callToBook: boolean;
  reason: string | null;
  price: string | null;
  slotType: string | null;
  experience: string | null;
  observedAt: string;
  /** Was the reading taken after this slot's own start time (PLAN.md §12.1)? */
  expired: boolean;
  /** Genuinely at capacity. Computed from onSlope/totalQty, never from soldOut/blocked. */
  full: boolean;
}

export interface DaySummary {
  total: number;
  available: number;
  capacity: number;
  peakOnSlope: number | null;
}

export interface DaySnapshot {
  date: string;
  observedAt: string | null;
  isStale: boolean;
  slots: DaySlot[];
  summary: DaySummary;
}

/**
 * Latest known state of every slot for a date.
 *
 * "Latest" needs `DISTINCT ON (slot_time) ... ORDER BY slot_time, observed_at
 * DESC` because storage is change-only — there is no single row that is
 * "today's state", only a stream of changes (PLAN.md §4.3, the same pattern
 * as `loadLastStates` in snozoneCollector.ts).
 *
 * Slots whose only observation is post-expiry are included, not filtered —
 * the UI can grey them out using `expired`, but silently dropping them would
 * make an interrupted collector look like an empty slope. `full` is derived
 * from onSlope/totalQty; `soldOut`/`blocked` are passed through as reported
 * but are about TIME, not capacity, and must never be read as "full"
 * (brief.md §10.2a) — `isTrulyFull()` in snozoneClient.ts is the same rule.
 */
export async function getDaySnapshot(productId: number, date: string): Promise<DaySnapshot> {
  const rows = await db.execute<{
    slot_time: string;
    starting: number;
    from_prior: number;
    on_slope: number;
    qty_available: number;
    total_qty: number;
    available: boolean;
    sold_out: boolean;
    blocked: boolean;
    low_availability: boolean;
    call_to_book: boolean;
    reason: string | null;
    price: string | null;
    slot_type: string | null;
    experience: string | null;
    observed_at: Date;
    expired_when_seen: boolean;
  }>(sql`
    SELECT DISTINCT ON (slot_time)
      slot_time, starting, from_prior, on_slope, qty_available, total_qty,
      available, sold_out, blocked, low_availability, call_to_book,
      reason, price, slot_type, experience, observed_at, expired_when_seen
    FROM snozone_slot_observations
    WHERE product_row_id = ${productId} AND session_date = ${date}::date
    ORDER BY slot_time, observed_at DESC
  `);

  const now = venueNow(new Date());
  const slots: DaySlot[] = rows.map((r) => ({
    time: r.slot_time,
    // `timelabel` is not persisted as its own column (only `slot_time` is).
    // Every captured upstream reading sent it empty, which normaliseSlot()
    // already falls back to the time for (snozoneClient.ts) — so this matches
    // what the live viewer would have shown, not a lossy simplification.
    label: r.slot_time,
    starting: r.starting,
    fromPrior: r.from_prior,
    onSlope: r.on_slope,
    qtyAvailable: r.qty_available,
    totalQty: r.total_qty,
    available: r.available,
    soldOut: r.sold_out,
    blocked: r.blocked,
    lowAvailability: r.low_availability,
    callToBook: r.call_to_book,
    reason: r.reason,
    price: r.price,
    slotType: r.slot_type,
    experience: r.experience,
    observedAt: r.observed_at.toISOString(),
    // Two different questions converge here. `expired_when_seen` records
    // whether the READING was taken after the slot started (so its numbers are
    // corrupted); `isSlotExpired` asks whether the slot has passed BY NOW. They
    // usually agree, because expiry itself changes the row and so writes a new
    // one — but between a slot starting and the next poll, the stored flag is
    // still false while the slot is plainly gone. Taking either as sufficient
    // means the UI never offers a slot that has already started.
    expired: r.expired_when_seen || isSlotExpired(now, date, r.slot_time),
    full: r.total_qty > 0 && r.on_slope >= r.total_qty,
  }));

  let latestObservedAt: Date | null = null;
  for (const r of rows) {
    if (!latestObservedAt || r.observed_at > latestObservedAt) latestObservedAt = r.observed_at;
  }
  const isStale = !latestObservedAt || Date.now() - latestObservedAt.getTime() > STALE_AFTER_MS;

  const capacity = slots.reduce((max, s) => Math.max(max, s.totalQty), 0);
  const availableCount = slots.filter((s) => s.available).length;
  let peakOnSlope: number | null = null;
  for (const s of slots) {
    if (s.expired) continue;
    if (peakOnSlope === null || s.onSlope > peakOnSlope) peakOnSlope = s.onSlope;
  }

  return {
    date,
    observedAt: latestObservedAt ? latestObservedAt.toISOString() : null,
    isStale,
    slots,
    summary: { total: slots.length, available: availableCount, capacity, peakOnSlope },
  };
}

export interface HistoryPoint {
  slotTime: string;
  observedAt: string;
  onSlope: number;
  starting: number;
}

/**
 * Every stored observation for a date — the change-only record, unfiltered.
 * Fuels the fill-curve chart (frontend plan §3.2), which needs to see the
 * shape of how a date filled in, corrupted post-expiry tail included; callers
 * that want a single trustworthy figure should use `getTrustworthySlots` or
 * `snozone_slot_finals` instead.
 */
export async function getDayHistory(productId: number, date: string): Promise<HistoryPoint[]> {
  const rows = await db.execute<{
    slot_time: string;
    observed_at: Date;
    on_slope: number;
    starting: number;
  }>(sql`
    SELECT slot_time, observed_at, on_slope, starting
    FROM snozone_slot_observations
    WHERE product_row_id = ${productId} AND session_date = ${date}::date
    ORDER BY slot_time, observed_at
  `);

  return rows.map((r) => ({
    slotTime: r.slot_time,
    observedAt: r.observed_at.toISOString(),
    onSlope: r.on_slope,
    starting: r.starting,
  }));
}

/**
 * The last PRE-EXPIRY observation of every slot for a date — the occupancy
 * input for the recommend ranking (`snozoneRecommendService.rankPresenceWindows`).
 *
 * Deliberately narrower than `getDaySnapshot`: an observation taken after a
 * slot's own start time is corrupted — `qtyAvailable` zeroed and `fromPrior`
 * no longer decrementing, so a captured slot reports 86 people on an
 * 80-place slope (PLAN.md §12.1) — and must never feed a "how busy will it
 * be" calculation. `observed_at < slot start (venue-local)` is the
 * authoritative test, applied the same way `snozoneRollup.ts` applies it when
 * building `snozone_slot_finals`.
 *
 * For a slot that has not started yet, every observation of it is
 * necessarily pre-expiry, so this agrees exactly with `getDaySnapshot` for
 * every slot that can still be booked — only already-started slots are
 * treated differently, which is also exactly the set the ranking excludes as
 * candidates anyway.
 */
export async function getTrustworthySlots(
  productId: number,
  date: string
): Promise<RecommendSlotInput[]> {
  const rows = await db.execute<{
    slot_time: string;
    on_slope: number;
    available: boolean;
    total_qty: number;
  }>(sql`
    SELECT DISTINCT ON (slot_time)
      slot_time, on_slope, available, total_qty
    FROM snozone_slot_observations
    WHERE product_row_id = ${productId} AND session_date = ${date}::date
      AND observed_at < ((session_date + slot_time::time) AT TIME ZONE ${VENUE_TZ})
    ORDER BY slot_time, observed_at DESC
  `);

  return rows.map((r) => ({
    time: r.slot_time,
    onSlope: r.on_slope,
    available: r.available,
    totalQty: r.total_qty,
  }));
}
