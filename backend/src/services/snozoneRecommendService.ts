import { toMinutes, isSlotExpired, type VenueNow } from '../lib/snozoneWindow.js';

/**
 * The presence-window ranking: "when should I go?"
 *
 * Ported from phase 0's viewer (`snozone-booking/public/app.js:5-91` —
 * `londonNow`, `toMinutes`, `isPast`, the tunables, `windowStats`,
 * `presenceOf`, `bestAfter`) per docs/snozone-frontend-plan.md §4. Pure and
 * DB-free on purpose: this is "the one genuinely subtle piece of logic in the
 * project" (frontend plan §4), so it needs to be testable in isolation and
 * reusable by a future MCP tool without dragging Postgres along with it. All
 * date/time reasoning is delegated to `snozoneWindow.ts` rather than
 * reimplemented here.
 *
 * The idea carried over unchanged: a booking is for one HOUR, but you are
 * physically on the slope for longer than that — early to make the most of
 * it, and still riding for a few minutes after the hour ends. Ranking on the
 * booked hour alone can pick a quiet hour that opens right in front of a
 * rush; ranking on the full PRESENCE WINDOW (`start - early` to
 * `start + session + stay`) does not. Phase 0 confirmed these genuinely
 * differ in practice (frontend plan §3.1: quietest instant, quietest booked
 * hour and quietest presence window all landed on different times on the
 * same day).
 *
 * The caller is responsible for what "onSlope" means for each point. For
 * this to be meaningful it must come from observations taken strictly before
 * each slot's own start time (PLAN.md §12.1) — see
 * `snozoneAvailabilityService.getTrustworthySlots`, which is the only
 * intended source of `RecommendSlotInput` in production.
 */

/** Snozone publishes slots on a 5-minute grid (verified live, PLAN.md §5.1). */
export const SLOT_STEP_MINUTES = 5;

export interface RecommendParams {
  /** Hour of day (0-23) after which a slot is worth considering. */
  after: number;
  /** Length of the booked session, in minutes. */
  session: number;
  /** Minutes on the slope before the booked start. */
  early: number;
  /** Minutes on the slope after the booked session ends. */
  stay: number;
}

/** Phase 0's defaults (app.js:29-40), unchanged. */
export const DEFAULT_RECOMMEND_PARAMS: RecommendParams = {
  after: 16,
  session: 60,
  early: 15,
  stay: 10,
};

/** One slot's trustworthy occupancy, as the ranking sees it. */
export interface RecommendSlotInput {
  time: string; // 'HH:MM'
  onSlope: number;
  available: boolean;
  totalQty: number;
}

export interface Pick {
  time: string;
  label: string;
  /** 'HH:MM' — start of the full presence window (start - early). */
  presenceFrom: string;
  /** 'HH:MM' — end of the full presence window (start + session + stay). */
  presenceTo: string;
  avgOnSlope: number;
  peakOnSlope: number;
  capacity: number;
  /** Fraction (0-1) of the presence window actually covered by readings. */
  coverage: number;
}

export type Confidence = 'good' | 'thin' | 'none';

export interface RecommendResult {
  pick: Pick | null;
  ranked: Pick[];
  confidence: Confidence;
  note: string | null;
}

/** "ranked = best ~10" per the API contract. */
const RANKED_LIMIT = 10;

/**
 * Below this summed onSlope across the whole date, and more than a couple of
 * days out, treat the pick as not meaningful rather than confidently wrong
 * (PLAN.md §7.4, brief §10.5a: "Occupancy on future dates is bookings-so-far,
 * not expected attendance. Beyond ~2 days out every slot reads near-zero.").
 */
const NONE_LEAD_DAYS = 2;
const NONE_THRESHOLD_TOTAL_ON_SLOPE = 15;
/** Below this, a pick exists but is built on few observed bookings. */
const THIN_THRESHOLD_TOTAL_ON_SLOPE = 40;

interface Point {
  mins: number;
  onSlope: number;
}

interface WindowStats {
  avg: number;
  peak: number;
  min: number;
  readings: number;
  /** Minutes of the window actually covered by readings (not a fraction). */
  coverageMinutes: number;
  complete: boolean;
}

/**
 * Occupancy stats for `[from, to)`. Readings are every `SLOT_STEP_MINUTES`;
 * near the edges of the published day the data runs out, so partial coverage
 * is reported rather than silently averaged over fewer points (app.js:42-44).
 */
export function occupancyWindowStats(pts: Point[], from: number, to: number): WindowStats | null {
  const inWin = pts.filter((p) => p.mins >= from && p.mins < to);
  if (inWin.length === 0) return null;
  const occ = inWin.map((p) => p.onSlope);
  const first = Math.min(...inWin.map((p) => p.mins));
  const last = Math.max(...inWin.map((p) => p.mins)) + SLOT_STEP_MINUTES;
  const covered = Math.min(to, last) - Math.max(from, first);
  return {
    avg: occ.reduce((n, v) => n + v, 0) / occ.length,
    peak: Math.max(...occ),
    min: Math.min(...occ),
    readings: inWin.length,
    coverageMinutes: covered,
    complete: covered >= to - from,
  };
}

/** The full stretch you are actually on the slope for a booked start. */
export function presenceWindow(
  startMins: number,
  params: RecommendParams
): { from: number; to: number } {
  return { from: startMins - params.early, to: startMins + params.session + params.stay };
}

/** Minutes-of-day -> 'HH:MM', wrapping past midnight like the original (app.js:68-69). */
function fmtMins(m: number): string {
  const wrapped = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

function leadDays(now: VenueNow, date: string): number {
  const a = Date.parse(`${now.date}T00:00:00Z`);
  const b = Date.parse(`${date}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

interface Candidate {
  slot: RecommendSlotInput;
  mins: number;
  window: { from: number; to: number };
  stats: WindowStats;
}

/**
 * Same priority order as phase 0's tie-break (app.js:85-90): a fully-covered
 * window ranks above a partial one (a partially-published window averages
 * over fewer readings, which can make a late start look artificially quiet),
 * then lower average occupancy, then lower peak, then the earlier start.
 */
function compareCandidates(a: Candidate, b: Candidate): number {
  if (a.stats.complete !== b.stats.complete) return a.stats.complete ? -1 : 1;
  if (a.stats.avg !== b.stats.avg) return a.stats.avg - b.stats.avg;
  if (a.stats.peak !== b.stats.peak) return a.stats.peak - b.stats.peak;
  return a.mins - b.mins;
}

function assessConfidence(
  totalOnSlope: number,
  candidateCount: number,
  now: VenueNow,
  date: string
): { confidence: Confidence; note: string | null } {
  if (candidateCount === 0) {
    return {
      confidence: 'none',
      note: 'No bookable slots found for this date with the current settings.',
    };
  }

  const lead = leadDays(now, date);
  if (lead > NONE_LEAD_DAYS && totalOnSlope < NONE_THRESHOLD_TOTAL_ON_SLOPE) {
    return {
      confidence: 'none',
      note:
        `This date is ${lead} days out. Snozone only shows bookings made so far, ` +
        'not expected attendance, so occupancy this far ahead reads near-zero for ' +
        'every slot and any pick right now would be an arbitrary tie-break rather ' +
        'than a real recommendation.',
    };
  }

  if (totalOnSlope < THIN_THRESHOLD_TOTAL_ON_SLOPE) {
    return {
      confidence: 'thin',
      note: 'Only a handful of bookings recorded so far for this date — treat this as a rough guide.',
    };
  }

  return { confidence: 'good', note: null };
}

/**
 * Rank bookable slots by how quiet the caller's presence window is, and pick
 * the best one. `slots` should be one entry per known slot for `date`, with
 * trustworthy (pre-expiry) occupancy — see the module doc.
 */
export function rankPresenceWindows(
  slots: RecommendSlotInput[],
  date: string,
  now: VenueNow,
  params: RecommendParams = DEFAULT_RECOMMEND_PARAMS
): RecommendResult {
  const pts: Point[] = [];
  for (const s of slots) {
    const mins = toMinutes(s.time);
    if (mins === null) continue;
    pts.push({ mins, onSlope: s.onSlope });
  }

  const capacity = slots.reduce((max, s) => Math.max(max, s.totalQty || 0), 0);
  const totalOnSlope = pts.reduce((n, p) => n + p.onSlope, 0);

  const candidates: Candidate[] = [];
  for (const s of slots) {
    const mins = toMinutes(s.time);
    if (mins === null) continue;
    if (!s.available) continue;
    if (isSlotExpired(now, date, s.time)) continue;
    if (mins < params.after * 60) continue;

    const window = presenceWindow(mins, params);
    const stats = occupancyWindowStats(pts, window.from, window.to);
    if (!stats || stats.coverageMinutes < params.session / 2) continue;

    candidates.push({ slot: s, mins, window, stats });
  }

  candidates.sort(compareCandidates);

  const ranked: Pick[] = candidates.slice(0, RANKED_LIMIT).map((c) => {
    const span = c.window.to - c.window.from;
    return {
      time: c.slot.time,
      label: c.slot.time, // slot_time is all that is persisted; see snozoneAvailabilityService.
      presenceFrom: fmtMins(c.window.from),
      presenceTo: fmtMins(c.window.to),
      avgOnSlope: Math.round(c.stats.avg * 10) / 10,
      peakOnSlope: c.stats.peak,
      capacity,
      coverage: span > 0 ? Math.min(1, c.stats.coverageMinutes / span) : 0,
    };
  });

  const { confidence, note } = assessConfidence(totalOnSlope, candidates.length, now, date);
  const pick = confidence === 'none' ? null : (ranked[0] ?? null);

  return { pick, ranked, confidence, note };
}
