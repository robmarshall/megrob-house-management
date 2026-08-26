import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api/client'
import type { SnozoneRecommendResponse } from '@/types/snozone'

/**
 * The tunables the recommendation is ranked against — phase 0's defaults
 * (after 16:00, a 60 minute session, arriving 15 minutes early, staying 10
 * minutes after). All optional: the backend fills in the same defaults when
 * a param is omitted.
 */
export interface SnozoneRecommendTunables {
  after?: string
  session?: number
  early?: number
  stay?: number
}

/**
 * The server-computed pick for a date: quietest slot ranked across the
 * presence window, not just the booked hour. `date` is required — the query
 * is disabled without one.
 */
export function useSnozoneRecommend(
  date: string | null,
  tunables: SnozoneRecommendTunables = {}
) {
  const { after, session, early, stay } = tunables

  return useQuery<SnozoneRecommendResponse>({
    queryKey: ['snozone-recommend', date, after, session, early, stay],
    queryFn: () =>
      apiGet<SnozoneRecommendResponse>('/api/snozone/recommend', {
        date: date ?? undefined,
        after,
        session,
        early,
        stay,
      }),
    enabled: Boolean(date),
    staleTime: 5 * 60 * 1000,
  })
}
