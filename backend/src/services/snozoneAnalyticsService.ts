import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { VENUE_TZ, WINDOW_DAYS } from '../lib/snozoneWindow.js';
import { toIso } from '../lib/pgTime.js';

/**
 * Aggregations for the Patterns page (docs/snozone-frontend-plan.md §3.2).
 *
 * Postgres only, like everything else the frontend can reach — the collector is
 * the sole upstream caller. The heavy reads go to `snozone_slot_finals`
 * (~44k rows a year) rather than the raw observations, which is the reason that
 * rollup exists; only the booking-event analytics read the raw table, through
 * the `snozone_booking_events` view that encodes the diff-on-starting rule.
 *
 * Two properties are deliberate throughout.
 *
 * **Every bucket is venue-local.** Day-of-week and hour-of-day are the entire
 * subject matter here, and computing them in UTC would smear every summer
 * reading by an hour and put some late-evening bookings on the wrong day
 * (PLAN.md §12.3). So every EXTRACT runs on a timestamp already converted
 * AT TIME ZONE.
 *
 * **Every analytic reports its own maturity.** A chart drawn from two days of
 * data is worse than no chart, because it invites conclusions the data cannot
 * support (frontend plan §5). Rather than leaving the frontend to guess, each
 * result carries a `maturity` describing what it needs, what it has, and
 * whether it is ready — which is what `<InsufficientData>` renders.
 *
 * Known constraint: none of these filter by `product_row_id`. Only one product
 * is seeded and the API contract carries no product selector (PLAN.md §4.1), so
 * today this is exact rather than approximate — but a second product would make
 * every figure here a silent sum across both. Adding one means adding the
 * filter, and this comment is the reminder.
 */

/* ------------------------------------------------------------------ maturity */

export interface Maturity {
  /** How much is needed before the chart means anything. */
  needs: number;
  /** How much there actually is. */
  have: number;
  /** What is being counted, for the empty state's prose. */
  unit: string;
  ready: boolean;
}

function maturity(needs: number, have: number, unit: string): Maturity {
  return { needs, have, unit, ready: have >= needs };
}

/**
 * Thresholds from the frontend plan's §5 table, named so the numbers are
 * arguable in one place rather than buried in four queries.
 */
export const THRESHOLDS = {
  /** "6-8 samples per weekday" before a day-of-week heatmap says anything. */
  busynessDatesPerWeekday: 6,
  /** "1-2 weeks" of events before a booking time-of-day shape is real. */
  bookingTimesDays: 14,
  /** Enough events that a lead-time histogram is not just a handful of bars. */
  leadTimeEvents: 200,
  /** Several weeks before a week-over-week trend is a trend at all. */
  trendWeeks: 4,
  /** One slot watched across a full pre-booking lifecycle is enough to plot. */
  fillCurveLifecycles: 1,
} as const;

/**
 * How early a slot must have been first seen for its curve to be a lifecycle
 * rather than a fragment.
 *
 * The frontend plan's §5 table asks for "a full D-2 → D lifecycle", and the
 * high-resolution window covers exactly today, +1 and +2. A curve first
 * observed later than this starts partway up the slope and would understate
 * how early the booking happened.
 */
export const FILL_CURVE_LIFECYCLE_HOURS = (WINDOW_DAYS - 1) * 24;

/**
 * Widest bracket that still says something about time of day.
 *
 * The window poll runs every 30 minutes, so a booking inside it is pinned to a
 * ~30 minute span; the daily horizon sweep pins it only to ~24 hours. Bucketing
 * a 24-hour bracket into an hour-of-week cell would be inventing the answer, so
 * the hour-of-week analytic keeps only tight brackets. 40 minutes rather than
 * 30 absorbs a late or slow run without letting a daily sample through.
 */
export const TIGHT_BRACKET_MINUTES = 40;

/* --------------------------------------------------------------- date ranges */

export interface DateRange {
  from: string;
  to: string;
}

/* ------------------------------------------------------- collected dates */

export interface CollectedDate {
  sessionDate: string;
  /** 0 = Sunday, matching JavaScript's getDay(). */
  dow: number;
  /** Slots the timetable actually offered — NOT a constant (frontend plan §5.1). */
  slots: number;
  peakOnSlope: number;
  totalStarting: number;
  /** Earliest observation of this date, i.e. how much of its lifecycle we saw. */
  firstSeenAt: string | null;
  /** Occupancy already booked before the date entered our horizon. */
  firstSeenOnSlope: number;
}

/**
 * Past dates that have been rolled up, newest first.
 *
 * The Patterns page needs this for two things the availability API cannot
 * answer: which prior same-weekday dates exist to ghost behind a fill curve,
 * and how many samples each weekday actually has. `/dates` is no help — it
 * lists *bookable* dates, which are all in the future.
 */
export async function getCollectedDates(limit = 120): Promise<CollectedDate[]> {
  const rows = await db.execute<{
    session_date: string; dow: number; slots: number; peak_on_slope: number;
    total_starting: number; first_seen_at: string | null; first_seen_on_slope: number;
  }>(sql`
    SELECT session_date::text                                   AS session_date,
           EXTRACT(DOW FROM session_date)::int                  AS dow,
           count(*)::int                                        AS slots,
           max(peak_on_slope)::int                              AS peak_on_slope,
           sum(final_starting)::int                             AS total_starting,
           min(first_seen_at)                                   AS first_seen_at,
           sum(first_seen_on_slope)::int                        AS first_seen_on_slope
    FROM snozone_slot_finals
    GROUP BY session_date
    ORDER BY session_date DESC
    LIMIT ${limit}::int
  `);

  return [...rows].map((r) => ({
    sessionDate: r.session_date,
    dow: r.dow,
    slots: r.slots,
    peakOnSlope: r.peak_on_slope,
    totalStarting: r.total_starting,
    firstSeenAt: toIso(r.first_seen_at),
    firstSeenOnSlope: r.first_seen_on_slope,
  }));
}

/* -------------------------------------------------------------- busyness */

export interface BusynessCell {
  dow: number;
  slotTime: string;
  /** How many dates of this weekday offered this slot. */
  samples: number;
  medianOnSlope: number;
  /** median(final_on_slope / total_qty) — fairer when capacity varies. */
  medianFill: number;
}

export interface BusynessResult {
  cells: BusynessCell[];
  /**
   * Dates collected per weekday. A cell absent from `cells` means one of two
   * opposite things and this is how they are told apart: if the weekday has
   * dates, the slot was CLOSED; if it has none, we simply have not looked yet.
   * Rendering both as one blank cell invites the wrong conclusion entirely
   * (frontend plan §5.1).
   */
  datesPerDow: { dow: number; dates: number }[];
  maturity: Maturity;
}

/**
 * Median final occupancy by weekday and time of day.
 *
 * Median rather than mean because a single school-holiday Friday would drag a
 * mean somewhere no ordinary Friday goes; the question this heatmap answers is
 * "what is a typical Friday at 18:30 like".
 *
 * No normalisation by opening hours is needed here and none is done: the cell
 * is already a single (weekday, time) pair, so the Friday-runs-an-hour-later
 * trap only bites the totals in `getTrend`, not this. What Friday's extra hour
 * does produce is cells that exist for Friday and not for Wednesday — which is
 * exactly the closed-vs-empty distinction `datesPerDow` exists to resolve.
 */
export async function getBusyness(range: DateRange): Promise<BusynessResult> {
  const cells = await db.execute<{
    dow: number; slot_time: string; samples: number;
    median_on_slope: string; median_fill: string;
  }>(sql`
    SELECT EXTRACT(DOW FROM session_date)::int AS dow,
           slot_time                           AS slot_time,
           count(*)::int                       AS samples,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY final_on_slope)  AS median_on_slope,
           percentile_cont(0.5) WITHIN GROUP (
             ORDER BY CASE WHEN total_qty > 0
                           THEN final_on_slope::numeric / total_qty
                           ELSE NULL END
           )                                                            AS median_fill
    FROM snozone_slot_finals
    WHERE session_date BETWEEN ${range.from}::date AND ${range.to}::date
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);

  const perDow = await db.execute<{ dow: number; dates: number }>(sql`
    SELECT EXTRACT(DOW FROM session_date)::int   AS dow,
           count(DISTINCT session_date)::int     AS dates
    FROM snozone_slot_finals
    WHERE session_date BETWEEN ${range.from}::date AND ${range.to}::date
    GROUP BY 1
    ORDER BY 1
  `);

  const datesPerDow = [...perDow].map((r) => ({ dow: r.dow, dates: r.dates }));

  // The weakest weekday governs readiness: six Fridays and one Tuesday is not a
  // heatmap you can read across, and reporting the best or the average weekday
  // would call it ready while a whole column is still noise.
  const covered = new Map(datesPerDow.map((d) => [d.dow, d.dates]));
  const worstDow = Math.min(...Array.from({ length: 7 }, (_, i) => covered.get(i) ?? 0));

  return {
    cells: [...cells].map((r) => ({
      dow: r.dow,
      slotTime: r.slot_time,
      samples: r.samples,
      medianOnSlope: Number(r.median_on_slope ?? 0),
      medianFill: Number(r.median_fill ?? 0),
    })),
    datesPerDow,
    maturity: maturity(
      THRESHOLDS.busynessDatesPerWeekday,
      Number.isFinite(worstDow) ? worstDow : 0,
      'samples for the least-covered weekday'
    ),
  };
}

/* --------------------------------------------------------- booking times */

export interface BookingTimeCell {
  dow: number;
  hour: number;
  /** Sum of positive deltas: how many places were booked. */
  bookings: number;
  /** How many distinct booking events, regardless of size. */
  events: number;
}

export interface BookingTimesResult {
  cells: BookingTimeCell[];
  totalBookings: number;
  /**
   * Events dropped for having a bracket too wide to place in an hour. Surfaced
   * rather than silently discarded: if this dwarfs the kept count, the chart is
   * describing the window poll's coverage more than it describes human
   * behaviour, and the reader deserves to know.
   */
  excludedWideBracket: number;
  /** Distinct days contributing tight-bracket events — the maturity measure. */
  days: number;
  maturity: Maturity;
}

/**
 * When bookings are actually MADE, by hour of week.
 *
 * This is research question 1 and nothing but accumulated observation can
 * answer it — Snozone's own API only ever reports the present.
 */
export async function getBookingTimes(range: DateRange): Promise<BookingTimesResult> {
  const cells = await db.execute<{
    dow: number; hour: number; bookings: number; events: number;
  }>(sql`
    SELECT EXTRACT(DOW  FROM booked_at AT TIME ZONE ${VENUE_TZ})::int AS dow,
           EXTRACT(HOUR FROM booked_at AT TIME ZONE ${VENUE_TZ})::int AS hour,
           sum(delta_starting)::int                                   AS bookings,
           count(*)::int                                              AS events
    FROM snozone_booking_events
    WHERE session_date BETWEEN ${range.from}::date AND ${range.to}::date
      AND delta_starting > 0
      AND bracket_minutes <= ${TIGHT_BRACKET_MINUTES}::int
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);

  const [totals] = await db.execute<{
    excluded: number; days: number;
  }>(sql`
    SELECT count(*) FILTER (WHERE bracket_minutes > ${TIGHT_BRACKET_MINUTES}::int)::int AS excluded,
           count(DISTINCT (booked_at AT TIME ZONE ${VENUE_TZ})::date)
             FILTER (WHERE bracket_minutes <= ${TIGHT_BRACKET_MINUTES}::int)::int       AS days
    FROM snozone_booking_events
    WHERE session_date BETWEEN ${range.from}::date AND ${range.to}::date
      AND delta_starting > 0
  `);

  const list = [...cells].map((r) => ({
    dow: r.dow, hour: r.hour, bookings: r.bookings, events: r.events,
  }));

  return {
    cells: list,
    totalBookings: list.reduce((sum, c) => sum + c.bookings, 0),
    excludedWideBracket: totals?.excluded ?? 0,
    days: totals?.days ?? 0,
    maturity: maturity(
      THRESHOLDS.bookingTimesDays,
      totals?.days ?? 0,
      'days of booking events'
    ),
  };
}

/* ------------------------------------------------------------ lead times */

export interface LeadTimeBucket {
  /** Lower edge in minutes; the last bucket is open-ended. */
  fromMinutes: number;
  toMinutes: number | null;
  label: string;
  bookings: number;
  events: number;
}

export interface LeadTimesResult {
  buckets: LeadTimeBucket[];
  totalBookings: number;
  /**
   * The ceiling this distribution is truncated at, in days.
   *
   * No booking made before collection began can ever appear here, so the long
   * tail is not merely sparse, it is structurally absent — and it will stay
   * absent for those dates forever, because Snozone exposes no history. Until
   * this exceeds the booking horizon the chart is a lower bound on lead times,
   * not a measurement of them, and the page must say so.
   */
  observableLeadDays: number;
  maturity: Maturity;
}

const LEAD_BUCKETS: { from: number; to: number | null; label: string }[] = [
  { from: 0, to: 60, label: 'Under 1h' },
  { from: 60, to: 180, label: '1-3h' },
  { from: 180, to: 360, label: '3-6h' },
  { from: 360, to: 720, label: '6-12h' },
  { from: 720, to: 1440, label: '12-24h' },
  { from: 1440, to: 2880, label: '1-2 days' },
  { from: 2880, to: 4320, label: '2-3 days' },
  { from: 4320, to: 10080, label: '3-7 days' },
  { from: 10080, to: 20160, label: '1-2 weeks' },
  { from: 20160, to: null, label: '2+ weeks' },
];

/**
 * The interior edges, i.e. every bucket's lower bound except the first's,
 * as a SQL array literal.
 *
 * Inlined with `sql.raw` rather than bound as a parameter because a JS array
 * passed into a template hole is serialised as a record, and Postgres rejects
 * it outright ("cannot cast type record to integer[]"). These are
 * compile-time constants declared immediately above, never caller input, so
 * there is nothing here to inject. Derived from LEAD_BUCKETS so the SQL and
 * the bar labels cannot drift apart — a mismatch would mislabel every bucket
 * without failing anything.
 */
const LEAD_BUCKET_EDGES_SQL = `ARRAY[${LEAD_BUCKETS.slice(1)
  .map((b) => b.from)
  .join(',')}]::int[]`;

/**
 * How far ahead people book.
 *
 * Unlike the hour-of-week analytic this does NOT filter on bracket width: a
 * daily-sweep booking is placed within 24 hours, which is immaterial against a
 * lead time measured in days, and dropping those rows would bias the
 * distribution towards exactly the short leads the window poll sees best.
 */
export async function getLeadTimes(range: DateRange): Promise<LeadTimesResult> {
  // width_bucket over the bucket edges: values below the first edge land in 0,
  // values at or above the last in LEAD_BUCKETS.length - 1. That maps exactly
  // onto LEAD_BUCKETS, so the boundaries live in one place rather than being
  // restated as SQL — a mismatch between the two would mislabel every bar
  // without failing anything.
  const rows = await db.execute<{
    bucket: number; bookings: number; events: number;
  }>(sql`
    SELECT width_bucket(
             lead_minutes,
             ${sql.raw(LEAD_BUCKET_EDGES_SQL)}
           )::int                   AS bucket,
           sum(delta_starting)::int AS bookings,
           count(*)::int            AS events
    FROM snozone_booking_events
    WHERE session_date BETWEEN ${range.from}::date AND ${range.to}::date
      AND delta_starting > 0
      AND lead_minutes >= 0
    GROUP BY 1
    ORDER BY 1
  `);

  const byBucket = new Map([...rows].map((r) => [r.bucket, r]));
  const buckets = LEAD_BUCKETS.map((b, i) => ({
    fromMinutes: b.from,
    toMinutes: b.to,
    label: b.label,
    bookings: byBucket.get(i)?.bookings ?? 0,
    events: byBucket.get(i)?.events ?? 0,
  }));

  // How far back observation itself reaches: the ceiling on any lead time we
  // could possibly have seen.
  const [span] = await db.execute<{ days: number | null }>(sql`
    SELECT (EXTRACT(EPOCH FROM (now() - min(observed_at))) / 86400)::int AS days
    FROM snozone_slot_observations
  `);

  const totalEvents = buckets.reduce((sum, b) => sum + b.events, 0);

  return {
    buckets,
    totalBookings: buckets.reduce((sum, b) => sum + b.bookings, 0),
    observableLeadDays: span?.days ?? 0,
    maturity: maturity(THRESHOLDS.leadTimeEvents, totalEvents, 'booking events'),
  };
}

/* ----------------------------------------------------------------- trend */

export interface TrendWeek {
  /** ISO week start (Monday), venue-local. */
  weekStart: string;
  dates: number;
  /** Slots the timetable offered across the week — the normaliser. */
  openSlots: number;
  totalStarting: number;
  /**
   * Bookings per open slot. THE comparable figure: Friday runs an hour later
   * than Wednesday and opening hours vary day to day, so a raw weekly total
   * partly measures how many hours the slope was open (frontend plan §5.1).
   */
  startingPerOpenSlot: number;
  peakOnSlope: number;
  meanFill: number;
}

export interface TrendSlotType {
  slotType: string;
  slots: number;
  meanOnSlope: number;
}

export interface TrendResult {
  weeks: TrendWeek[];
  /** Snozone's own demand model, useful as a sanity check on ours. */
  slotTypes: TrendSlotType[];
  maturity: Maturity;
}

/** Weekly peaks and totals, normalised by opening hours. */
export async function getTrend(range: DateRange): Promise<TrendResult> {
  const weeks = await db.execute<{
    week_start: string; dates: number; open_slots: number; total_starting: number;
    peak_on_slope: number; mean_fill: string;
  }>(sql`
    SELECT date_trunc('week', session_date)::date::text AS week_start,
           count(DISTINCT session_date)::int            AS dates,
           count(*)::int                                AS open_slots,
           sum(final_starting)::int                     AS total_starting,
           max(peak_on_slope)::int                      AS peak_on_slope,
           avg(CASE WHEN total_qty > 0
                    THEN final_on_slope::numeric / total_qty
                    ELSE NULL END)                      AS mean_fill
    FROM snozone_slot_finals
    WHERE session_date BETWEEN ${range.from}::date AND ${range.to}::date
    GROUP BY 1
    ORDER BY 1
  `);

  const types = await db.execute<{
    slot_type: string | null; slots: number; mean_on_slope: string;
  }>(sql`
    SELECT slot_type                AS slot_type,
           count(*)::int            AS slots,
           avg(final_on_slope)      AS mean_on_slope
    FROM snozone_slot_finals
    WHERE session_date BETWEEN ${range.from}::date AND ${range.to}::date
      AND slot_type IS NOT NULL
    GROUP BY 1
    ORDER BY 2 DESC
  `);

  const list = [...weeks].map((r) => ({
    weekStart: r.week_start,
    dates: r.dates,
    openSlots: r.open_slots,
    totalStarting: r.total_starting,
    startingPerOpenSlot: r.open_slots > 0 ? r.total_starting / r.open_slots : 0,
    peakOnSlope: r.peak_on_slope,
    meanFill: Number(r.mean_fill ?? 0),
  }));

  return {
    weeks: list,
    slotTypes: [...types].map((r) => ({
      slotType: r.slot_type ?? 'unknown',
      slots: r.slots,
      meanOnSlope: Number(r.mean_on_slope ?? 0),
    })),
    maturity: maturity(THRESHOLDS.trendWeeks, list.length, 'weeks'),
  };
}

/* ----------------------------------------------------------- fill curves */

export interface FillCurvePoint {
  /** Hours before this slot started. Counts DOWN toward 0 as the slot nears. */
  hoursBefore: number
  observedAt: string
  onSlope: number
  starting: number
}

export interface FillCurveSeries {
  sessionDate: string
  /** The date asked for, as opposed to a same-weekday date ghosted behind it. */
  isTarget: boolean
  totalQty: number
  /**
   * How early this slot was first observed. The curve cannot start before it,
   * and drawing back to zero from there would invent a booking history that
   * was never seen.
   */
  firstSeenHoursBefore: number
  /** Occupancy already present at that first sight — booked, but unattributable. */
  firstSeenOnSlope: number
  points: FillCurvePoint[]
}

export interface FillCurvesResult {
  date: string
  slotTime: string
  series: FillCurveSeries[]
  maturity: Maturity
}

/**
 * One slot's occupancy against hours-before-start, with previous same-weekday
 * dates ghosted behind it — "is my slot contested" at a glance.
 *
 * A single slot, deliberately, not a whole day. That is what makes this the one
 * chart opening hours never touch (frontend plan §5.1): Friday running an hour
 * later than Wednesday changes which slots exist, but says nothing about how
 * one 18:00 slot fills, so no normalisation is needed and none is done.
 *
 * Computed server-side rather than assembled in the browser from
 * `/days/:date/history`. That endpoint returns every slot for a date — some
 * three thousand points to use fifty of — so four ghosted dates would ship
 * twelve thousand points over a phone connection to draw a handful. Picking the
 * same-weekday dates needs the database anyway.
 *
 * Curves start at the first real observation and are never extrapolated back to
 * zero. A curve that opens at 60 people means that is when we first looked, not
 * that 60 arrived at once; `firstSeenHoursBefore` lets the chart say so.
 */
export async function getFillCurves(opts: {
  date: string;
  slotTime: string;
  /** How many prior same-weekday dates to ghost behind the target. */
  compare: number;
}): Promise<FillCurvesResult> {
  const { date, slotTime, compare } = opts;

  const rows = await db.execute<{
    session_date: string; observed_at: string; on_slope: number;
    starting: number; total_qty: number; hours_before: string;
  }>(sql`
    WITH slot_start AS (
      SELECT session_date,
             ((session_date + ${slotTime}::time) AT TIME ZONE ${VENUE_TZ}) AS starts_at
      FROM (
        -- The target date, plus the most recent prior dates falling on the same
        -- weekday that actually offered this slot. Same weekday because that is
        -- the comparison a rider makes -- "is this Wednesday busier than last
        -- Wednesday" -- and because demand is far more weekday-shaped than it is
        -- date-shaped.
        SELECT DISTINCT session_date
        FROM snozone_slot_observations
        WHERE slot_time = ${slotTime}
          AND session_date <= ${date}::date
          AND EXTRACT(DOW FROM session_date) = EXTRACT(DOW FROM ${date}::date)
        ORDER BY session_date DESC
        LIMIT ${compare + 1}::int
      ) d
    )
    SELECT o.session_date::text                                            AS session_date,
           o.observed_at                                                   AS observed_at,
           o.on_slope                                                      AS on_slope,
           o.starting                                                      AS starting,
           o.total_qty                                                     AS total_qty,
           (EXTRACT(EPOCH FROM (s.starts_at - o.observed_at)) / 3600)::numeric(10,3)
                                                                           AS hours_before
    FROM snozone_slot_observations o
    JOIN slot_start s USING (session_date)
    WHERE o.slot_time = ${slotTime}
      -- Post-start readings are corrupt (brief.md §10.2a), and on this chart
      -- they would appear as a spike at exactly the moment the answer matters.
      AND o.observed_at < s.starts_at
    ORDER BY o.session_date DESC, o.observed_at ASC
  `);

  const bySeries = new Map<string, FillCurveSeries>();
  for (const r of [...rows]) {
    let series = bySeries.get(r.session_date);
    if (!series) {
      series = {
        sessionDate: r.session_date,
        isTarget: r.session_date === date,
        totalQty: r.total_qty,
        firstSeenHoursBefore: Number(r.hours_before),
        firstSeenOnSlope: r.on_slope,
        points: [],
      };
      bySeries.set(r.session_date, series);
    }
    series.points.push({
      hoursBefore: Number(r.hours_before),
      observedAt: toIso(r.observed_at) ?? '',
      onSlope: r.on_slope,
      starting: r.starting,
    });
  }

  const series = [...bySeries.values()];
  const lifecycles = series.filter(
    (s) => s.firstSeenHoursBefore >= FILL_CURVE_LIFECYCLE_HOURS
  ).length;

  return {
    date,
    slotTime,
    series,
    maturity: maturity(
      THRESHOLDS.fillCurveLifecycles,
      lifecycles,
      'slots watched from first listing to start'
    ),
  };
}
