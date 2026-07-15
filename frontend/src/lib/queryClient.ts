/**
 * TanStack Query Client Configuration
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Determines whether a failed query should be retried.
 *
 * Client errors (4xx) indicate the request itself is invalid (e.g. an
 * expired session returning 401/403, or a missing resource returning 404)
 * and retrying will never succeed, so those are never retried. Everything
 * else (5xx responses, or network failures with no `status` at all, such as
 * a `TypeError` thrown when `fetch` rejects) is transient and is retried up
 * to 3 times.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status = (error as { status?: unknown } | null | undefined)?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return false;
  }
  return failureCount < 3;
}

/**
 * Create and configure the QueryClient with default options
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 5 minutes before being considered stale
      staleTime: 5 * 60 * 1000,
      // Time before inactive queries are garbage collected (10 minutes)
      gcTime: 10 * 60 * 1000,
      // Retry failed requests up to 3 times, but never for 4xx client errors
      retry: shouldRetryQuery,
      // Retry delay increases exponentially
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Don't refetch on window focus in development
      refetchOnWindowFocus: import.meta.env.PROD,
    },
    mutations: {
      // Never auto-retry mutations: there are no idempotency keys, so a
      // retried POST/PATCH/DELETE after a lost response can create
      // duplicate writes (e.g. duplicate lists/recipes or invite emails).
      retry: 0,
    },
  },
});
