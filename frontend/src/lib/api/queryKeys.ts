/**
 * Query key factory for TanStack Query
 * Provides consistent cache keys across the application
 */

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
