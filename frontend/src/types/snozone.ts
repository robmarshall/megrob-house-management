/**
 * Snozone collector status (admin only).
 *
 * Mirrors services/snozoneStatusService.ts. Dates arrive as ISO strings.
 */

export type HealthLevel = 'ok' | 'degraded' | 'down'

export interface CollectorHealth {
  status: HealthLevel
  reasons: string[]
  lastOkAt: string | null
  lastRunAt: string | null
  consecutiveFailures: number
  minutesSinceLastOk: number | null
}

export interface RunRow {
  id: number
  mode: string
  status: string
  startedAt: string
  finishedAt: string | null
  datesPolled: string[] | null
  datesSkipped: string[] | null
  slotsSeen: number | null
  changesWritten: number | null
  httpCalls: number | null
  error: string | null
}

export interface ProductStatus {
  id: number
  label: string
  active: boolean
  health: CollectorHealth
  runs: RunRow[]
}

export interface ObservationStats {
  rows: number
  distinctDates: number
  firstAt: string | null
  lastAt: string | null
  rowsLast24h: number
  changesLast24h: number
}

export interface FinalsStats {
  rows: number
  distinctDates: number
  latestDate: string | null
}

export interface DateCoverage {
  sessionDate: string
  observations: number
  slots: number
  lastObservedAt: string
  peakOnSlope: number | null
}

export interface SnozoneStatus {
  products: ProductStatus[]
  observations: ObservationStats
  finals: FinalsStats
  coverage: DateCoverage[]
  generatedAt: string
}

/**
 * Availability + recommendation types.
 *
 * Mirrors the `/api/snozone` availability routes (dates, days, recommend).
 * Times are venue-local 'HH:MM' strings — never pass them through
 * `new Date()` or any timezone conversion.
 *
 * Domain rules baked into these shapes:
 * - `onSlope` is the busyness number, not `starting` — `starting` counts only
 *   sessions beginning in that slot; most people on the snow started earlier
 *   and are in `fromPrior`.
 * - `soldOut` / `blocked` mean "can no longer be booked", not "full". Use the
 *   separate `full` boolean (`onSlope >= totalQty`) for actual fullness.
 * - `expired: true` slots have corrupted counts (a captured reading can
 *   exceed capacity) — de-emphasise them and exclude them from headline
 *   figures.
 */

export interface SnozoneDatesResponse {
  dates: string[]
  lastRunAt: string | null
}

export interface SnozoneSlot {
  time: string
  label: string
  starting: number
  fromPrior: number
  onSlope: number
  qtyAvailable: number
  totalQty: number
  available: boolean
  soldOut: boolean
  blocked: boolean
  lowAvailability: boolean
  callToBook: boolean
  reason: string | null
  price: string | null
  slotType: string | null
  experience: string | null
  observedAt: string
  expired: boolean
  full: boolean
}

export interface SnozoneDaySummary {
  total: number
  available: number
  capacity: number
  peakOnSlope: number | null
}

export interface SnozoneDayResponse {
  date: string
  observedAt: string | null
  isStale: boolean
  slots: SnozoneSlot[]
  summary: SnozoneDaySummary
}

export interface SnozoneHistoryPoint {
  slotTime: string
  observedAt: string
  onSlope: number
  starting: number
}

export interface SnozoneDayHistoryResponse {
  date: string
  points: SnozoneHistoryPoint[]
}

export interface SnozoneRecommendParams {
  after: string
  session: number
  early: number
  stay: number
}

/**
 * A ranked slot from the recommendation service. `presenceFrom`/`presenceTo`
 * are the presence window (`start-early` to `start+session+stay`, roughly);
 * `avgOnSlope`/`peakOnSlope` are computed over that window, not just the
 * booked hour.
 */
export interface SnozonePick {
  time: string
  label: string
  presenceFrom: string
  presenceTo: string
  avgOnSlope: number
  peakOnSlope: number
  capacity: number
  coverage: number
}

export type SnozoneConfidence = 'good' | 'thin' | 'none'

export interface SnozoneRecommendResponse {
  date: string
  params: SnozoneRecommendParams
  pick: SnozonePick | null
  ranked: SnozonePick[]
  confidence: SnozoneConfidence
  note: string | null
}

/**
 * Patterns analytics (work item G).
 *
 * Mirrors `services/snozoneAnalyticsService.ts`. Every analytic carries its own
 * `maturity`, because most of these charts are not worth drawing yet and a
 * chart built from two days of data is worse than no chart — it invites
 * conclusions the data cannot support (frontend plan §5).
 */

export interface SnozoneMaturity {
  needs: number
  have: number
  unit: string
  ready: boolean
}

export interface SnozoneAnalyticsRange {
  from: string
  to: string
}

/** A past date that has been rolled up into finals. */
export interface SnozoneCollectedDate {
  sessionDate: string
  /** 0 = Sunday, matching JavaScript's getDay(). */
  dow: number
  /** Slots the timetable offered — never assume 121 (frontend plan §5.1). */
  slots: number
  peakOnSlope: number
  totalStarting: number
  firstSeenAt: string | null
  /** Occupancy already booked before the date entered our horizon. */
  firstSeenOnSlope: number
}

export interface SnozoneCollectedDatesResponse {
  dates: SnozoneCollectedDate[]
}

export interface SnozoneBusynessCell {
  dow: number
  slotTime: string
  samples: number
  medianOnSlope: number
  medianFill: number
}

export interface SnozoneBusynessResponse {
  range: SnozoneAnalyticsRange
  cells: SnozoneBusynessCell[]
  /**
   * How many dates each weekday has. Load-bearing for rendering: a cell with
   * no entry in `cells` means CLOSED if its weekday has dates, and "not
   * collected yet" if it has none. Drawing both as one blank cell invites
   * opposite conclusions (frontend plan §5.1).
   */
  datesPerDow: { dow: number; dates: number }[]
  maturity: SnozoneMaturity
}

export interface SnozoneBookingTimeCell {
  dow: number
  hour: number
  bookings: number
  events: number
}

export interface SnozoneBookingTimesResponse {
  range: SnozoneAnalyticsRange
  cells: SnozoneBookingTimeCell[]
  totalBookings: number
  /** Events dropped for a bracket too wide to place in an hour. */
  excludedWideBracket: number
  days: number
  maturity: SnozoneMaturity
}

export interface SnozoneLeadTimeBucket {
  fromMinutes: number
  toMinutes: number | null
  label: string
  bookings: number
  events: number
}

export interface SnozoneLeadTimesResponse {
  range: SnozoneAnalyticsRange
  buckets: SnozoneLeadTimeBucket[]
  totalBookings: number
  /** The ceiling this distribution is structurally truncated at. */
  observableLeadDays: number
  maturity: SnozoneMaturity
}

export interface SnozoneTrendWeek {
  weekStart: string
  dates: number
  openSlots: number
  totalStarting: number
  /** Bookings per open slot — the only comparable figure across weeks. */
  startingPerOpenSlot: number
  peakOnSlope: number
  meanFill: number
}

export interface SnozoneTrendResponse {
  range: SnozoneAnalyticsRange
  weeks: SnozoneTrendWeek[]
  slotTypes: { slotType: string; slots: number; meanOnSlope: number }[]
  maturity: SnozoneMaturity
}

export interface SnozoneFillCurvePoint {
  /** Hours before the slot started. Counts DOWN toward 0 as the slot nears. */
  hoursBefore: number
  observedAt: string
  onSlope: number
  starting: number
}

export interface SnozoneFillCurveSeries {
  sessionDate: string
  /** The date asked for, versus a same-weekday date ghosted behind it. */
  isTarget: boolean
  totalQty: number
  /**
   * How early this slot was first observed. The curve starts here and is never
   * drawn back to zero — a curve opening at 60 means that is when we first
   * looked, not that 60 people arrived at once.
   */
  firstSeenHoursBefore: number
  firstSeenOnSlope: number
  points: SnozoneFillCurvePoint[]
}

export interface SnozoneFillCurveResponse {
  date: string
  slotTime: string
  series: SnozoneFillCurveSeries[]
  maturity: SnozoneMaturity
}
