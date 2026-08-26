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
