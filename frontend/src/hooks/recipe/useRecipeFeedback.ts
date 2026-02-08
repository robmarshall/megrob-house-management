/**
 * Recipe Feedback Hooks
 * Hooks for fetching and managing recipe feedback (likes/dislikes with notes)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api/client';
import { toast } from '@/lib/toast';
import type { RecipeFeedbackSummary, RecipeFeedback, AddFeedbackInput } from '@/types/recipe';

/**
 * Hook for fetching recipe feedback summary and entries
 *
 * @param recipeId - The recipe ID to fetch feedback for
 * @returns Feedback summary with likes, dislikes, and entries
 *
 * @example
 * const { data, isLoading, error } = useRecipeFeedback(123);
 * console.log(data?.likes, data?.dislikes, data?.entries);
 */
export function useRecipeFeedback(recipeId: number) {
  return useQuery({
    queryKey: ['recipes', recipeId, 'feedback'],
    queryFn: async () => {
      return apiGet<RecipeFeedbackSummary>(`/api/recipes/${recipeId}/feedback`);
    },
    enabled: !!recipeId,
  });
}

/**
 * Hook for feedback mutations (add and delete)
 *
 * @param recipeId - The recipe ID to manage feedback for
 * @returns Mutation functions for adding and deleting feedback
 *
 * @example
 * const { addFeedback, deleteFeedback, isLoading } = useRecipeFeedbackMutations(123);
 * await addFeedback({ isLike: true, note: 'Great recipe!' });
 * await deleteFeedback(456);
 */
export function useRecipeFeedbackMutations(recipeId: number) {
  const queryClient = useQueryClient();

  const invalidateFeedback = () => {
    queryClient.invalidateQueries({
      queryKey: ['recipes', recipeId, 'feedback'],
    });
  };

  // Add feedback mutation
  const addMutation = useMutation({
    mutationFn: async (input: AddFeedbackInput) => {
      return apiPost<RecipeFeedback>(`/api/recipes/${recipeId}/feedback`, input);
    },
    onSuccess: () => {
      invalidateFeedback();
      toast.success('Feedback submitted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit feedback');
    },
  });

  // Delete feedback mutation
  const deleteMutation = useMutation({
    mutationFn: async (feedbackId: number) => {
      return apiDelete<void>(`/api/recipes/${recipeId}/feedback/${feedbackId}`);
    },
    onSuccess: () => {
      invalidateFeedback();
      toast.success('Feedback deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete feedback');
    },
  });

  return {
    addFeedback: (input: AddFeedbackInput) => addMutation.mutateAsync(input),
    deleteFeedback: (feedbackId: number) => deleteMutation.mutateAsync(feedbackId),
    isLoading: addMutation.isPending || deleteMutation.isPending,
    isAdding: addMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
