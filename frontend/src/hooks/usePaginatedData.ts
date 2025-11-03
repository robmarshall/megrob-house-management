/**
 * usePaginatedData - Base hook for fetching paginated lists
 *
 * Usage:
 * const { data, total, page, pageSize, isLoading, nextPage, prevPage } =
 *   usePaginatedData<MyType>("my-collection", { page: 1, pageSize: 20 });
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiGet } from '@/lib/api/client';
import { listKey } from '@/lib/api/queryKeys';
import type { PaginatedResponse, PaginationOptions } from '@/types/api';

interface UsePaginatedDataReturn<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isLoading: boolean;
  error: Error | null;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  refetch: () => void;
}

/**
 * Hook for fetching paginated data from a collection
 *
 * @param collection - The API collection name (e.g., "shopping-lists")
 * @param options - Pagination options (page, pageSize)
 * @returns Paginated data with navigation helpers
 */
export function usePaginatedData<T>(
  collection: string,
  options: PaginationOptions = {}
): UsePaginatedDataReturn<T> {
  const { page: initialPage = 1, pageSize: initialPageSize = 20 } = options;

  // Local pagination state
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(initialPageSize);

  // Build query parameters
  const queryParams = { page, pageSize };

  // Fetch data with TanStack Query
  const query = useQuery<PaginatedResponse<T>>({
    queryKey: listKey(collection, queryParams),
    queryFn: () => apiGet<PaginatedResponse<T>>(`/api/${collection}`, queryParams),
  });

  const { data: response, isLoading, error, refetch } = query;

  // Extract data from response or use defaults
  const data = response?.data ?? [];
  const total = response?.total ?? 0;
  const totalPages = response?.totalPages ?? 1;

  // Navigation helpers
  const nextPage = () => {
    if (page < totalPages) {
      setPage((prev) => prev + 1);
    }
  };

  const prevPage = () => {
    if (page > 1) {
      setPage((prev) => prev - 1);
    }
  };

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
    isLoading,
    error: error as Error | null,
    nextPage,
    prevPage,
    goToPage,
    refetch,
  };
}
