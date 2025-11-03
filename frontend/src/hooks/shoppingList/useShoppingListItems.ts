/**
 * Shopping List Items Collection Hooks
 * Type-safe wrappers around base data hooks for shopping list items
 */

import { useData } from '../useData';
import { usePaginatedData } from '../usePaginatedData';
import type { PaginationOptions } from '@/types/api';

/**
 * Shopping list item interface
 * TODO: Move to proper types file when backend schema is finalized
 */
export interface ShoppingListItem {
  id: number;
  listId: number;
  name: string;
  category?: string;
  quantity: number;
  unit?: string;
  notes?: string;
  checked: boolean;
  checkedAt?: string;
  checkedBy?: string;
  position: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Hook for fetching paginated items for a specific shopping list
 *
 * @param listId - The shopping list ID
 * @param options - Pagination options
 * @returns Paginated shopping list items with navigation
 *
 * @example
 * const { data, isLoading, nextPage } = useShoppingListItems(1, { page: 1, pageSize: 50 });
 */
export function useShoppingListItems(
  listId: number,
  options?: PaginationOptions
) {
  return usePaginatedData<ShoppingListItem>(
    `shopping-lists/${listId}/items`,
    options
  );
}

/**
 * Hook for shopping list item CRUD operations
 *
 * @param listId - The shopping list ID
 * @returns Mutation functions for create, edit, delete
 *
 * @example
 * const { create, edit, delete: deleteItem } = useShoppingListItemData(1);
 * await create({ name: 'Milk', quantity: 1, unit: 'gallon', category: 'Dairy' });
 * await edit(5, { checked: true });
 * await deleteItem(5);
 */
export function useShoppingListItemData(listId: number) {
  return useData<ShoppingListItem>(`shopping-lists/${listId}/items`);
}
