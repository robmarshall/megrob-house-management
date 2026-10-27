import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api/client'
import { ApiError } from '@/lib/api/ApiError'
import type { AdminUser, SetUserPasswordInput } from '@/types/admin'

const ENDPOINT = '/api/admin/users'
const KEY = ['admin-users']

/**
 * Every account, for the admin Users tab. A 403 is the expected outcome for
 * a non-admin rather than an error worth retrying or surfacing, so it is
 * caught here and the consuming section renders nothing.
 */
export function useAdminUsers() {
  return useQuery<AdminUser[] | null>({
    queryKey: KEY,
    queryFn: async () => {
      try {
        return await apiGet<AdminUser[]>(ENDPOINT)
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

/**
 * Set a temporary password for another user. The server also logs that user
 * out everywhere, so the old password stops working immediately.
 */
export function useSetUserPassword() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, newPassword }: SetUserPasswordInput) =>
      apiPost<{ ok: true }>(`${ENDPOINT}/${encodeURIComponent(userId)}/password`, {
        newPassword,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY })
    },
  })
}
