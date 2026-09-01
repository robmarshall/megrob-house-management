import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { snozoneProducts, snozonePollRuns } from '../db/schema.js';
import {
  assessCollectorHealth,
  type CollectorHealth,
  type RunHistoryEntry,
  type RunOutcome,
} from '../lib/snozoneHealth.js';
import { WINDOW_DAYS } from '../lib/snozoneWindow.js';
import { toIso } from '../lib/pgTime.js';

/**
 * Operational view of the Snozone collector, for the admin settings tab.
 *
 * The point of this is to make silence legible. A collector that has stopped
 * looks exactly like a quiet slope from the outside — no errors, no rows — so
 * the useful signals are the ones that describe absence: when a successful run
 * last happened, how long the gap is, whether dates are still being covered.
 */

export interface RunRow {
  id: number;
  mode: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  datesPolled: string[] | null;
  datesSkipped: string[] | null;
  slotsSeen: number | null;
  changesWritten: number | null;
  httpCalls: number | null;
  error: string | null;
}

export interface ObservationStats {
  rows: number;
  distinctDates: number;
  firstAt: string | null;
  lastAt: string | null;
  rowsLast24h: number;
  changesLast24h: number;
}

export interface FinalsStats {
  rows: number;
  distinctDates: number;
  latestDate: string | null;
}

export interface DateCoverage {
  sessionDate: string;
  observations: number;
  slots: number;
  lastObservedAt: string | null;
  /** Latest known headcount, ignoring post-start readings. */
  peakOnSlope: number | null;
}

export interface ProductStatus {
  id: number;
  label: string;
  active: boolean;
  health: CollectorHealth;
  runs: RunRow[];
}

export interface SnozoneStatus {
  products: ProductStatus[];
  observations: ObservationStats;
  finals: FinalsStats;
  coverage: DateCoverage[];
  generatedAt: Date;
}

const RUNS_SHOWN = 12;

async function loadRuns(productRowId: number): Promise<RunRow[]> {
  return db
    .select({
      id: snozonePollRuns.id,
      mode: snozonePollRuns.mode,
      status: snozonePollRuns.status,
      startedAt: snozonePollRuns.startedAt,
      finishedAt: snozonePollRuns.finishedAt,
      datesPolled: snozonePollRuns.datesPolled,
      datesSkipped: snozonePollRuns.datesSkipped,
      slotsSeen: snozonePollRuns.slotsSeen,
      changesWritten: snozonePollRuns.changesWritten,
      httpCalls: snozonePollRuns.httpCalls,
      error: snozonePollRuns.error,
    })
    .from(snozonePollRuns)
    .where(eq(snozonePollRuns.productRowId, productRowId))
    .orderBy(desc(snozonePollRuns.startedAt))
    .limit(RUNS_SHOWN);
}

export async function getSnozoneStatus(): Promise<SnozoneStatus> {
  const products = await db.select().from(snozoneProducts).orderBy(snozoneProducts.id);
  const now = new Date();

  const productStatuses: ProductStatus[] = [];
  for (const product of products) {
    const runs = await loadRuns(product.id);
    const history: RunHistoryEntry[] = runs
      .filter((r) => r.status !== 'running')
      .map((r) => ({ status: r.status as RunOutcome, startedAt: r.startedAt }));

    productStatuses.push({
      id: product.id,
      label: product.label,
      active: product.active,
      health: assessCollectorHealth(history, now),
      runs,
    });
  }

  const [obs] = await db.execute<{
    rows: number; distinct_dates: number; first_at: Date | null; last_at: Date | null;
    rows_24h: number; changes_24h: number;
  }>(sql`
    SELECT count(*)::int                                              AS rows,
           count(DISTINCT session_date)::int                          AS distinct_dates,
           min(observed_at)                                           AS first_at,
           max(observed_at)                                           AS last_at,
           count(*) FILTER (WHERE observed_at > now() - interval '24 hours')::int AS rows_24h,
           count(*) FILTER (WHERE observed_at > now() - interval '24 hours'
                              AND prev_seen_at IS NOT NULL)::int      AS changes_24h
    FROM snozone_slot_observations
  `);

  const [finals] = await db.execute<{
    rows: number; distinct_dates: number; latest_date: string | null;
  }>(sql`
    SELECT count(*)::int                     AS rows,
           count(DISTINCT session_date)::int AS distinct_dates,
           max(session_date)::text           AS latest_date
    FROM snozone_slot_finals
  `);

  // Per-date coverage for the dates currently in play. peak_on_slope excludes
  // post-start readings, which report nonsense (brief.md §10.2a).
  //
  // Capped to the high-resolution window's own horizon (today + WINDOW_DAYS-1)
  // rather than to the newest dates outright. Ordering by date alone made this
  // table useless the moment the daily horizon sweep started reaching a month
  // ahead: the ten "most recent" dates were then all future ones, each showing
  // the same uninformative single daily touch, and the past dates the table
  // exists to vouch for fell off the bottom. Anything beyond the window is
  // polled once a day, so its row can only ever read `observations = slots`.
  const coverage = await db.execute<{
    session_date: string; observations: number; slots: number;
    last_observed_at: Date; peak_on_slope: number | null;
  }>(sql`
    SELECT session_date::text                     AS session_date,
           count(*)::int                          AS observations,
           count(DISTINCT slot_time)::int         AS slots,
           max(observed_at)                       AS last_observed_at,
           max(on_slope) FILTER (
             WHERE observed_at < ((session_date + slot_time::time) AT TIME ZONE 'Europe/London')
           )::int                                 AS peak_on_slope
    FROM snozone_slot_observations
    -- The ::int cast is required, not decorative: a bare bind parameter leaves
    -- "date + $1" ambiguous between the date+integer and date+interval
    -- operators, and Postgres rejects it outright rather than guessing.
    WHERE session_date <=
          (now() AT TIME ZONE 'Europe/London')::date + ${WINDOW_DAYS - 1}::int
    GROUP BY session_date
    ORDER BY session_date DESC
    LIMIT 10
  `);

  return {
    products: productStatuses,
    observations: {
      rows: obs?.rows ?? 0,
      distinctDates: obs?.distinct_dates ?? 0,
      firstAt: toIso(obs?.first_at),
      lastAt: toIso(obs?.last_at),
      rowsLast24h: obs?.rows_24h ?? 0,
      changesLast24h: obs?.changes_24h ?? 0,
    },
    finals: {
      rows: finals?.rows ?? 0,
      distinctDates: finals?.distinct_dates ?? 0,
      latestDate: finals?.latest_date ?? null,
    },
    coverage: [...coverage].map((c) => ({
      sessionDate: c.session_date,
      observations: c.observations,
      slots: c.slots,
      lastObservedAt: toIso(c.last_observed_at),
      peakOnSlope: c.peak_on_slope,
    })),
    generatedAt: now,
  };
}
