import { getApiBaseUrl } from "./auth/config";
import { getSessionAccessToken } from "./auth/session";

export class TutorWorkshopBookingApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 0, message = code) {
    super(message);
    this.name = "TutorWorkshopBookingApiError";
    this.code = code;
    this.status = status;
  }
}

export interface WorkshopBookingRecord {
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
    model: string;
    pricePerParticipantVnd: number | null;
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
  offering?: {
    id: string;
    title: string;
    pricingModel: string;
    pricePerParticipantVnd: number | null;
  } | null;
  learner?: { displayName?: string | null } | null;
  payment?: { status?: string; amountVnd?: number | string; currency?: string } | null;
  paymentRequired?: boolean;
  paymentReady?: boolean;
  paymentInFlight?: boolean;
  canTutorCancel?: boolean;
  cancellation?: { status: "cancelled"; cancelledAt: string | null; actor: string | null; reason: string | null } | null;
  refund?: { status: "none" | "processing" | "refunded" | "needs_attention"; amountVnd?: number | string; refundedAmountVnd?: number | string } | null;
}

type ApiPayload = { error?: { code?: unknown; message?: unknown } };

function readApiError(response: Response, payload: unknown): TutorWorkshopBookingApiError {
  const error = payload as ApiPayload | null;
  return new TutorWorkshopBookingApiError(
    typeof error?.error?.code === "string" ? error.error.code : "TUTOR_WORKSHOP_BOOKING_UNAVAILABLE",
    response.status,
    typeof error?.error?.message === "string" ? error.error.message : "Workshop bookings are temporarily unavailable.",
  );
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new TutorWorkshopBookingApiError("INVALID_RESPONSE", response.status);
  }
}

async function request(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<unknown> {
  const token = getSessionAccessToken();
  if (!token) throw new TutorWorkshopBookingApiError("UNAUTHORIZED", 401, "Sign in to manage workshop bookings.");
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

function recordsFrom(value: unknown): WorkshopBookingRecord[] {
  if (!Array.isArray(value)) throw new TutorWorkshopBookingApiError("INVALID_RESPONSE", 500);
  return value as WorkshopBookingRecord[];
}

export async function listWorkshopBookings(): Promise<WorkshopBookingRecord[]> {
  const payload = await request("/api/v1/me/workshop-bookings") as { ok?: unknown; bookings?: unknown };
  if (payload.ok !== true) throw new TutorWorkshopBookingApiError("INVALID_RESPONSE", 500);
  return recordsFrom(payload.bookings);
}

export async function cancelWorkshopBooking(bookingId: string, expectedVersion: number, reason?: string): Promise<WorkshopBookingRecord> {
  const payload = await request(`/api/v1/workshop/bookings/${encodeURIComponent(bookingId)}/cancel`, {
    method: "POST",
    body: { expectedVersion, ...(reason ? { reason } : {}) },
  }) as { ok?: unknown; booking?: unknown };
  if (payload.ok !== true || !payload.booking || typeof payload.booking !== "object") throw new TutorWorkshopBookingApiError("INVALID_RESPONSE", 500);
  return payload.booking as WorkshopBookingRecord;
}
