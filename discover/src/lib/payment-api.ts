import { getApiBaseUrl } from "./auth/config";
import { getSessionAccessToken } from "./auth/session";

export class PaymentApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status = 0, message?: string) {
    super(message || code);
    this.name = "PaymentApiError";
    this.code = code;
    this.status = status;
  }
}

const idempotencyKeys = new Map<string, string>();

function idempotencyKeyFor(bookingId: string): string {
  const existing = idempotencyKeys.get(bookingId);
  if (existing) return existing;
  const key = `tutoria-${bookingId}-${crypto.randomUUID()}`;
  idempotencyKeys.set(bookingId, key);
  return key;
}

async function jsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new PaymentApiError("INVALID_RESPONSE", response.status);
  }
}

function apiError(response: Response, payload: unknown): PaymentApiError {
  const error = (payload as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  return new PaymentApiError(
    typeof error?.code === "string" ? error.code : "PAYMENT_SERVICE_UNAVAILABLE",
    response.status,
    typeof error?.message === "string" ? error.message : undefined,
  );
}

export async function startPayment(bookingId: string): Promise<{ redirectUrl: string }> {
  const token = getSessionAccessToken();
  if (!token) throw new PaymentApiError("UNAUTHORIZED", 401, "Sign in to pay for this booking.");
  const response = await fetch(`${getApiBaseUrl().replace(/\/$/, "")}/api/v1/payments/start`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ bookingId, idempotencyKey: idempotencyKeyFor(bookingId) }),
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await jsonResponse(response);
  if (!response.ok) throw apiError(response, payload);
  const redirectUrl = (payload as { payment?: { redirectUrl?: unknown } } | null)?.payment?.redirectUrl;
  if (typeof redirectUrl !== "string" || !redirectUrl) throw new PaymentApiError("INVALID_RESPONSE", 500);
  return { redirectUrl };
}

export function resetPaymentIdempotencyForTests(): void {
  idempotencyKeys.clear();
}
