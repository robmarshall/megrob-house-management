import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api/client'
import type { SnozoneDayHistoryResponse } from '@/types/snozone'

/**
 * Every observation for a date — the raw material for the Patterns page's
 * fill-curve chart (work item G). Not used by the Book page, which only
 * needs the latest-per-slot view from `useSnozoneDay`.
 */
export function useSnozoneDayHistory(date: string | null) {
  return useQuery<SnozoneDayHistoryResponse>({
    queryKey: ['snozone-day-history', date],
    queryFn: () =>
      apiGet<SnozoneDayHistoryResponse>(`/api/snozone/days/${date}/history`),
    enabled: Boolean(date),
    staleTime: 5 * 60 * 1000,
  })
}
