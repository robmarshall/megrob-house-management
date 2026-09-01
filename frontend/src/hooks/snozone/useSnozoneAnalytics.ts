import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api/client'
import type {
  SnozoneBookingTimesResponse,
  SnozoneBusynessResponse,
  SnozoneCollectedDatesResponse,
  SnozoneFillCurveResponse,
  SnozoneLeadTimesResponse,
  SnozoneTrendResponse,
} from '@/types/snozone'

/**
 * The Patterns analytics (frontend plan §3.2, work item G).
 *
 * `staleTime` is an hour rather than the availability views' five minutes: the
 * underlying rollup is recomputed nightly and the booking-event view moves only
 * as fast as the 30-minute poll, so refetching more often would cost requests
 * and change nothing. The server sets a matching Cache-Control.
 */
const ANALYTICS_STALE_TIME = 60 * 60 * 1000

interface RangeParams {
  from?: string
  to?: string
}

function rangeQuery({ from, to }: RangeParams): string {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Past dates that have been rolled up.
 *
 * The Patterns page needs this to know which prior same-weekday dates exist to
 * ghost behind a fill curve. `useSnozoneDates` is no help — it lists *bookable*
 * dates, which are all in the future.
 */
export function useSnozoneCollectedDates() {
  return useQuery<SnozoneCollectedDatesResponse>({
    queryKey: ['snozone-collected-dates'],
    queryFn: () => apiGet<SnozoneCollectedDatesResponse>('/api/snozone/analytics/collected-dates'),
    staleTime: ANALYTICS_STALE_TIME,
  })
}

export function useSnozoneBusyness(range: RangeParams = {}) {
  return useQuery<SnozoneBusynessResponse>({
    queryKey: ['snozone-busyness', range.from ?? null, range.to ?? null],
    queryFn: () =>
      apiGet<SnozoneBusynessResponse>(`/api/snozone/analytics/busyness${rangeQuery(range)}`),
    staleTime: ANALYTICS_STALE_TIME,
  })
}

export function useSnozoneBookingTimes(range: RangeParams = {}) {
  return useQuery<SnozoneBookingTimesResponse>({
    queryKey: ['snozone-booking-times', range.from ?? null, range.to ?? null],
    queryFn: () =>
      apiGet<SnozoneBookingTimesResponse>(
        `/api/snozone/analytics/booking-times${rangeQuery(range)}`
      ),
    staleTime: ANALYTICS_STALE_TIME,
  })
}

export function useSnozoneLeadTimes(range: RangeParams = {}) {
  return useQuery<SnozoneLeadTimesResponse>({
    queryKey: ['snozone-lead-times', range.from ?? null, range.to ?? null],
    queryFn: () =>
      apiGet<SnozoneLeadTimesResponse>(`/api/snozone/analytics/lead-times${rangeQuery(range)}`),
    staleTime: ANALYTICS_STALE_TIME,
  })
}

export function useSnozoneTrend(range: RangeParams = {}) {
  return useQuery<SnozoneTrendResponse>({
    queryKey: ['snozone-trend', range.from ?? null, range.to ?? null],
    queryFn: () =>
      apiGet<SnozoneTrendResponse>(`/api/snozone/analytics/trend${rangeQuery(range)}`),
    staleTime: ANALYTICS_STALE_TIME,
  })
}

/**
 * One slot's fill curve, with prior same-weekday dates ghosted behind it.
 *
 * Takes a slot rather than a range: this is a single slot against lead time,
 * which is why opening hours never enter it (frontend plan §5.1).
 */
export function useSnozoneFillCurve(
  date: string | null,
  slotTime: string | null,
  compare = 3
) {
  return useQuery<SnozoneFillCurveResponse>({
    queryKey: ['snozone-fill-curve', date, slotTime, compare],
    queryFn: () =>
      apiGet<SnozoneFillCurveResponse>(
        `/api/snozone/analytics/fill-curve?date=${date}&slot=${slotTime}&compare=${compare}`
      ),
    enabled: Boolean(date && slotTime),
    staleTime: ANALYTICS_STALE_TIME,
  })
}
