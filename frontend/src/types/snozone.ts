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
