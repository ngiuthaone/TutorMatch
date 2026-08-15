import { getApiBaseUrl } from "./auth/config";
import { getSessionAccessToken } from "./auth/session";

export class TutorBookingApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 0, message = code) {
    super(message);
    this.name = "TutorBookingApiError";
    this.code = code;
    this.status = status;
  }
}

export interface TutorBookingRecord {
  id: string;
  sessionId: string;
  status: "requested" | "confirmed" | "cancelled" | "rejected" | "completed";
  participantCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  pricing: {
    amountVnd: number | string;
    currency: string;
    hourlyRateVnd: number | string;
    durationMinutes: number;
    model: string;
    snapshottedAt: string;
  } | null;
  session: {
    id: string;
    offeringId?: string | null;
    status: "scheduled" | "cancelled" | "completed";
    startsAt: string;
    endsAt: string;
    minParticipants: number | null;
    maxParticipants: number | null;
    hardReservedCapacity: number;
    spotsLeft: number | null;
    version: number;
  };
  learner?: { displayName?: string | null } | null;
  payment?: { status?: string; amountVnd?: number | string; currency?: string } | null;
  paymentRequired?: boolean;
  paymentReady?: boolean;
  canTutorAccept?: boolean;
  canTutorReject?: boolean;
}

type ApiPayload = { error?: { code?: unknown; message?: unknown } };

function readApiError(response: Response, payload: unknown): TutorBookingApiError {
  const error = payload as ApiPayload | null;
  return new TutorBookingApiError(
    typeof error?.error?.code === "string" ? error.error.code : "TUTOR_BOOKING_UNAVAILABLE",
    response.status,
    typeof error?.error?.message === "string" ? error.error.message : "Tutor bookings are temporarily unavailable.",
  );
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new TutorBookingApiError("INVALID_RESPONSE", response.status);
  }
}

async function request(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<unknown> {
  const token = getSessionAccessToken();
  if (!token) throw new TutorBookingApiError("UNAUTHORIZED", 401, "Sign in to manage tutor bookings.");
  const response = await fetch(`${getApiBaseUrl().replace(/\/$/, "")}${path}`, {
    method: options.method ?? "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(options.body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "omit",
    cache: "no-store",
  });
  const payload = await parseJson(response);
  if (!response.ok) throw readApiError(response, payload);
  return payload;
}

function recordsFrom(value: unknown): TutorBookingRecord[] {
  if (!Array.isArray(value)) throw new TutorBookingApiError("INVALID_RESPONSE", 500);
  return value as TutorBookingRecord[];
}

export async function listTutorBookings(): Promise<TutorBookingRecord[]> {
  const payload = await request("/api/v1/me/tutor-bookings") as { ok?: unknown; bookings?: unknown };
  if (payload.ok !== true) throw new TutorBookingApiError("INVALID_RESPONSE", 500);
  return recordsFrom(payload.bookings);
}

export async function decideTutorBooking(bookingId: string, action: "accept" | "reject", expectedVersion?: number): Promise<TutorBookingRecord> {
  const payload = await request(`/api/v1/bookings/${encodeURIComponent(bookingId)}/${action === "accept" ? "accept" : "reject"}`, {
    method: "POST",
    ...(action === "reject" ? { body: { expectedVersion } } : {}),
  }) as { ok?: unknown; booking?: unknown };
  if (payload.ok !== true || !payload.booking || typeof payload.booking !== "object") throw new TutorBookingApiError("INVALID_RESPONSE", 500);
  return payload.booking as TutorBookingRecord;
}
