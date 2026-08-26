import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api/client'
import { ApiError } from '@/lib/api/ApiError'
import type { SnozoneStatus } from '@/types/snozone'

/**
 * Admin-only collector status. A 403 resolves to null rather than erroring, so
 * the Snozone tab simply does not appear for non-admins.
 *
 * Refetches on an interval because the value of this view is spotting that
 * collection has stopped — a stale "all fine" is the exact failure it exists to
 * catch.
 */
export function useSnozoneStatus(enabled = true) {
  return useQuery<SnozoneStatus | null>({
    queryKey: ['snozone-status'],
    enabled,
    queryFn: async () => {
      try {
        return await apiGet<SnozoneStatus>('/api/snozone/health')
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) return null
        throw err
      }
    },
    retry: (count, err) =>
      err instanceof ApiError && err.status === 403 ? false : count < 2,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
