import { getApiBaseUrl } from "./auth/config";
import { getSessionAccessToken } from "./auth/session";

export class CourseBookingApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status = 0, message?: string) {
    super(message || code);
    this.name = "CourseBookingApiError";
    this.code = code;
    this.status = status;
  }
}

export interface CourseOffering {
  id: string;
  kind: "course";
  title: string;
  pricingModel: "hourly_v1" | "flat_per_participant_v1";
  pricePerParticipantVnd: number | null;
  bookingMode: "instant" | "approval";
}

export interface CourseSession {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "cancelled" | "completed";
}

export interface CourseOfferingWithSession {
  offering: CourseOffering;
  session: CourseSession;
  courseId: string;
}

export interface CourseEnrollment {
  id: string;
  courseId: string;
  userId: string;
  enrolledAt: string;
  completedAt: string | null;
}

export interface CoursePurchaseResult {
  bookingId: string;
  sessionId: string;
  redirectUrl?: string;
}

async function jsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new CourseBookingApiError("INVALID_RESPONSE", response.status);
  }
}

function apiError(response: Response, payload: unknown): CourseBookingApiError {
  const error = (payload as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  return new CourseBookingApiError(
    typeof error?.code === "string" ? error.code : "COURSE_SERVICE_UNAVAILABLE",
    response.status,
    typeof error?.message === "string" ? error.message : undefined,
  );
}

async function request(path: string, options: { method?: string; body?: unknown; authenticated?: boolean } = {}): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.authenticated) {
    const token = getSessionAccessToken();
    if (!token) throw new CourseBookingApiError("UNAUTHORIZED", 401, "Sign in to enroll in this course.");
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${getApiBaseUrl().replace(/\/$/, "")}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const payload = await jsonResponse(response);
  if (!response.ok) throw apiError(response, payload);
  return payload;
}

export async function getCourseOfferingBySlug(slug: string): Promise<CourseOfferingWithSession | null> {
  const payload = await request(`/api/v1/courses/${encodeURIComponent(slug)}/offering`, { authenticated: true }) as {
    ok?: unknown;
    offering?: unknown;
    session?: unknown;
    courseId?: unknown;
  };
  if (payload.ok !== true) return null;
  const raw = payload as { offering: Record<string, unknown>; session: Record<string, unknown>; courseId: string };
  return {
    offering: {
      id: String(raw.offering.id ?? ""),
      kind: (raw.offering.kind as CourseOffering["kind"]) ?? "course",
      title: String(raw.offering.title ?? ""),
      pricingModel: (raw.offering.pricingModel as CourseOffering["pricingModel"]) ?? "flat_per_participant_v1",
      pricePerParticipantVnd: raw.offering.pricePerParticipantVnd == null ? null : Number(raw.offering.pricePerParticipantVnd),
      bookingMode: (raw.offering.bookingMode as CourseOffering["bookingMode"]) ?? "instant",
    },
    session: {
      id: String(raw.session.id ?? ""),
      startsAt: String(raw.session.startsAt ?? raw.session.starts_at ?? ""),
      endsAt: String(raw.session.endsAt ?? raw.session.ends_at ?? ""),
      status: (raw.session.status as CourseSession["status"]) ?? "scheduled",
    },
    courseId: raw.courseId,
  };
}

export async function getCourseEnrollment(courseId: string): Promise<CourseEnrollment | null> {
  const payload = await request(`/api/v1/courses/${encodeURIComponent(courseId)}/enrollment`, { authenticated: true }) as {
    ok?: unknown;
    item?: unknown;
  };
  if (payload.ok !== true) return null;
  const raw = payload.item as Record<string, unknown> | null;
  if (!raw) return null;
  return {
    id: String(raw.id ?? ""),
    courseId: String(raw.courseId ?? ""),
    userId: String(raw.userId ?? ""),
    enrolledAt: String(raw.enrolledAt ?? raw.enrolled_at ?? ""),
    completedAt: raw.completedAt == null && raw.completed_at == null ? null : String(raw.completedAt ?? raw.completed_at),
  };
}

export async function listMyCourseEnrollments(): Promise<CourseEnrollment[]> {
  const payload = await request("/api/v1/courses/mine/enrollments", { authenticated: true }) as {
    ok?: unknown;
    items?: unknown;
  };
  if (payload.ok !== true || !Array.isArray(payload.items)) return [];
  return (payload.items as Array<Record<string, unknown>>).map((item) => ({
    id: String(item.id ?? ""),
    courseId: String(item.courseId ?? ""),
    userId: String(item.userId ?? ""),
    enrolledAt: String(item.enrolledAt ?? item.enrolled_at ?? ""),
    completedAt: item.completedAt == null && item.completed_at == null ? null : String(item.completedAt ?? item.completed_at),
  }));
}

export async function createCourseBooking(slug: string): Promise<{ bookingId: string; sessionId: string }> {
  const offering = await getCourseOfferingBySlug(slug);
  if (!offering) throw new CourseBookingApiError("COURSE_NOT_FOUND", 404, "Course not found.");

  const idempotencyKey = `course-${offering.session.id}-${crypto.randomUUID()}`;
  const payload = await request("/api/v1/bookings", {
    method: "POST",
    body: { sessionId: offering.session.id, participantCount: 1, idempotencyKey },
    authenticated: true,
  }) as { ok?: unknown; booking?: unknown };

  if (payload.ok !== true) throw new CourseBookingApiError("BOOKING_FAILED", 500);

  const booking = payload.booking as { id?: unknown; sessionId?: unknown };
  if (!booking.id) throw new CourseBookingApiError("INVALID_RESPONSE", 500);

  return { bookingId: String(booking.id), sessionId: String(booking.sessionId) };
}

export async function startCoursePayment(bookingId: string): Promise<{ redirectUrl: string }> {
  const idempotencyKey = `course-pay-${bookingId}-${crypto.randomUUID()}`;
  const response = await fetch(`${getApiBaseUrl().replace(/\/$/, "")}/api/v1/payments/start`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${getSessionAccessToken()}`,
    },
    body: JSON.stringify({ bookingId, idempotencyKey }),
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const respPayload = await jsonResponse(response);
  if (!response.ok) throw apiError(response, respPayload);
  const redirectUrl = (respPayload as { payment?: { redirectUrl?: unknown } } | null)?.payment?.redirectUrl;
  if (typeof redirectUrl !== "string" || !redirectUrl) throw new CourseBookingApiError("INVALID_RESPONSE", 500);
  return { redirectUrl };
}
