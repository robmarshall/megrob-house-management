/**
 * Recipes Collection Hooks
 * Type-safe wrappers around base data hooks for recipes
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useData } from '../useData';
import { usePaginatedData } from '../usePaginatedData';
import { apiGet, apiPost } from '@/lib/api/client';
import { toast } from '@/lib/toast';
import type { PaginationOptions } from '@/types/api';
import type { Recipe, ImportRecipeInput, RecipeStatus } from '@/types/recipe';

/**
 * Extended pagination options for recipes
 */
export interface RecipePaginationOptions extends PaginationOptions {
  search?: string;
  favorite?: boolean;
  status?: 'pending' | 'ready' | 'failed' | 'all';
  mealType?: string[];
  dietary?: string[];
  allergenFree?: string[];
  cuisine?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

/**
 * Hook for fetching paginated recipes
 *
 * @param options - Pagination and filter options
 * @returns Paginated recipes with navigation
 *
 * @example
 * const { data, isLoading, nextPage } = useRecipes({ page: 1, pageSize: 20 });
 * const { data } = useRecipes({ search: 'pasta', favorite: true });
 * const { data } = useRecipes({ dietary: ['vegetarian'], allergenFree: ['nuts'] });
 */
export function useRecipes(options?: RecipePaginationOptions) {
  // Build query string from options
  const queryParams: Record<string, string> = {};
  if (options?.search) queryParams.search = options.search;
  if (options?.favorite) queryParams.favorite = 'true';
  if (options?.status) queryParams.status = options.status;
  if (options?.mealType?.length) queryParams.mealType = options.mealType.join(',');
  if (options?.dietary?.length) queryParams.dietary = options.dietary.join(',');
  if (options?.allergenFree?.length) queryParams.allergenFree = options.allergenFree.join(',');
  if (options?.cuisine) queryParams.cuisine = options.cuisine;
  if (options?.difficulty) queryParams.difficulty = options.difficulty;

  return usePaginatedData<Recipe>('recipes', {
    page: options?.page,
    pageSize: options?.pageSize,
    ...queryParams,
  });
}

/**
 * Hook for fetching a single recipe by ID (includes ingredients and categories)
 *
 * @param id - The recipe ID
 * @returns Single recipe with loading/error states
 *
 * @example
 * const { data: recipe, isLoading, error } = useRecipe(123);
 */
export function useRecipe(id: string | number) {
  return useData<Recipe>('recipes', id);
}

/**
 * Response type for recipe status polling
 */
interface RecipeStatusResponse {
  id: number;
  status: RecipeStatus;
  errorMessage: string | null;
  name: string | null;
}

/**
 * Poll for recipe status until it's ready or failed
 * @param recipeId - The ID of the recipe to poll
 * @param intervalMs - Polling interval in milliseconds (default 2000)
 * @param maxAttempts - Maximum polling attempts (default 60 = 2 minutes)
 * @returns Promise that resolves when recipe is ready or rejects on failure/timeout
 */
async function pollRecipeStatus(
  recipeId: number,
  intervalMs = 2000,
  maxAttempts = 60
): Promise<RecipeStatusResponse> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await apiGet<RecipeStatusResponse>(`/api/recipes/${recipeId}/status`);

    if (status.status === 'ready') {
      return status;
    }

    if (status.status === 'failed') {
      throw new Error(status.errorMessage || 'Failed to import recipe');
    }

    // Still pending, wait and try again
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attempts++;
  }

  throw new Error('Import timed out. Please check the recipe later.');
}

/**
 * Hook for recipe CRUD operations
 *
 * @returns Mutation functions for create, edit, delete
 *
 * @example
 * const { create, edit, delete: deleteRecipe } = useRecipeData();
 * await create({ name: 'Pasta', instructions: '["Cook pasta", "Add sauce"]' });
 * await edit(1, { name: 'Updated Recipe' });
 * await deleteRecipe(1);
 */
export function useRecipeData() {
  const baseData = useData<Recipe>('recipes');
  const queryClient = useQueryClient();

  // Import mutation for URL scraping (async with polling)
  const importMutation = useMutation({
    mutationFn: async (input: ImportRecipeInput) => {
      // Create pending recipe and queue import
      const pendingRecipe = await apiPost<Recipe>('/api/recipes/import', input);

      // Poll for completion
      await pollRecipeStatus(pendingRecipe.id);

      // Fetch the complete recipe
      const completeRecipe = await apiGet<Recipe>(`/api/recipes/${pendingRecipe.id}`);
      return completeRecipe;
    },
    onSuccess: () => {
      toast.success('Recipe imported successfully');
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === 'recipes';
        },
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to import recipe');
    },
  });

  // Add to shopping list mutation
  const addToShoppingListMutation = useMutation({
    mutationFn: async (params: {
      recipeId: number;
      shoppingListId?: number;
      newListName?: string;
      ingredientIds: number[];
      servingMultiplier?: number;
    }) => {
      return apiPost<{ addedCount: number; id: number }>(
        `/api/recipes/${params.recipeId}/to-shopping-list`,
        {
          shoppingListId: params.shoppingListId,
          newListName: params.newListName,
          ingredientIds: params.ingredientIds,
          servingMultiplier: params.servingMultiplier,
        }
      );
    },
    onSuccess: () => {
      toast.success('Ingredients added to shopping list');
      // Invalidate shopping lists cache
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === 'shopping-lists';
        },
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add ingredients to shopping list');
    },
  });

  // Toggle favorite mutation (uses dedicated POST endpoint instead of PATCH)
  const toggleFavoriteMutation = useMutation({
    mutationFn: async (recipeId: number) => {
      return apiPost<Recipe>(`/api/recipes/${recipeId}/favorite`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === 'recipes';
        },
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update favorite');
    },
  });

  return {
    ...baseData,
    importFromUrl: (url: string) => importMutation.mutateAsync({ url }),
    isImporting: importMutation.isPending,
    importError: importMutation.error,
    addToShoppingList: addToShoppingListMutation.mutateAsync,
    isAddingToShoppingList: addToShoppingListMutation.isPending,
    toggleFavorite: (recipeId: number) => toggleFavoriteMutation.mutateAsync(recipeId),
    isTogglingFavorite: toggleFavoriteMutation.isPending,
  };
}
