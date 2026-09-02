/**
 * Optimistic locking (Compare-And-Swap) utilities.
 * Provides consistent version checking patterns across all services.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Check if the current version matches the expected version.
 * Returns true if versions match (proceed with update), false if stale.
 */
export function checkVersion<T extends { version: number }>(
  existing: T,
  expectedVersion: number
): boolean {
  return Number(existing.version) === expectedVersion;
}

/**
 * Increment the version number for an optimistic update.
 */
export function incrementVersion<T extends { version: number }>(
  obj: T
): number {
  return Number(obj.version) + 1;
}

/**
 * Build the version increment update object for Supabase.
 */
export function buildVersionIncrement(
  expectedVersion: number
): Record<string, number> {
  return { version: expectedVersion + 1 };
}

/**
 * Check if an error is a PostgREST "0 rows affected" CAS failure.
 * This happens when a conditional UPDATE finds no matching rows.
 */
export function isCasError(error: { code?: string }): boolean {
  return error.code === "PGRST116";
}

/**
 * Map a CAS error to a conflict result.
 */
export function mapCasError(): { status: "conflict" } {
  return { status: "conflict" };
}

/**
 * Standard conflict result for optimistic locking failures.
 */
export const CONFLICT_RESULT = { status: "conflict" as const };

/**
 * Standard not_found result.
 */
export const NOT_FOUND_RESULT = { status: "not_found" as const };

/**
 * Common Supabase error codes mapped to service results.
 */
export type ServiceErrorCode = "23505" | "42501" | "PGRST116";

/**
 * Map common Supabase error codes to service result statuses.
 */
export function mapSupabaseErrorCode(
  code?: string
): "conflict" | "forbidden" | "unavailable" | undefined {
  switch (code) {
    case "23505": // Unique constraint violation
      return "conflict";
    case "42501": // RLS violation (also appears as "not authorized")
      return "forbidden";
    case "PGRST116": // PostgREST 0 rows (CAS failure)
      return "conflict";
    default:
      return undefined;
  }
}
