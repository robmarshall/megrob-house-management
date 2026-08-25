/**
 * Date-window arithmetic for the Snozone collector: which dates a run polls,
 * and whether a slot has expired.
 *
 * Pure and I/O-free on purpose — this is where the timezone bugs would live, and
 * they are far easier to test than to notice in production.
 *
 * TIMEZONE (PLAN.md §12.3): slot times are venue-local (Europe/London, which
 * observes BST) while the container runs on UTC. Every comparison between "now"
 * and a slot time therefore has to happen in London time, not UTC, or every
 * summer reading lands in the wrong bucket and day boundaries drift by an hour
 * for half the year. Nothing here uses the host timezone.
 */

export const VENUE_TZ = 'Europe/London';

/** Today, tomorrow, the day after: the high-resolution window (PLAN.md §1). */
export const WINDOW_DAYS = 3;

export interface VenueNow {
  /** Venue-local calendar date, 'YYYY-MM-DD'. */
  date: string;
  /** Venue-local minutes since midnight. */
  minutes: number;
}

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: VENUE_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Resolve an instant to the venue's local date and time-of-day. */
export function venueNow(now: Date): VenueNow {
  const p: Record<string, string> = {};
  for (const { type, value } of PARTS.formatToParts(now)) p[type] = value;
  // 'en-GB' can render midnight as hour 24; normalise it to 0.
  const hour = Number(p.hour) % 24;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: hour * 60 + Number(p.minute),
  };
}

/** 'HH:MM' -> minutes since midnight. Returns null for anything malformed. */
export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Add whole days to a 'YYYY-MM-DD' string, in calendar terms. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Has this slot's start time passed in venue-local terms?
 *
 * Used to decide which readings are trustworthy: an observation is only usable
 * for occupancy if it was taken strictly BEFORE the slot started, because
 * Snozone zeroes `qtyavailable` and stops decrementing `peopleFromPriorSession`
 * afterwards (brief §10.2a, PLAN.md §12.1).
 */
export function isSlotExpired(now: VenueNow, sessionDate: string, slotTime: string): boolean {
  if (sessionDate < now.date) return true;
  if (sessionDate > now.date) return false;
  const start = toMinutes(slotTime);
  if (start === null) return false;
  return now.minutes > start;
}

/**
 * Is every slot on this date already past its start time?
 *
 * `lastSlotTime` is the latest slot we have ever recorded for that date; null
 * when we have never seen it, in which case the date must be polled — we cannot
 * conclude a date is finished from data we do not have.
 */
export function isDateFinished(
  now: VenueNow,
  date: string,
  lastSlotTime: string | null
): boolean {
  if (date < now.date) return true;
  if (date > now.date) return false;
  if (!lastSlotTime) return false;
  const last = toMinutes(lastSlotTime);
  if (last === null) return false;
  return now.minutes > last;
}

export interface WindowSelection {
  dates: string[];
  /** Dates dropped because nothing about them can change any more. */
  skipped: string[];
}

/**
 * Dates for a `window` run: today, +1 and +2, intersected with what Snozone
 * actually advertises as bookable.
 *
 * Today drops out once its last slot has started (PLAN.md §5.2a) — those
 * readings are frozen and corrupted, so re-reading them all evening adds
 * nothing but poisoned rows. This does NOT apply overnight: from midnight,
 * "today" is a fresh date whose slots are all in the future.
 */
export function selectWindowDates(
  horizon: string[],
  now: VenueNow,
  lastSlotByDate: Record<string, string | null> = {}
): WindowSelection {
  const bookable = new Set(horizon);
  const dates: string[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < WINDOW_DAYS; i += 1) {
    const date = addDays(now.date, i);
    if (!bookable.has(date)) continue;
    if (isDateFinished(now, date, lastSlotByDate[date] ?? null)) skipped.push(date);
    else dates.push(date);
  }
  return { dates, skipped };
}

/**
 * Dates for the daily `horizon` run: everything beyond the high-resolution
 * window, so the two modes never fetch the same date twice.
 *
 * This is what makes the booking lifecycle observable end to end — a date enters
 * the horizon empty and is sampled daily until it reaches the 30-minute window
 * for its final 72 hours (PLAN.md §5.1).
 */
export function selectHorizonDates(horizon: string[], now: VenueNow): string[] {
  const first = addDays(now.date, WINDOW_DAYS);
  return horizon.filter((d) => d >= first);
}
