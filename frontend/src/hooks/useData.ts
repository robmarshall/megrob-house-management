/**
 * useData - Base hook for single-item CRUD operations
 *
 * Usage:
 * const { create, edit, delete: deleteItem, isLoading } = useData<MyType>("my-collection");
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/client";
import { toast } from "@/lib/toast";

/**
 * Derives a human-readable label for toast messages from an API collection
 * path, using the last meaningful path segment (the actual entity) rather
 * than the first, so nested collections (e.g. "shopping-lists/5/items")
 * resolve to the entity being acted on ("items") instead of the parent
 * ("shopping lists").
 *
 * @param collection - The API collection path (e.g. "shopping-lists/5/items")
 * @returns A space-separated, human-readable label (e.g. "items")
 */
export function collectionLabel(collection: string): string {
  const segments = collection
    .split('/')
    .filter((segment) => segment.length > 0 && !/^\d+$/.test(segment));

  const lastSegment = segments[segments.length - 1];

  if (!lastSegment) {
    return collection.replace(/-/g, ' ');
  }

  return lastSegment.replace(/-/g, ' ');
}

interface UseDataReturn<T> {
  create: (data: Partial<T>) => Promise<T>;
  edit: (
    id: string | number,
    data: Partial<T>,
    options?: { silent?: boolean }
  ) => Promise<T>;
  delete: (id: string | number) => Promise<void>;
  isLoading: boolean;
}

interface UseDataWithGetReturn<T> extends UseDataReturn<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook for managing single-item CRUD operations and optionally fetching a single item
 *
 * @param collection - The API collection name (e.g., "shopping-lists")
 * @param id - Optional ID for fetching a single item
 * @returns Object with create, edit, delete mutation functions, and query data if id provided
 */
export function useData<T>(collection: string): UseDataReturn<T>;
export function useData<T>(
  collection: string,
  id: string | number
): UseDataWithGetReturn<T>;
export function useData<T>(
  collection: string,
  id?: string | number
): UseDataReturn<T> | UseDataWithGetReturn<T> {
  const queryClient = useQueryClient();

  // Get single item query (only if id is provided)
  const query = useQuery({
    queryKey: [collection, "detail", id],
    queryFn: async () => {
      return apiGet<T>(`/api/${collection}/${id}`);
    },
    enabled: id !== undefined,
  });

  // Human-readable collection name for toast messages
  const label = collectionLabel(collection);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<T>) => {
      return apiPost<T>(`/api/${collection}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === collection;
        },
      });
      toast.success(`${label} created`);
    },
    onError: (error: Error) => {
      toast.error(error.message || `Failed to create ${label}`);
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
      silent?: boolean;
    }) => {
      return apiPatch<T>(`/api/${collection}/${id}`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === collection;
        },
      });
      if (!variables.silent) {
        toast.success(`${label} updated`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || `Failed to update ${label}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string | number) => {
      return apiDelete<void>(`/api/${collection}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === collection;
        },
      });
      toast.success(`${label} deleted`);
    },
    onError: (error: Error) => {
      toast.error(error.message || `Failed to delete ${label}`);
    },
  });

  // Base return object with mutation functions
  const baseReturn = {
    create: (data: Partial<T>) => createMutation.mutateAsync(data),
    edit: (
      id: string | number,
      data: Partial<T>,
      options?: { silent?: boolean }
    ) => editMutation.mutateAsync({ id, data, silent: options?.silent }),
    delete: (id: string | number) => deleteMutation.mutateAsync(id),
    isLoading:
      createMutation.isPending ||
      editMutation.isPending ||
      deleteMutation.isPending,
  };

  // If id is provided, include query data
  if (id !== undefined) {
    return {
      ...baseReturn,
      data: query.data,
      isLoading: query.isLoading,
      error: query.error,
      refetch: query.refetch,
    };
  }

  return baseReturn;
}
