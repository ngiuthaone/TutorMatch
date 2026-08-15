import { getApiBaseUrl } from "./auth/config";
import { getSessionAccessToken } from "./auth/session";

export class BookingApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status = 0, message?: string) {
    super(message || code);
    this.name = "BookingApiError";
    this.code = code;
    this.status = status;
  }
}

export interface BookableSession {
  id: string;
  tutorProfileId: string;
  status: "scheduled";
  startsAt: string;
  endsAt: string;
  minParticipants: number | null;
  maxParticipants: number | null;
  hardReservedCapacity: number;
  spotsLeft: number | null;
  version: number;
  hourlyRateVnd: number | null;
  currency: "VND";
}

export interface BookingPricing {
  amountVnd: number;
  currency: "VND";
  hourlyRateVnd: number;
  durationMinutes: number;
  model: string;
  snapshottedAt: string;
}

export interface BookingRecord {
  id: string;
  sessionId: string;
  status: "requested" | "confirmed" | "cancelled" | "rejected" | "completed";
  participantCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  pricing: BookingPricing | null;
  session: BookableSession;
  tutor: {
    id: string;
    displayName: string;
  };
  paymentRequired?: boolean;
  paymentReady?: boolean;
  paymentRetryAllowed?: boolean;
  paymentInFlight?: boolean;
  canLearnerCancel?: boolean;
  canTutorCancel?: boolean;
  cancellation?: {
    status: "cancelled";
    cancelledAt: string | null;
    actor: "attendee" | "host" | "system" | null;
    reason: string | null;
  } | null;
  payment?: {
    id: string;
    status: "pending" | "succeeded" | "failed" | "refunded";
    amountVnd: number;
    currency: "VND";
    refundedAmountVnd: number;
    paidAt: string | null;
  } | null;
  refund?: {
    status: "none" | "processing" | "refunded" | "needs_attention" | "succeeded" | null;
    amountVnd?: number | string;
    refundedAmountVnd: number;
    obligationCount: number;
  } | null;
}

export interface CancellationPreview {
  allowed: boolean;
  refundMode: "NONE" | "FULL";
  refundAmountVnd: number;
  policyCode: string;
  expectedVersion: number;
  paymentInFlight: boolean;
}

async function jsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new BookingApiError("INVALID_RESPONSE", response.status);
  }
}

function apiError(response: Response, payload: unknown): BookingApiError {
  const error = (payload as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  return new BookingApiError(
    typeof error?.code === "string" ? error.code : "BOOKING_SERVICE_UNAVAILABLE",
    response.status,
    typeof error?.message === "string" ? error.message : undefined,
  );
}

function sessionFrom(value: unknown): BookableSession {
  const session = value as Partial<BookableSession> | null;
  if (!session || typeof session.id !== "string" || typeof session.startsAt !== "string" || typeof session.endsAt !== "string") {
    throw new BookingApiError("INVALID_RESPONSE", 500);
  }
  return session as BookableSession;
}

function bookingFrom(value: unknown): BookingRecord {
  const booking = value as Partial<BookingRecord> | null;
  if (!booking || typeof booking.id !== "string" || typeof booking.sessionId !== "string" || typeof booking.status !== "string" || !booking.session || !booking.tutor || typeof booking.tutor.id !== "string" || typeof booking.tutor.displayName !== "string") {
    throw new BookingApiError("INVALID_RESPONSE", 500);
  }
  return booking as BookingRecord;
}

async function request(path: string, options: { method?: string; body?: unknown; authenticated?: boolean } = {}): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.authenticated) {
    const token = getSessionAccessToken();
    if (!token) throw new BookingApiError("UNAUTHORIZED", 401);
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${getApiBaseUrl().replace(/\/$/, "")}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "omit",
    cache: "no-store",
  });
  const payload = await jsonResponse(response);
  if (!response.ok) throw apiError(response, payload);
  return payload;
}

export async function listBookableSessions(tutorProfileId: string): Promise<BookableSession[]> {
  const payload = await request(`/api/v1/sessions?tutorProfileId=${encodeURIComponent(tutorProfileId)}`) as { ok?: unknown; sessions?: unknown };
  if (payload.ok !== true || !Array.isArray(payload.sessions)) throw new BookingApiError("INVALID_RESPONSE", 500);
  return payload.sessions.map(sessionFrom);
}

export async function createBooking(sessionId: string, participantCount = 1): Promise<BookingRecord> {
  const payload = await request("/api/v1/bookings", {
    method: "POST",
    body: { sessionId, participantCount },
    authenticated: true,
  }) as { ok?: unknown; booking?: unknown };
  if (payload.ok !== true) throw new BookingApiError("INVALID_RESPONSE", 500);
  return bookingFrom(payload.booking);
}

export async function listLearnerBookings(): Promise<BookingRecord[]> {
  const payload = await request("/api/v1/bookings", { authenticated: true }) as { ok?: unknown; bookings?: unknown };
  if (payload.ok !== true || !Array.isArray(payload.bookings)) throw new BookingApiError("INVALID_RESPONSE", 500);
  return payload.bookings.map(bookingFrom);
}

export async function getLearnerBooking(bookingId: string): Promise<BookingRecord> {
  const payload = await request(`/api/v1/bookings/${encodeURIComponent(bookingId)}`, { authenticated: true }) as { ok?: unknown; booking?: unknown };
  if (payload.ok !== true) throw new BookingApiError("INVALID_RESPONSE", 500);
  return bookingFrom(payload.booking);
}

export async function getCancellationPreview(bookingId: string): Promise<CancellationPreview> {
  const payload = await request(`/api/v1/bookings/${encodeURIComponent(bookingId)}/cancellation-preview`, { authenticated: true }) as { ok?: unknown; preview?: unknown };
  const preview = payload.preview as Partial<CancellationPreview> | null;
  if (payload.ok !== true || !preview || typeof preview.allowed !== "boolean" || (preview.refundMode !== "NONE" && preview.refundMode !== "FULL") || typeof preview.expectedVersion !== "number") {
    throw new BookingApiError("INVALID_RESPONSE", 500);
  }
  return {
    allowed: preview.allowed,
    refundMode: preview.refundMode,
    refundAmountVnd: typeof preview.refundAmountVnd === "number" ? preview.refundAmountVnd : 0,
    policyCode: typeof preview.policyCode === "string" ? preview.policyCode : "UNKNOWN",
    expectedVersion: preview.expectedVersion,
    paymentInFlight: preview.paymentInFlight === true,
  };
}

export async function cancelLearnerBooking(bookingId: string, expectedVersion: number, reason?: string): Promise<BookingRecord> {
  const payload = await request(`/api/v1/bookings/${encodeURIComponent(bookingId)}/cancel`, {
    method: "POST",
    body: { expectedVersion, ...(reason ? { reason } : {}) },
    authenticated: true,
  }) as { ok?: unknown; booking?: unknown };
  if (payload.ok !== true) throw new BookingApiError("INVALID_RESPONSE", 500);
  return bookingFrom(payload.booking);
}
