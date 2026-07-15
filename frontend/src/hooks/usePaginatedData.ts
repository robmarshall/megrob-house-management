/**
 * usePaginatedData - Base hook for fetching paginated lists
 *
 * Usage:
 * const { data, total, page, pageSize, isLoading, nextPage, prevPage } =
 *   usePaginatedData<MyType>("my-collection", { page: 1, pageSize: 20 });
 *
 * Supports two pagination modes:
 * - Controlled: the consumer passes `options.page` (e.g. derived from the URL).
 *   The hook follows `options.page` on every render/change.
 * - Uncontrolled: the consumer omits `options.page` and drives pagination via
 *   the returned `nextPage`/`prevPage`/`goToPage` helpers.
 *
 * Any extra option keys beyond `page`/`pageSize` (filter params such as
 * `search`, `dietary`, etc.) are forwarded to the API and included in the
 * query key so filters reach the backend and cache correctly. Keys with an
 * `undefined` value are omitted.
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiGet } from '@/lib/api/client';
import { listKey } from '@/lib/api/queryKeys';
import type { PaginatedResponse, PaginationOptions, QueryParams } from '@/types/api';

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
 * @param options - Pagination options (page, pageSize) plus optional filter
 *   params. Consumers such as useRecipes spread extra filter keys into this
 *   object; they are forwarded to the API and included in the query key.
 * @returns Paginated data with navigation helpers
 */
export function usePaginatedData<T>(
  collection: string,
  options: PaginationOptions = {}
): UsePaginatedDataReturn<T> {
  // Separate pagination controls from filter params. The public option type is
  // PaginationOptions, but callers may spread additional filter keys (which are
  // exempt from excess-property checks), so read them via the QueryParams shape.
  const { page: pageOption, pageSize: pageSizeOption, ...filters } =
    options as QueryParams;

  // Internal page state for uncontrolled consumers (those that do NOT pass
  // options.page and instead use nextPage/prevPage/goToPage).
  const [internalPage, setInternalPage] = useState(pageOption ?? 1);

  // When the consumer controls the page via options.page, follow it; otherwise
  // fall back to the internal navigation state. pageSize always follows options.
  const page = pageOption ?? internalPage;
  const pageSize = pageSizeOption ?? 20;

  // Build query parameters: pagination + any defined filter values.
  const queryParams: QueryParams = { page, pageSize };
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      queryParams[key] = value;
    }
  }

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

  // Navigation helpers (drive the internal state for uncontrolled consumers)
  const nextPage = () => {
    if (page < totalPages) {
      setInternalPage(page + 1);
    }
  };

  const prevPage = () => {
    if (page > 1) {
      setInternalPage(page - 1);
    }
  };

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setInternalPage(newPage);
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
