/**
 * Meal Plan Collection Hooks
 * Type-safe hooks for meal plan CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/client';
import { toast } from '@/lib/toast';
import type {
  MealPlan,
  CreateMealPlanInput,
  UpdateMealPlanInput,
  CreateMealPlanEntryInput,
  UpdateMealPlanEntryInput,
  CopyMealPlanInput,
  MealPlanToShoppingListInput,
} from '@/types/mealPlan';

/**
 * Invalidate all meal-plan related queries
 */
function invalidateMealPlans(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) && query.queryKey[0] === 'meal-plans',
  });
}

/**
 * Hook for fetching the meal plan for a specific week
 *
 * @param weekStartDate - The Monday of the week in YYYY-MM-DD format
 * @returns The meal plan with entries, loading/error states, and refetch
 *
 * @example
 * const { data, isLoading, error } = useMealPlan('2026-02-09');
 */
export function useMealPlan(weekStartDate: string) {
  const query = useQuery({
    queryKey: ['meal-plans', 'week', weekStartDate],
    queryFn: async () => {
      const response = await apiGet<{ data: MealPlan | null }>('/api/meal-plans', { week: weekStartDate });
      return response.data;
    },
    enabled: !!weekStartDate,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook for meal plan mutation operations
 *
 * Provides functions for creating, updating, and deleting meal plans and entries,
 * as well as copying weeks and exporting to shopping lists.
 *
 * @returns Mutation functions and combined loading state
 *
 * @example
 * const { createPlan, addEntry, toShoppingList, isLoading } = useMealPlanData();
 * await createPlan({ weekStartDate: '2026-02-09', name: 'Week 7' });
 * await addEntry(planId, { dayOfWeek: 0, mealType: 'dinner', recipeId: 42 });
 */
export function useMealPlanData() {
  const queryClient = useQueryClient();

  // Create meal plan
  const createPlanMutation = useMutation({
    mutationFn: async (input: CreateMealPlanInput) => {
      const response = await apiPost<{ data: MealPlan }>('/api/meal-plans', input);
      return response.data;
    },
    onSuccess: () => {
      invalidateMealPlans(queryClient);
      toast.success('Meal plan created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create meal plan');
    },
  });

  // Update meal plan
  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UpdateMealPlanInput }) => {
      return apiPatch<MealPlan>(`/api/meal-plans/${id}`, input);
    },
    onSuccess: () => {
      invalidateMealPlans(queryClient);
      toast.success('Meal plan updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update meal plan');
    },
  });

  // Delete meal plan
  const deletePlanMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiDelete<void>(`/api/meal-plans/${id}`);
    },
    onSuccess: () => {
      invalidateMealPlans(queryClient);
      toast.success('Meal plan deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete meal plan');
    },
  });

  // Add entry to meal plan
  const addEntryMutation = useMutation({
    mutationFn: async ({
      planId,
      input,
    }: {
      planId: number;
      input: CreateMealPlanEntryInput;
    }) => {
      return apiPost<MealPlan>(`/api/meal-plans/${planId}/entries`, input);
    },
    onSuccess: () => {
      invalidateMealPlans(queryClient);
      toast.success('Meal added');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add meal');
    },
  });

  // Update entry
  const updateEntryMutation = useMutation({
    mutationFn: async ({
      planId,
      entryId,
      input,
    }: {
      planId: number;
      entryId: number;
      input: UpdateMealPlanEntryInput;
    }) => {
      return apiPatch<MealPlan>(
        `/api/meal-plans/${planId}/entries/${entryId}`,
        input
      );
    },
    onSuccess: () => {
      invalidateMealPlans(queryClient);
      toast.success('Meal updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update meal');
    },
  });

  // Delete entry
  const deleteEntryMutation = useMutation({
    mutationFn: async ({
      planId,
      entryId,
    }: {
      planId: number;
      entryId: number;
    }) => {
      return apiDelete<void>(
        `/api/meal-plans/${planId}/entries/${entryId}`
      );
    },
    onSuccess: () => {
      invalidateMealPlans(queryClient);
      toast.success('Meal removed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove meal');
    },
  });

  // Export to shopping list
  const toShoppingListMutation = useMutation({
    mutationFn: async ({
      planId,
      input,
    }: {
      planId: number;
      input: MealPlanToShoppingListInput;
    }) => {
      const response = await apiPost<{ data: { id: number; addedCount: number; mergedCount: number } }>(
        `/api/meal-plans/${planId}/to-shopping-list`,
        input
      );
      return response.data;
    },
    onSuccess: () => {
      invalidateMealPlans(queryClient);
      toast.success('Shopping list created from meal plan');
      // Also invalidate shopping lists cache
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey[0] === 'shopping-lists',
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create shopping list');
    },
  });

  // Copy week
  const copyWeekMutation = useMutation({
    mutationFn: async (input: CopyMealPlanInput) => {
      const response = await apiPost<{ data: MealPlan }>('/api/meal-plans/copy', input);
      return response.data;
    },
    onSuccess: () => {
      invalidateMealPlans(queryClient);
      toast.success('Meal plan copied');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to copy meal plan');
    },
  });

  return {
    createPlan: (input: CreateMealPlanInput) =>
      createPlanMutation.mutateAsync(input),
    updatePlan: (id: number, input: UpdateMealPlanInput) =>
      updatePlanMutation.mutateAsync({ id, input }),
    deletePlan: (id: number) =>
      deletePlanMutation.mutateAsync(id),
    addEntry: (planId: number, input: CreateMealPlanEntryInput) =>
      addEntryMutation.mutateAsync({ planId, input }),
    updateEntry: (planId: number, entryId: number, input: UpdateMealPlanEntryInput) =>
      updateEntryMutation.mutateAsync({ planId, entryId, input }),
    deleteEntry: (planId: number, entryId: number) =>
      deleteEntryMutation.mutateAsync({ planId, entryId }),
    toShoppingList: (planId: number, input: MealPlanToShoppingListInput) =>
      toShoppingListMutation.mutateAsync({ planId, input }),
    copyWeek: (input: CopyMealPlanInput) =>
      copyWeekMutation.mutateAsync(input),
    isLoading:
      createPlanMutation.isPending ||
      updatePlanMutation.isPending ||
      deletePlanMutation.isPending ||
      addEntryMutation.isPending ||
      updateEntryMutation.isPending ||
      deleteEntryMutation.isPending ||
      toShoppingListMutation.isPending ||
      copyWeekMutation.isPending,
  };
}
