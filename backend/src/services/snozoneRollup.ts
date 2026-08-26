import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { venueNow, addDays, VENUE_TZ } from '../lib/snozoneWindow.js';
import { logger } from '../lib/logger.js';

/**
 * Nightly rollup of raw observations into `snozone_slot_finals`.
 *
 * Why a rollup at all: the analytics need one trustworthy occupancy figure per
 * slot per date, and deriving it on the fly means re-applying the expiry rules
 * to millions of rows on every query. This table is ~44k rows a year and is
 * always rederivable, so it is a cache, not a source of truth.
 *
 * The rule it encodes is the one from brief.md §10.2a: only observations taken
 * STRICTLY BEFORE a slot's start time may be trusted. Once a slot starts,
 * Snozone zeroes qtyavailable and stops decrementing peopleFromPriorSession, so
 * later readings report nonsense — a captured example shows 86 people on an
 * 80-place slope. Filtering on the timestamp rather than on `expired_when_seen`
 * keeps this correct even for rows written before that flag existed, and lets a
 * fix be applied retroactively by simply re-running.
 *
 * Idempotent: re-running over any range recomputes and upserts.
 */

export interface RollupResult {
  from: string;
  to: string;
  slotsWritten: number;
}

/**
 * Recompute finals for `from`..`to` inclusive (venue-local dates).
 *
 * Runs as a single statement so a partially-written rollup cannot be observed.
 */
export async function rollupFinals(from: string, to: string): Promise<RollupResult> {
  const result = await db.execute<{ count: string }>(sql`
    WITH usable AS (
      SELECT o.*
      FROM snozone_slot_observations o
      WHERE o.session_date BETWEEN ${from}::date AND ${to}::date
        -- venue-local slot start, compared against the observation instant
        AND o.observed_at <
            ((o.session_date + o.slot_time::time) AT TIME ZONE ${VENUE_TZ})
    ),
    agg AS (
      SELECT product_row_id, session_date, slot_time,
             max(on_slope) AS peak_on_slope,
             count(*)::int AS observation_count,
             min(observed_at) AS first_seen_at
      FROM usable
      GROUP BY 1, 2, 3
    ),
    latest AS (
      SELECT DISTINCT ON (product_row_id, session_date, slot_time)
             product_row_id, session_date, slot_time,
             on_slope, starting, total_qty, slot_type, price
      FROM usable
      ORDER BY product_row_id, session_date, slot_time, observed_at DESC
    ),
    earliest AS (
      SELECT DISTINCT ON (product_row_id, session_date, slot_time)
             product_row_id, session_date, slot_time,
             on_slope AS first_on_slope
      FROM usable
      ORDER BY product_row_id, session_date, slot_time, observed_at ASC
    ),
    upserted AS (
      INSERT INTO snozone_slot_finals (
        product_row_id, session_date, slot_time,
        final_on_slope, final_starting, total_qty, peak_on_slope,
        first_seen_on_slope, first_seen_at, slot_type, price,
        observation_count, computed_at
      )
      SELECT l.product_row_id, l.session_date, l.slot_time,
             l.on_slope, l.starting, l.total_qty, a.peak_on_slope,
             e.first_on_slope, a.first_seen_at, l.slot_type, l.price,
             a.observation_count, now()
      FROM latest l
      JOIN agg a USING (product_row_id, session_date, slot_time)
      JOIN earliest e USING (product_row_id, session_date, slot_time)
      ON CONFLICT (product_row_id, session_date, slot_time) DO UPDATE SET
        final_on_slope      = EXCLUDED.final_on_slope,
        final_starting      = EXCLUDED.final_starting,
        total_qty           = EXCLUDED.total_qty,
        peak_on_slope       = EXCLUDED.peak_on_slope,
        first_seen_on_slope = EXCLUDED.first_seen_on_slope,
        first_seen_at       = EXCLUDED.first_seen_at,
        slot_type           = EXCLUDED.slot_type,
        price               = EXCLUDED.price,
        observation_count   = EXCLUDED.observation_count,
        computed_at         = now()
      RETURNING 1
    )
    SELECT count(*)::text AS count FROM upserted
  `);

  const slotsWritten = Number(result[0]?.count ?? 0);
  logger.info({ from, to, slotsWritten }, 'Snozone finals rollup complete');
  return { from, to, slotsWritten };
}

/**
 * The nightly job: recompute the last week of finished dates.
 *
 * A week rather than just yesterday because the rollup is cheap and this makes
 * it self-healing — a night the worker was down, or a bug fixed since, is
 * repaired on the next run without anyone noticing it needed repairing.
 *
 * Only dates strictly before today are eligible: today's slots are still
 * running, so its finals would be premature.
 */
export async function runNightlyRollup(now: Date = new Date()): Promise<RollupResult> {
  const local = venueNow(now);
  const to = addDays(local.date, -1);
  const from = addDays(local.date, -7);
  return rollupFinals(from, to);
}
