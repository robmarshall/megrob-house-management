/**
 * Public Recipe Hook
 * Fetches a publicly shared recipe by its share id (no authentication needed).
 */

import { useData } from '../useData';
import type { PublicRecipe } from '@/types/recipe';

/**
 * Hook for fetching a publicly shared recipe by publicId (UUID)
 *
 * @param publicId - The recipe's public share id
 * @returns The sanitized public recipe with loading/error states
 *
 * @example
 * const { data: recipe, isLoading, error } = usePublicRecipe(publicId);
 */
export function usePublicRecipe(publicId: string) {
  return useData<PublicRecipe>('public/recipes', publicId);
}
