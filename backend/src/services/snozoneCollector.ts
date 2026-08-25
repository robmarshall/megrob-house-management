import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  snozoneProducts,
  snozonePollRuns,
  snozoneSlotObservations,
} from '../db/schema.js';
import {
  SnozoneSession,
  SnozoneError,
  type NormalisedSlot,
  type SnozoneProductConfig,
} from '../lib/snozoneClient.js';
import {
  venueNow,
  selectWindowDates,
  selectHorizonDates,
  isSlotExpired,
  type VenueNow,
} from '../lib/snozoneWindow.js';
import { logger } from '../lib/logger.js';

/**
 * One Snozone collection run: fetch, validate, diff, persist.
 *
 * The design constraint behind all of it is that the data cannot be backfilled
 * — Snozone exposes no history — so a run that writes wrong data is worse than
 * a run that writes nothing. Hence: fetch everything first, validate it all,
 * and only then persist, in a single transaction.
 */

export type PollMode = 'window' | 'horizon';
export type RunStatus = 'ok' | 'blocked' | 'unprimed' | 'error';

export interface RunSummary {
  runId: number | null;
  status: RunStatus;
  datesPolled: string[];
  datesSkipped: string[];
  slotsSeen: number;
  changesWritten: number;
  httpCalls: number;
  error?: string;
}

/** Fields whose change is worth a new row. */
const TRACKED = [
  'starting', 'fromPrior', 'onSlope', 'qtyAvailable', 'totalQty',
  'available', 'soldOut', 'blocked', 'lowAvailability', 'callToBook',
  'reason', 'price', 'slotType', 'experience',
] as const;

/** Previous stored state of one slot, as far as the diff cares. */
export type SlotState = Pick<NormalisedSlot, (typeof TRACKED)[number]>;

/**
 * `numeric` comes back from Postgres as a fixed-scale string ('34.90') while
 * upstream may send '34.9'. Comparing raw would rewrite the row every run.
 */
function priceKey(p: string | null): string | null {
  if (p == null || p === '') return null;
  const n = Number(p);
  return Number.isFinite(n) ? n.toFixed(2) : String(p);
}

/**
 * Has anything worth recording changed?
 *
 * Deliberately excludes `expiredWhenSeen`, which flips purely with the passage
 * of time. Including it would write a row for every slot as it expires, adding
 * a daily churn of rows that carry no new information about bookings.
 */
export function hasSlotChanged(prev: SlotState | undefined, next: NormalisedSlot): boolean {
  if (!prev) return true;
  for (const field of TRACKED) {
    if (field === 'price') {
      if (priceKey(prev.price) !== priceKey(next.price)) return true;
      continue;
    }
    if (prev[field] !== next[field]) return true;
  }
  return false;
}

export interface DateReading {
  date: string;
  slots: NormalisedSlot[];
}

export interface Validation {
  ok: boolean;
  reason?: string;
}

/**
 * Reject a reading that is probably wrong about the world rather than reporting
 * a changed world (PLAN.md §12.2).
 *
 * The client already turns an empty response into a typed error, so what is
 * left here are the plausible-looking-but-wrong shapes: a date that suddenly
 * reports a handful of slots where it had ~121, or one whose entire occupancy
 * has vanished. Both are far more likely to be a half-primed session than a
 * real change, and both would silently corrupt the analytics.
 */
export function validateReading(
  reading: DateReading,
  prevSlotCount: number,
  prevTotalOnSlope: number
): Validation {
  if (reading.slots.length === 0) {
    return { ok: false, reason: `${reading.date}: zero slots` };
  }
  if (prevSlotCount > 0 && reading.slots.length < prevSlotCount * 0.5) {
    return {
      ok: false,
      reason: `${reading.date}: slot count collapsed ${prevSlotCount} -> ${reading.slots.length}`,
    };
  }
  const total = reading.slots.reduce((n, s) => n + s.onSlope, 0);
  if (prevTotalOnSlope >= 20 && total === 0) {
    return {
      ok: false,
      reason: `${reading.date}: occupancy collapsed ${prevTotalOnSlope} -> 0 across every slot`,
    };
  }
  return { ok: true };
}

function toConfig(row: typeof snozoneProducts.$inferSelect): SnozoneProductConfig {
  return {
    locationId: row.locationId,
    categoryId: row.categoryId,
    productId: row.productId,
    qty: row.qty,
    primeBody: row.primeBody,
  };
}

/** Latest stored state for every slot of a date, for the diff. */
async function loadLastStates(
  productRowId: number,
  date: string
): Promise<Map<string, SlotState>> {
  const rows = await db.execute<{
    slot_time: string; starting: number; from_prior: number; on_slope: number;
    qty_available: number; total_qty: number; available: boolean; sold_out: boolean;
    blocked: boolean; low_availability: boolean; call_to_book: boolean;
    reason: string | null; price: string | null; slot_type: string | null;
    experience: string | null;
  }>(sql`
    SELECT DISTINCT ON (slot_time)
      slot_time, starting, from_prior, on_slope, qty_available, total_qty,
      available, sold_out, blocked, low_availability, call_to_book,
      reason, price, slot_type, experience
    FROM snozone_slot_observations
    WHERE product_row_id = ${productRowId} AND session_date = ${date}
    ORDER BY slot_time, observed_at DESC
  `);

  const out = new Map<string, SlotState>();
  for (const r of rows) {
    out.set(r.slot_time, {
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
      reason: r.reason ?? '',
      price: r.price,
      slotType: r.slot_type ?? '',
      experience: r.experience ?? '',
    });
  }
  return out;
}

/**
 * When each date was last successfully polled.
 *
 * This is what `prev_seen_at` is set from, and it is per-date rather than
 * per-slot because every slot of a date is fetched in the same call. Only
 * status='ok' runs count: a rejected run looked, but not usefully.
 */
async function loadLastPolledAt(
  productRowId: number,
  dates: string[]
): Promise<Map<string, Date>> {
  if (dates.length === 0) return new Map();
  const rows = await db.execute<{ d: string; last: Date | null }>(sql`
    SELECT d, max(r.started_at) AS last
    FROM unnest(${dates}::text[]) AS d
    LEFT JOIN snozone_poll_runs r
      ON r.product_row_id = ${productRowId}
     AND r.status = 'ok'
     AND d = ANY(r.dates_polled)
    GROUP BY d
  `);
  const out = new Map<string, Date>();
  for (const r of rows) if (r.last) out.set(r.d, new Date(r.last));
  return out;
}

/** Latest slot time ever recorded per date — used to skip a finished today. */
async function loadLastSlotTimes(
  productRowId: number,
  dates: string[]
): Promise<Record<string, string | null>> {
  if (dates.length === 0) return {};
  const rows = await db.execute<{ session_date: string; last_slot: string | null }>(sql`
    SELECT session_date, max(slot_time) AS last_slot
    FROM snozone_slot_observations
    WHERE product_row_id = ${productRowId} AND session_date = ANY(${dates}::date[])
    GROUP BY session_date
  `);
  const out: Record<string, string | null> = {};
  for (const r of rows) out[r.session_date] = r.last_slot;
  return out;
}

function totalOnSlope(states: Map<string, SlotState>): number {
  let total = 0;
  for (const s of states.values()) total += s.onSlope;
  return total;
}

export interface CollectOptions {
  productRowId?: number;
  mode: PollMode;
  /** Injectable for tests; defaults to the real clock. */
  now?: Date;
}

/**
 * Collect for every active product (or just one, when `productRowId` is given).
 */
export async function runSnozoneCollection(opts: CollectOptions): Promise<RunSummary[]> {
  const products = await db
    .select()
    .from(snozoneProducts)
    .where(
      opts.productRowId
        ? and(eq(snozoneProducts.active, true), eq(snozoneProducts.id, opts.productRowId))
        : eq(snozoneProducts.active, true)
    );

  if (products.length === 0) {
    logger.warn({ mode: opts.mode }, 'Snozone collection: no active products');
    return [];
  }

  const summaries: RunSummary[] = [];
  for (const product of products) {
    summaries.push(await collectForProduct(product, opts.mode, opts.now ?? new Date()));
  }
  return summaries;
}

async function collectForProduct(
  product: typeof snozoneProducts.$inferSelect,
  mode: PollMode,
  now: Date
): Promise<RunSummary> {
  const [run] = await db
    .insert(snozonePollRuns)
    .values({ productRowId: product.id, mode, startedAt: now, status: 'running' })
    .returning({ id: snozonePollRuns.id });

  const session = new SnozoneSession(toConfig(product));
  const local: VenueNow = venueNow(now);

  const finish = async (
    status: RunStatus,
    fields: Partial<{
      datesPolled: string[]; datesSkipped: string[]; horizonLength: number;
      slotsSeen: number; changesWritten: number; error: string;
    }>
  ): Promise<RunSummary> => {
    await db
      .update(snozonePollRuns)
      .set({
        status,
        finishedAt: new Date(),
        httpCalls: session.httpCalls,
        ...fields,
      })
      .where(eq(snozonePollRuns.id, run.id));

    const summary: RunSummary = {
      runId: run.id,
      status,
      datesPolled: fields.datesPolled ?? [],
      datesSkipped: fields.datesSkipped ?? [],
      slotsSeen: fields.slotsSeen ?? 0,
      changesWritten: fields.changesWritten ?? 0,
      httpCalls: session.httpCalls,
      error: fields.error,
    };
    const line = { ...summary, product: product.label, mode };
    if (status === 'ok') logger.info(line, 'Snozone collection run complete');
    else logger.error(line, 'Snozone collection run failed');
    return summary;
  };

  try {
    // ---- fetch -----------------------------------------------------------
    const horizon = await session.getDates(local.date);

    let targets: string[];
    let skipped: string[] = [];
    if (mode === 'window') {
      const lastSlots = await loadLastSlotTimes(product.id, [
        local.date,
      ]);
      const sel = selectWindowDates(horizon, local, lastSlots);
      targets = sel.dates;
      skipped = sel.skipped;
    } else {
      targets = selectHorizonDates(horizon, local);
    }

    if (targets.length === 0) {
      return finish('ok', {
        datesPolled: [], datesSkipped: skipped, horizonLength: horizon.length,
        slotsSeen: 0, changesWritten: 0,
      });
    }

    const readings: DateReading[] = [];
    for (const date of targets) {
      readings.push({ date, slots: await session.getTimes(date) });
    }

    // ---- validate (nothing is written until every date passes) -----------
    // Prior state is loaded once per date and reused by the diff below: on a
    // 28-date horizon run, reloading it would double the query count.
    const priorStates = new Map<string, Map<string, SlotState>>();
    for (const reading of readings) {
      const states = await loadLastStates(product.id, reading.date);
      priorStates.set(reading.date, states);

      const v = validateReading(reading, states.size, totalOnSlope(states));
      if (!v.ok) {
        return finish('unprimed', {
          datesPolled: [], datesSkipped: skipped, horizonLength: horizon.length,
          error: `validation rejected the run — ${v.reason}`,
        });
      }
    }

    // ---- diff and persist ------------------------------------------------
    const lastPolled = await loadLastPolledAt(product.id, targets);
    const observedAt = new Date();
    let slotsSeen = 0;
    let changesWritten = 0;

    await db.transaction(async (tx) => {
      for (const reading of readings) {
        const prevStates = priorStates.get(reading.date) ?? new Map<string, SlotState>();
        const prevSeenAt = lastPolled.get(reading.date) ?? null;
        const rows: (typeof snozoneSlotObservations.$inferInsert)[] = [];

        for (const slot of reading.slots) {
          slotsSeen += 1;
          if (!hasSlotChanged(prevStates.get(slot.time), slot)) continue;
          rows.push({
            runId: run.id,
            productRowId: product.id,
            sessionDate: reading.date,
            slotTime: slot.time,
            observedAt,
            prevSeenAt,
            starting: slot.starting,
            fromPrior: slot.fromPrior,
            onSlope: slot.onSlope,
            qtyAvailable: slot.qtyAvailable,
            totalQty: slot.totalQty,
            available: slot.available,
            soldOut: slot.soldOut,
            blocked: slot.blocked,
            lowAvailability: slot.lowAvailability,
            callToBook: slot.callToBook,
            reason: slot.reason,
            price: slot.price,
            slotType: slot.slotType,
            experience: slot.experience,
            expiredWhenSeen: isSlotExpired(local, reading.date, slot.time),
          });
        }

        if (rows.length > 0) {
          await tx.insert(snozoneSlotObservations).values(rows);
          changesWritten += rows.length;
        }
      }
    });

    return finish('ok', {
      datesPolled: targets, datesSkipped: skipped, horizonLength: horizon.length,
      slotsSeen, changesWritten,
    });
  } catch (err) {
    const status: RunStatus =
      err instanceof SnozoneError
        ? err.kind === 'blocked'
          ? 'blocked'
          : err.kind === 'unprimed'
            ? 'unprimed'
            : 'error'
        : 'error';
    const message = err instanceof Error ? err.message : String(err);
    return finish(status, { error: message });
  }
}
