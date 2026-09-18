import { getApiBaseUrl } from "./auth/config";
import { getSessionAccessToken } from "./auth/session";
import type { EventDetail } from "./event-data";

export class WorkshopApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status = 0, message?: string) {
    super(message || code);
    this.name = "WorkshopApiError";
    this.code = code;
    this.status = status;
  }
}

export interface WorkshopOffering {
  id: string;
  kind: "tutor" | "workshop" | "class" | "event";
  title: string;
  description: string | null;
  pricingModel: "hourly_v1" | "flat_per_participant_v1";
  pricePerParticipantVnd: number | null;
  hourlyRateVnd: number | null;
  bookingMode: "approval" | "instant";
  publicationStatus: "draft" | "published" | "unpublished";
  version: number;
}

export interface WorkshopSession {
  id: string;
  startsAt: string;
  endsAt: string;
  minParticipants: number | null;
  maxParticipants: number | null;
  spotsLeft: number;
  status: "scheduled" | "cancelled" | "completed";
}

export interface WorkshopBookingResult {
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
    throw new WorkshopApiError("INVALID_RESPONSE", response.status);
  }
}

function apiError(response: Response, payload: unknown): WorkshopApiError {
  const error = (payload as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  return new WorkshopApiError(
    typeof error?.code === "string" ? error.code : "WORKSHOP_SERVICE_UNAVAILABLE",
    response.status,
    typeof error?.message === "string" ? error.message : undefined,
  );
}

async function request(path: string, options: { method?: string; body?: unknown; authenticated?: boolean } = {}): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.authenticated) {
    const token = getSessionAccessToken();
    if (!token) throw new WorkshopApiError("UNAUTHORIZED", 401, "Sign in to book this workshop.");
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

export async function getWorkshopOffering(offeringId: string): Promise<WorkshopOffering | null> {
  const payload = await request(`/api/v1/offerings/${encodeURIComponent(offeringId)}`) as { ok?: unknown; offering?: unknown };
  if (payload.ok !== true) return null;
  const raw = payload.offering as Record<string, unknown>;
  return {
    id: String(raw.id ?? ""),
    kind: (raw.kind as WorkshopOffering["kind"]) ?? "workshop",
    title: String(raw.title ?? ""),
    description: raw.description == null ? null : String(raw.description),
    pricingModel: (raw.pricingModel as WorkshopOffering["pricingModel"]) ?? "hourly_v1",
    pricePerParticipantVnd: raw.pricePerParticipantVnd == null ? null : Number(raw.pricePerParticipantVnd),
    hourlyRateVnd: raw.hourlyRateVnd == null ? null : Number(raw.hourlyRateVnd),
    bookingMode: (raw.bookingMode as WorkshopOffering["bookingMode"]) ?? "approval",
    publicationStatus: (raw.publicationStatus as WorkshopOffering["publicationStatus"]) ?? "draft",
    version: Number(raw.version ?? 1),
  };
}

export async function getWorkshopSessions(offeringId: string): Promise<WorkshopSession[]> {
  const payload = await request(`/api/v1/offerings/${encodeURIComponent(offeringId)}/sessions`) as { ok?: unknown; sessions?: unknown };
  if (payload.ok !== true || !Array.isArray(payload.sessions)) return [];
  return payload.sessions as WorkshopSession[];
}

export async function createWorkshopBooking(sessionId: string, participantCount: number): Promise<WorkshopBookingResult> {
  const payload = await request("/api/v1/bookings", {
    method: "POST",
    body: { sessionId, participantCount },
    authenticated: true,
  }) as { ok?: unknown; booking?: unknown };
  if (payload.ok !== true) throw new WorkshopApiError("INVALID_RESPONSE", 500);
  return payload.booking as WorkshopBookingResult;
}

export async function startWorkshopPayment(bookingId: string): Promise<{ redirectUrl: string }> {
  const token = getSessionAccessToken();
  if (!token) throw new WorkshopApiError("UNAUTHORIZED", 401, "Sign in to pay for this booking.");

  const idempotencyKey = `workshop-${bookingId}-${crypto.randomUUID()}`;
  const response = await fetch(`${getApiBaseUrl().replace(/\/$/, "")}/api/v1/payments/start`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ bookingId, idempotencyKey }),
    credentials: "omit",
    cache: "no-store",
  });
  const payload = await jsonResponse(response);
  if (!response.ok) throw apiError(response, payload);
  const redirectUrl = (payload as { payment?: { redirectUrl?: unknown } } | null)?.payment?.redirectUrl;
  if (typeof redirectUrl !== "string" || !redirectUrl) throw new WorkshopApiError("INVALID_RESPONSE", 500);
  return { redirectUrl };
}

export interface WorkshopRecommendation {
  slug: string;
  title: string;
  host: string;
  topic: string;
  location: string;
  price: string;
  image?: string;
  rating?: number;
  reviewCount?: number;
}

export interface WorkshopWithSessions {
  offering: WorkshopOffering;
  sessions: WorkshopSession[];
  content?: EventDetail;
  recommendations: WorkshopRecommendation[];
}

/**
 * Fetch a published workshop by slug, including its sessions.
 * Used by the workshop detail page.
 */
export async function getWorkshopBySlug(slug: string): Promise<WorkshopWithSessions | null> {
  const payload = await request(`/api/v1/offerings/by-slug/${encodeURIComponent(slug)}`) as {
    ok?: unknown;
    offering?: unknown;
    sessions?: unknown;
  };
  if (payload.ok !== true) return null;
  const raw = payload.offering as Record<string, unknown> | null;
  if (!raw) return null;

  const offering: WorkshopOffering = {
    id: String(raw.id ?? ""),
    kind: (raw.kind as WorkshopOffering["kind"]) ?? "workshop",
    title: String(raw.title ?? ""),
    description: (raw.description as string) ?? "",
    pricingModel: (raw.pricingModel ?? raw.pricing_model) as WorkshopOffering["pricingModel"] ?? "flat_per_participant_v1",
    pricePerParticipantVnd: (raw.pricePerParticipantVnd ?? raw.price_per_participant_vnd ?? 0) as number,
    hourlyRateVnd: (raw.hourlyRateVnd ?? raw.hourly_rate_vnd) as number | null,
    bookingMode: (raw.bookingMode ?? raw.booking_mode) as WorkshopOffering["bookingMode"] ?? "approval",
    publicationStatus: (raw.publicationStatus ?? raw.publication_status) as WorkshopOffering["publicationStatus"] ?? "draft",
    version: Number(raw.version ?? 1),
  };

  const rawSessions = payload.sessions as Array<Record<string, unknown>> | null;
  const sessions: WorkshopSession[] = (rawSessions ?? []).map((s) => ({
    id: String(s.id ?? ""),
    startsAt: String(s.starts_at ?? s.startsAt ?? ""),
    endsAt: String(s.ends_at ?? s.endsAt ?? ""),
    minParticipants: s.min_participants == null ? null : Number(s.min_participants),
    maxParticipants: s.max_participants == null ? null : Number(s.max_participants),
    spotsLeft: typeof s.spots_left === "number" ? s.spots_left : (typeof s.spotsLeft === "number" ? s.spotsLeft : 0),
    status: (s.status as WorkshopSession["status"]) ?? "scheduled",
  }));

  let content: EventDetail | undefined;
  try {
    const rawContent = await request(`/api/v1/events/${encodeURIComponent(slug)}`);
    const candidate = rawContent as Record<string, unknown> | null;
    if (candidate && typeof candidate.title === "string" && typeof candidate.slug === "string") {
      content = candidate as unknown as EventDetail;
    }
  } catch {
    // Rich publishing content is optional while legacy offerings are migrated.
  }

  let recommendations: WorkshopRecommendation[] = [];
  try {
    const rawList = await request("/api/v1/events");
    const payload = rawList as { events?: unknown } | unknown[] | null;
    const source = Array.isArray(payload)
      ? payload
      : payload && Array.isArray(payload.events)
        ? payload.events
        : [];
    recommendations = source
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .filter((item) => String(item.slug ?? "") !== slug)
      .slice(0, 8)
      .map((item) => ({
        slug: String(item.slug ?? ""),
        title: String(item.title ?? ""),
        host: String(item.host ?? item.creatorName ?? "Tutoria host"),
        topic: String(item.topic ?? "Workshop"),
        location: String(item.location ?? ""),
        price: String(item.price ?? ""),
        image: typeof item.image === "string" ? item.image : undefined,
        rating: typeof item.rating === "number" ? item.rating : undefined,
        reviewCount: typeof item.reviewCount === "number" ? item.reviewCount : undefined,
      }))
      .filter((item) => item.slug && item.title);
  } catch {
    recommendations = [];
  }

  return { offering, sessions, content, recommendations };
}
