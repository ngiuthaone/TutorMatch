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
  paymentRequired?: boolean;
  paymentReady?: boolean;
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
  if (!booking || typeof booking.id !== "string" || typeof booking.sessionId !== "string" || typeof booking.status !== "string" || !booking.session) {
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
