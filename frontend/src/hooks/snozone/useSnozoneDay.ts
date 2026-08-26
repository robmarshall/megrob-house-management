import { useQuery, useQueries } from '@tanstack/react-query'
import { apiGet } from '@/lib/api/client'
import type { SnozoneDayResponse } from '@/types/snozone'

const STALE_TIME = 5 * 60 * 1000

function dayQuery(date: string) {
  return {
    queryKey: ['snozone-day', date],
    queryFn: () => apiGet<SnozoneDayResponse>(`/api/snozone/days/${date}`),
    staleTime: STALE_TIME,
  }
}

/**
 * Latest observation per slot for a single date, plus its summary.
 *
 * `date` is a venue-local 'YYYY-MM-DD' string, used verbatim in the URL — not
 * parsed or reformatted.
 */
export function useSnozoneDay(date: string | null) {
  return useQuery<SnozoneDayResponse>({
    ...dayQuery(date ?? ''),
    enabled: Boolean(date),
  })
}

/**
 * The same per-date query as `useSnozoneDay`, fired for several dates at
 * once — used by the date strip to show a one-glance busyness indicator per
 * date. Shares its query key format with `useSnozoneDay`, so a date that is
 * both in the strip and currently selected is only ever fetched once.
 */
export function useSnozoneDays(dates: string[]) {
  return useQueries({
    queries: dates.map((date) => dayQuery(date)),
  })
}
