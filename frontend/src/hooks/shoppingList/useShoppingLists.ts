/**
 * Shopping Lists Collection Hooks
 * Type-safe wrappers around base data hooks for shopping lists
 */

import { useData } from '../useData';
import { usePaginatedData } from '../usePaginatedData';
import type { PaginationOptions } from '@/types/api';
import type { ShoppingList } from '@/types/shoppingList';

/**
 * Hook for fetching paginated shopping lists
 *
 * @param options - Pagination options
 * @returns Paginated shopping lists with navigation
 *
 * @example
 * const { data, isLoading, nextPage } = useShoppingLists({ page: 1, pageSize: 20 });
 */
export function useShoppingLists(options?: PaginationOptions) {
  return usePaginatedData<ShoppingList>('shopping-lists', options);
}

/**
 * Hook for fetching a single shopping list by ID
 *
 * @param id - The shopping list ID
 * @returns Single shopping list with loading/error states
 *
 * @example
 * const { data: list, isLoading, error } = useShoppingList(123);
 */
export function useShoppingList(id: string | number) {
  return useData<ShoppingList>('shopping-lists', id);
}

/**
 * Hook for shopping list CRUD operations
 *
 * @returns Mutation functions for create, edit, delete
 *
 * @example
 * const { create, edit, delete: deleteList } = useShoppingListData();
 * await create({ name: 'Groceries', description: 'Weekly shopping' });
 * await edit(1, { name: 'Updated Name' });
 * await deleteList(1);
 */
export function useShoppingListData() {
  return useData<ShoppingList>('shopping-lists');
}
