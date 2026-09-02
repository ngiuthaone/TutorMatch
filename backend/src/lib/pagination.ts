/**
 * Pagination utilities for Supabase queries.
 * Provides consistent pagination patterns across all services.
 */

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;

/**
 * Apply pagination parameters to a Supabase query.
 * Returns the query with range and limit applied.
 */
export function applyPagination<T>(
  query: any,
  params?: PaginationParams
): any {
  const limit = Math.min(params?.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  let q = query.limit(limit);

  if (params?.offset !== undefined && params.offset > 0) {
    q = q.range(params.offset, params.offset + limit - 1);
  }

  return q;
}

/**
 * Build a pagination result with metadata.
 */
export interface PaginatedResult<T> {
  data: T[];
  total?: number;
  hasMore: boolean;
}

/**
 * Extract pagination metadata from Supabase response.
 */
export function buildPaginatedResult<T>(
  data: T[] | null,
  count?: number | null
): PaginatedResult<T> {
  const items = data ?? [];
  const result: PaginatedResult<T> = {
    data: items,
    hasMore: count != null ? items.length === MAX_PAGE_LIMIT : false,
  };
  if (count != null) {
    result.total = count;
  }
  return result;
}
