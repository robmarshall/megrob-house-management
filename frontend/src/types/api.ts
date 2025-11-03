/**
 * Core API types for data fetching and mutations
 */

/**
 * Standard paginated response structure from the API
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * API error structure
 */
export interface ApiError {
  message: string;
  status: number;
  details?: unknown;
}

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

/**
 * Query parameters that can be sent to the API
 */
export interface QueryParams {
  page?: number;
  pageSize?: number;
  [key: string]: string | number | boolean | undefined;
}
