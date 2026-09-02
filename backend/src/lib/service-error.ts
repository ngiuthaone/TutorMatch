/**
 * Logs service-level errors for debugging and monitoring.
 * All services return "unavailable" for caught errors — this ensures
 * the actual error is logged so it can be investigated.
 */

interface ServiceErrorOptions {
  service: string;
  operation: string;
  error: unknown;
}

export function logServiceError({ service, operation, error }: ServiceErrorOptions): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`[${service}] ${operation} failed`, {
    message: err.message,
    code: (error as { code?: string })?.code,
    stack: err.stack,
  });
}

export function serviceUnavailable() {
  return { status: "unavailable" as const };
}

import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Common Supabase error codes mapped to result statuses.
 */
export type ServiceErrorStatus = "conflict" | "forbidden" | "not_found" | "unavailable" | "validation_error";

/**
 * Map a Supabase PostgrestError to a service result status.
 */
export function mapSupabaseError(error: unknown): ServiceErrorStatus {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    switch (code) {
      case "23505":
        return "conflict";
      case "42501":
        return "forbidden";
      case "PGRST116":
        return "conflict";
      case "42P01":
        return "unavailable"; // undefined table
      case "42703":
        return "unavailable"; // undefined column
      default:
        break;
    }
  }
  return "unavailable";
}

/**
 * Build a service error result from a caught error.
 */
export function serviceErrorResult(error: unknown): { status: ServiceErrorStatus } {
  return { status: mapSupabaseError(error) };
}
