import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch, apiPost } from '@/lib/api/client'
import { ApiError } from '@/lib/api/ApiError'
import type {
  NotificationSettings,
  UpdateNotificationSettings,
} from '@/types/notifications'

const ENDPOINT = '/api/settings/notifications'
const KEY = ['notification-settings']

/**
 * Admin-only settings. A 403 is an expected outcome for a non-admin rather
 * than an error worth retrying or surfacing, so it is caught here and the
 * consuming section simply renders nothing.
 */
export function useNotificationSettings() {
  return useQuery<NotificationSettings | null>({
    queryKey: KEY,
    queryFn: async () => {
      try {
        return await apiGet<NotificationSettings>(ENDPOINT)
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) return null
        throw err
      }
    },
    retry: (count, err) =>
      err instanceof ApiError && err.status === 403 ? false : count < 2,
    staleTime: 30_000,
  })
}

export function useSaveNotificationSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateNotificationSettings) =>
      apiPatch<NotificationSettings>(ENDPOINT, input),
    onSuccess: (data) => {
      // The response is the fresh masked view, so seed the cache with it
      // rather than refetching.
      queryClient.setQueryData(KEY, data)
    },
  })
}

export function useSendTestNotification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => apiPost<{ ok: true }>(`${ENDPOINT}/test`, {}),
    onSettled: () => {
      // Success or failure both update lastVerifiedAt / lastError server-side.
      void queryClient.invalidateQueries({ queryKey: KEY })
    },
  })
}
