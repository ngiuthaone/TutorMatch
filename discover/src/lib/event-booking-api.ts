import { getApiBaseUrl } from "./auth/config";
import { getSessionAccessToken } from "./auth/session";

export class EventApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status = 0, message?: string) {
    super(message || code);
    this.name = "EventApiError";
    this.code = code;
    this.status = status;
  }
}

export interface EventOffering {
  id: string;
  hostId: string;
  offeringType: "event";
  title: string;
  description: string | null;
  pricingModel: "hourly_v1" | "flat_per_participant_v1";
  pricePerParticipantVnd: number | null;
  hourlyRateVnd: number | null;
  currency: "VND";
  bookingMode: "approval" | "instant";
  status: "draft" | "published" | "unpublished";
  version: number;
}

export interface EventSession {
  id: string;
  startsAt: string;
  endsAt: string;
  minParticipants: number | null;
  maxParticipants: number | null;
  spotsLeft: number;
  status: "scheduled" | "cancelled" | "completed";
}

export interface EventBookingResult {
  id: string;
  sessionId: string;
  status: "requested" | "confirmed" | "cancelled" | "rejected" | "completed";
  participantCount: number;
  pricing: {
    amountVnd: number;
    currency: "VND";
    model: string;
    pricePerParticipantVnd: number | null;
    snapshottedAt: string;
  } | null;
  paymentRequired: boolean;
  paymentReady: boolean;
}

async function jsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new EventApiError("INVALID_RESPONSE", response.status);
  }
}

function apiError(response: Response, payload: unknown): EventApiError {
  const error = (payload as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  return new EventApiError(
    typeof error?.code === "string" ? error.code : "EVENT_SERVICE_UNAVAILABLE",
    response.status,
    typeof error?.message === "string" ? error.message : undefined,
  );
}

async function request(path: string, options: { method?: string; body?: unknown; authenticated?: boolean } = {}): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.authenticated) {
    const token = getSessionAccessToken();
    if (!token) throw new EventApiError("UNAUTHORIZED", 401, "Sign in to book this event.");
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

export async function getEventOffering(offeringId: string): Promise<EventOffering | null> {
  const payload = await request(`/api/v1/offerings/${encodeURIComponent(offeringId)}`) as { ok?: unknown; offering?: unknown };
  if (payload.ok !== true) return null;
  return payload.offering as EventOffering;
}

export async function getEventSessions(offeringId: string): Promise<EventSession[]> {
  const payload = await request(`/api/v1/offerings/${encodeURIComponent(offeringId)}/sessions`) as { ok?: unknown; sessions?: unknown };
  if (payload.ok !== true || !Array.isArray(payload.sessions)) return [];
  return payload.sessions as EventSession[];
}

export async function createEventBooking(sessionId: string, participantCount: number): Promise<EventBookingResult> {
  const payload = await request("/api/v1/bookings", {
    method: "POST",
    body: { sessionId, participantCount },
    authenticated: true,
  }) as { ok?: unknown; booking?: unknown };
  if (payload.ok !== true) throw new EventApiError("INVALID_RESPONSE", 500);
  return payload.booking as EventBookingResult;
}

export interface EventWithHost {
  offering: EventOffering;
  sessions: EventSession[];
  hostDisplayName: string;
}

export async function listBookableEvents(): Promise<EventWithHost[]> {
  const payload = await request("/api/v1/sessions") as { ok?: unknown; sessions?: unknown };
  if (payload.ok !== true || !Array.isArray(payload.sessions)) return [];

  const sessionsByOffering = new Map<string, { sessions: EventSession[]; hostDisplayName: string }>();
  for (const session of payload.sessions) {
    const s = session as Record<string, unknown>;
    const offeringId = typeof s.offeringId === "string" ? s.offeringId : null;
    if (!offeringId) continue;
    if (!sessionsByOffering.has(offeringId)) {
      const tutorName = typeof s.tutor === "object" && s.tutor !== null
        ? String((s.tutor as Record<string, unknown>).displayName ?? "Host")
        : "Host";
      sessionsByOffering.set(offeringId, { sessions: [], hostDisplayName: tutorName });
    }
    const entry = sessionsByOffering.get(offeringId)!;
    entry.sessions.push({
      id: String(s.id),
      startsAt: String(s.startsAt),
      endsAt: String(s.endsAt),
      minParticipants: typeof s.minParticipants === "number" ? s.minParticipants : null,
      maxParticipants: typeof s.maxParticipants === "number" ? s.maxParticipants : null,
      spotsLeft: typeof s.spotsLeft === "number" ? s.spotsLeft : 0,
      status: (s.status as EventSession["status"]) || "scheduled",
    });
  }

  const results: EventWithHost[] = [];
  for (const [offeringId, { sessions, hostDisplayName }] of sessionsByOffering) {
    const offering = await getEventOffering(offeringId);
    if (offering && offering.offeringType === "event" && offering.status === "published") {
      results.push({ offering, sessions, hostDisplayName });
    }
  }
  return results;
}

export function isFreeEvent(offering: EventOffering): boolean {
  if (offering.pricingModel === "flat_per_participant_v1") {
    return (offering.pricePerParticipantVnd ?? 0) === 0;
  }
  return (offering.hourlyRateVnd ?? 0) === 0;
}

export function formatEventPriceVnd(offering: EventOffering): string {
  if (isFreeEvent(offering)) return "Free";
  const amount = offering.pricingModel === "flat_per_participant_v1"
    ? (offering.pricePerParticipantVnd ?? 0)
    : (offering.hourlyRateVnd ?? 0);
  return `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;
}

export function formatDuration(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const diffMs = end.getTime() - start.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatDateShort(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function formatTimeShort(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}
