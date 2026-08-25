import { logger } from './logger.js';

/**
 * Snozone booking-site client. A TypeScript port of the phase 0 prototype's
 * `snozone.js` (see PLAN.md §3), and the ONLY place Snozone's raw field names,
 * header replication and session priming appear.
 *
 * READ-ONLY BY CONSTRUCTION. It implements `getGroupDates` and
 * `getBookingTimesGroup` and nothing else. `setTime` holds a slot and puts it in
 * a basket; `delTime` releases one. Neither exists here, neither is reachable
 * from any route, and neither should be added without a deliberate decision —
 * see brief.md §10.3.
 *
 * Two upstream behaviours drive most of the defensive code:
 *
 * 1. Both endpoints read the selected activity out of the PHP session. Query
 *    parameters alone do not select it, and an unprimed session returns `[]`
 *    with HTTP 200 — indistinguishable from "no availability" (brief §10.2).
 * 2. Cloudflare fronts the site, and a challenge is also an HTTP 200, carrying
 *    HTML rather than JSON (brief §10.4).
 *
 * Neither looks like an error, so both are detected explicitly and surfaced as
 * a typed failure. The collector must never record either as real data.
 */

const BASE = 'https://snozoneuk.com';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const CHALLENGE =
  /just a moment|cf-browser-verification|challenge-platform|cdn-cgi\/challenge/i;

/** Minimum gap between upstream calls. Keeps the request rate human (brief §7). */
const MIN_GAP_MS = 350;
/** Extra random spacing so calls do not land on a metronome (PLAN.md §11). */
const JITTER_MS = 250;

export type SnozoneFailure = 'blocked' | 'unprimed' | 'transport' | 'malformed';

export class SnozoneError extends Error {
  readonly kind: SnozoneFailure;
  /** Metadata only — never cookies, never credentials (brief §6). */
  readonly meta: Record<string, unknown>;

  constructor(kind: SnozoneFailure, message: string, meta: Record<string, unknown> = {}) {
    super(message);
    this.name = 'SnozoneError';
    this.kind = kind;
    this.meta = meta;
  }
}

export interface SnozoneProductConfig {
  locationId: number;
  categoryId: number;
  productId: number;
  qty: number;
  /** urlencoded body POSTed to buildSessionGroup.php to select the product. */
  primeBody: string;
}

/** A slot as the rest of the system sees it. Snozone's field names stop here. */
export interface NormalisedSlot {
  time: string;
  label: string;
  available: boolean;
  /** Genuinely at capacity — NOT the same as soldOut, see isTrulyFull(). */
  full: boolean;
  qtyAvailable: number;
  totalQty: number;
  /** totalPeopleInSession: people whose session STARTS here. The booking signal. */
  starting: number;
  /** peopleFromPriorSession: people carried in from earlier starts. */
  fromPrior: number;
  /** starting + fromPrior: headcount on the slope. The busyness signal. */
  onSlope: number;
  price: string | null;
  slotType: string;
  experience: string;
  soldOut: boolean;
  blocked: boolean;
  lowAvailability: boolean;
  callToBook: boolean;
  reason: string;
}

/** Raw upstream shape. Every field optional — do not trust it to be present. */
interface RawSlot {
  available?: unknown;
  qtyavailable?: unknown;
  totalqty?: unknown;
  totalPeopleInSession?: unknown;
  peopleFromPriorSession?: unknown;
  timelabel?: unknown;
  totalOverallPrice?: unknown;
  price?: unknown;
  type?: unknown;
  experiencename?: unknown;
  isSoldOut?: unknown;
  isBlockedOut?: unknown;
  lessthan5available?: unknown;
  calltobook?: unknown;
  reason?: unknown;
}

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Normalise one raw slot.
 *
 * `onSlope` is the sum of the two population fields, not `totalqty -
 * qtyavailable`. The two agree exactly for every bookable slot (verified
 * against live data, zero mismatches), but the sum survives a slot expiring
 * while `qtyavailable` does not — Snozone zeroes that once a slot can no longer
 * be booked, regardless of how empty it was (brief §10.2a).
 */
export function normaliseSlot(time: string, raw: RawSlot): NormalisedSlot {
  const totalQty = num(raw.totalqty);
  const starting = num(raw.totalPeopleInSession);
  const fromPrior = num(raw.peopleFromPriorSession);
  const onSlope = starting + fromPrior;

  return {
    time,
    label: str(raw.timelabel) || time,
    available: Boolean(raw.available) && !raw.isSoldOut && !raw.isBlockedOut,
    full: totalQty > 0 && onSlope >= totalQty,
    qtyAvailable: num(raw.qtyavailable),
    totalQty,
    starting,
    fromPrior,
    onSlope,
    price: raw.totalOverallPrice != null ? String(raw.totalOverallPrice)
      : raw.price != null ? String(raw.price) : null,
    slotType: str(raw.type),
    experience: str(raw.experiencename),
    soldOut: Boolean(raw.isSoldOut),
    blocked: Boolean(raw.isBlockedOut),
    lowAvailability: Boolean(raw.lessthan5available),
    callToBook: Boolean(raw.calltobook),
    reason: str(raw.reason),
  };
}

/**
 * A slot is only genuinely full when the headcount has reached capacity.
 *
 * `soldOut` and `blocked` are about TIME, not capacity: Snozone sets them once a
 * slot can no longer be booked whatever its occupancy — today's 10:00 reports
 * soldOut with 67 of 80 places taken. Never read those flags as "full"
 * (brief §10.2a).
 */
export function isTrulyFull(slot: NormalisedSlot): boolean {
  return slot.totalQty > 0 && slot.onSlope >= slot.totalQty;
}

/**
 * One Snozone session. Holds a cookie jar for its lifetime and is then thrown
 * away.
 *
 * Deliberately in-memory: a jar on disk does not survive a container restart and
 * would be shared unsafely between the API and worker processes. Priming costs
 * three requests (~1s), which is cheap per 30-minute run, and a fresh session
 * each time is more robust than a months-old PHPSESSID.
 */
export class SnozoneSession {
  private readonly jar = new Map<string, string>();
  private lastCall = 0;
  private primed = false;
  /** Upstream requests issued by this session, for the run ledger. */
  httpCalls = 0;

  constructor(private readonly config: SnozoneProductConfig) {}

  private cookieHeader(): string {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private absorb(res: Response): void {
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const pair = line.split(';')[0];
      const i = pair.indexOf('=');
      if (i > 0) this.jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }

  /** Never fire two upstream calls back to back, and never on an exact rhythm. */
  private async pace(): Promise<void> {
    const gap = MIN_GAP_MS + Math.floor(Math.random() * JITTER_MS);
    const wait = gap - (Date.now() - this.lastCall);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCall = Date.now();
  }

  private async call(
    path: string,
    opts: { method?: 'GET' | 'POST'; body?: string; referer?: string; ajax?: boolean } = {}
  ): Promise<string> {
    await this.pace();
    const { method = 'GET', body, referer, ajax } = opts;

    const headers: Record<string, string> = {
      'User-Agent': UA,
      'Accept-Language': 'en-GB,en;q=0.9',
      Accept: ajax ? '*/*' : 'text/html,application/xhtml+xml,*/*;q=0.8',
    };
    if (ajax) {
      headers['X-Requested-With'] = 'XMLHttpRequest';
      headers.Origin = BASE;
    }
    if (referer) headers.Referer = referer;
    if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const cookies = this.cookieHeader();
    if (cookies) headers.Cookie = cookies;

    let res: Response;
    this.httpCalls += 1;
    try {
      res = await fetch(`${BASE}${path}`, { method, headers, body, redirect: 'manual' });
    } catch (err) {
      throw new SnozoneError('transport', `Request to ${path} failed`, {
        path,
        cause: err instanceof Error ? err.message : String(err),
      });
    }

    this.absorb(res);
    const text = await res.text();

    // A challenge is an HTTP 200 carrying HTML. Detect it before parsing.
    if (res.status === 403 || CHALLENGE.test(text)) {
      throw new SnozoneError('blocked', 'Blocked by bot protection', {
        path,
        status: res.status,
      });
    }
    return text;
  }

  private parseJson(text: string, path: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      throw new SnozoneError('malformed', 'Upstream returned non-JSON', {
        path,
        bodyStart: text.slice(0, 120),
      });
    }
  }

  /**
   * Put the product into the PHP session. All three calls are required, in
   * order: skipping the final GET leaves the endpoints returning `[]` even
   * though the POST returned a clean 302 (brief §10.2).
   */
  async prime(): Promise<void> {
    const entry = `${BASE}/book/lift-passes/${this.config.categoryId}`;
    await this.call(`/book/lift-passes/${this.config.categoryId}`, { referer: `${BASE}/` });
    await this.call('/booking/buildSessionGroup.php', {
      method: 'POST',
      body: this.config.primeBody,
      referer: entry,
    });
    await this.call('/booking/activityGrouped.php', { referer: entry });
    this.primed = true;
    logger.debug({ productId: this.config.productId }, 'Snozone session primed');
  }

  /**
   * Run `fn`, and if it comes back empty, prime once and try again. An empty
   * response means "not primed" far more often than "no availability", so the
   * retry has to happen before the caller can treat emptiness as real.
   */
  private async withPriming<T>(fn: () => Promise<T>, isEmpty: (v: T) => boolean): Promise<T> {
    if (!this.primed) await this.prime();
    const first = await fn();
    if (!isEmpty(first)) return first;

    logger.debug('Empty Snozone response; re-priming and retrying once');
    await this.prime();
    return fn();
  }

  /** Bookable dates from `from` onward. Rolling ~31 days at time of writing. */
  async getDates(from: string): Promise<string[]> {
    const q = new URLSearchParams({
      getGroupDates: '1',
      locationId: String(this.config.locationId),
      categoryId: String(this.config.categoryId),
      productId: String(this.config.productId),
      qty: String(this.config.qty),
      newDate: from,
      getminprice: '0',
    });
    const path = `/booking/ajaxGrouped.php?${q}`;

    const fetchDates = async (): Promise<string[]> => {
      const data = this.parseJson(await this.call(path, { ajax: true }), path);
      return Array.isArray(data) ? data.filter((d): d is string => typeof d === 'string') : [];
    };

    const dates = await this.withPriming(fetchDates, (d) => d.length === 0);
    if (dates.length === 0) {
      throw new SnozoneError('unprimed', 'getGroupDates returned [] after re-priming', { path });
    }
    return dates;
  }

  /**
   * Slot availability for one date.
   *
   * NOTE: `group` is deliberately absent from the query — the live site omits it
   * and the server ignores it (brief §10.1).
   */
  async getTimes(date: string): Promise<NormalisedSlot[]> {
    const q = new URLSearchParams({
      getBookingTimesGroup: '1',
      selectedDate: date,
      block: '',
    });
    const path = `/booking/ajaxGrouped.php?${q}`;

    const fetchTimes = async (): Promise<NormalisedSlot[]> => {
      const data = this.parseJson(await this.call(path, { ajax: true }), path);
      // An unprimed session yields `[]` (an array); real data is an object
      // keyed by "HH:MM". The array/object distinction is itself the signal.
      if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
      return Object.entries(data as Record<string, RawSlot>).map(([time, raw]) =>
        normaliseSlot(time, raw)
      );
    };

    const slots = await this.withPriming(fetchTimes, (s) => s.length === 0);
    if (slots.length === 0) {
      throw new SnozoneError('unprimed', `getBookingTimesGroup returned no slots for ${date}`, {
        path,
        date,
      });
    }
    return slots;
  }
}
