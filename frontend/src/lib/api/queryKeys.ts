/**
 * Query key factory for TanStack Query
 * Provides consistent cache keys across the application
 */

import type { Query } from '@tanstack/react-query';

/**
 * Generate query keys for list/paginated data
 */
export function listKey(collection: string, params?: object): unknown[] {
  return params ? [collection, 'list', params] : [collection, 'list'];
}

/**
 * Generate query keys for single item detail
 */
export function detailKey(
  collection: string,
  id: string | number
): unknown[] {
  return [collection, 'detail', id];
}

/**
 * Generate base key for a collection (useful for invalidating all related queries)
 */
export function collectionKey(collection: string): unknown[] {
  return [collection];
}

/**
 * Predicate for queryClient.invalidateQueries that matches every query for a
 * collection, including nested sub-collections. Nested resources embed the
 * parent path in the first key segment (e.g. 'shopping-lists/5/items'), so a
 * strict `key[0] === collection` check misses them and leaves their cached
 * data stale after a mutation.
 */
export function collectionPredicate(collection: string): (query: Query) => boolean {
  return (query) => {
    const key = query.queryKey;
    return (
      Array.isArray(key) &&
      typeof key[0] === 'string' &&
      (key[0] === collection || key[0].startsWith(`${collection}/`))
    );
  };
}
