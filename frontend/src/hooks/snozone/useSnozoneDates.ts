import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api/client'
import type { SnozoneDatesResponse } from '@/types/snozone'

/**
 * Bookable dates from the collector's latest successful run.
 *
 * Data changes at most every 30 minutes, so a 5 minute `staleTime` avoids
 * refetching on every tab switch without ever showing meaningfully stale
 * dates.
 */
export function useSnozoneDates() {
  return useQuery<SnozoneDatesResponse>({
    queryKey: ['snozone-dates'],
    queryFn: () => apiGet<SnozoneDatesResponse>('/api/snozone/dates'),
    staleTime: 5 * 60 * 1000,
  })
}
