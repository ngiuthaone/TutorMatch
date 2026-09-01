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
