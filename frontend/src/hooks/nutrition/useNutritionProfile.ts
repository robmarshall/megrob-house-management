/**
 * Nutrition Profile Hooks
 * Type-safe hooks for the user's own nutrition profile and derived targets.
 *
 * The profile is a per-user singleton (not a paginated collection), so these
 * use useQuery/useMutation directly — same pattern as the meal plan hooks.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api/client'
import type {
  NutritionProfileResult,
  SaveNutritionProfileInput,
  MemberTargets,
} from '@/types/nutrition'

function invalidateNutrition(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) && query.queryKey[0] === 'nutrition',
  })
}

/**
 * Hook for fetching the current user's nutrition profile + computed targets.
 * Returns { profile: null, targets: null } before the first save.
 */
export function useNutritionProfile() {
  const query = useQuery({
    queryKey: ['nutrition', 'profile'],
    queryFn: async () => {
      const response = await apiGet<{ data: NutritionProfileResult }>(
        '/api/nutrition/profile'
      )
      return response.data
    },
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  }
}

/**
 * Hook for saving (upserting) the current user's nutrition profile.
 * The response — saved profile plus freshly computed targets — is written
 * straight into the profile query cache.
 */
export function useSaveNutritionProfile() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (input: SaveNutritionProfileInput) => {
      const response = await apiPost<{ data: NutritionProfileResult }>(
        '/api/nutrition/profile',
        input
      )
      return response.data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['nutrition', 'profile'], data)
      invalidateNutrition(queryClient)
    },
  })

  return {
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
  }
}

/**
 * Hook for fetching derived daily targets for everyone in the household.
 * Never contains raw measurements.
 */
export function useHouseholdNutritionTargets() {
  const query = useQuery({
    queryKey: ['nutrition', 'targets'],
    queryFn: async () => {
      const response = await apiGet<{ data: MemberTargets[] }>(
        '/api/nutrition/targets'
      )
      return response.data
    },
  })

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  }
}
