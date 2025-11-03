/**
 * useData - Base hook for single-item CRUD operations
 *
 * Usage:
 * const { create, edit, delete: deleteItem, isLoading } = useData<MyType>("my-collection");
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost, apiPatch, apiDelete } from '@/lib/api/client';
import { collectionKey } from '@/lib/api/queryKeys';

interface UseDataReturn<T> {
  create: (data: Partial<T>) => Promise<T>;
  edit: (id: string | number, data: Partial<T>) => Promise<T>;
  delete: (id: string | number) => Promise<void>;
  isLoading: boolean;
}

/**
 * Hook for managing single-item CRUD operations
 *
 * @param collection - The API collection name (e.g., "shopping-lists")
 * @returns Object with create, edit, delete mutation functions
 */
export function useData<T>(collection: string): UseDataReturn<T> {
  const queryClient = useQueryClient();

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<T>) => {
      return apiPost<T>(`/api/${collection}`, data);
    },
    onSuccess: () => {
      // Invalidate all queries for this collection
      queryClient.invalidateQueries({ queryKey: collectionKey(collection) });
    },
  });

  // Edit/Update mutation
  const editMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string | number;
      data: Partial<T>;
    }) => {
      return apiPatch<T>(`/api/${collection}/${id}`, data);
    },
    onSuccess: () => {
      // Invalidate all queries for this collection
      queryClient.invalidateQueries({ queryKey: collectionKey(collection) });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string | number) => {
      return apiDelete<void>(`/api/${collection}/${id}`);
    },
    onSuccess: () => {
      // Invalidate all queries for this collection
      queryClient.invalidateQueries({ queryKey: collectionKey(collection) });
    },
  });

  // Return mutation functions with simplified API
  return {
    create: (data: Partial<T>) => createMutation.mutateAsync(data),
    edit: (id: string | number, data: Partial<T>) =>
      editMutation.mutateAsync({ id, data }),
    delete: (id: string | number) => deleteMutation.mutateAsync(id),
    isLoading:
      createMutation.isPending ||
      editMutation.isPending ||
      deleteMutation.isPending,
  };
}
