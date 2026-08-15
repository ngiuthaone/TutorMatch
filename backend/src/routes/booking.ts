import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { BookingService, BookingServiceResult } from "../services/booking-service.js";

const id = z.string().uuid();
const version = z.number().int().positive();
const createBookingSchema = z.object({ sessionId: id, participantCount: z.number().int().positive().max(100).default(1) });
const versionBody = z.object({ expectedVersion: version });
const cancelBody = versionBody.extend({ reason: z.string().trim().max(500).optional() });
const rescheduleBody = versionBody.extend({ targetSessionId: id, reason: z.string().trim().max(500).optional() });
const rescheduleSessionBody = versionBody.extend({ startsAt: z.string().datetime(), endsAt: z.string().datetime() });

function routeId(value: unknown, name: string): string {
  const parsed = id.safeParse(value);
  if (!parsed.success) throw new ApiError(400, "INVALID_ID", `${name} is invalid.`);
  return parsed.data;
}

function fail(result: BookingServiceResult): never {
  const code = result.error?.code ?? "";
  const message = result.error?.message ?? "";
  if (message.includes("BOOKING_NOT_FOUND")) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking was not found.");
  if (message.includes("EMAIL_VERIFICATION_REQUIRED")) throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Verify your email before sending a booking request.");
  if (message.includes("RATE_LIMITED")) throw new ApiError(429, "RATE_LIMITED", "You have sent several booking requests recently. Please wait a little before trying again.");
  if (code === "42501") throw new ApiError(403, "FORBIDDEN", "You are not allowed to perform this action.");
  if (code === "40001" || message.includes("STALE_VERSION")) throw new ApiError(409, "STALE_VERSION", "This booking or session changed. Reload before trying again.");
  if (message.includes("INSUFFICIENT_CAPACITY")) throw new ApiError(409, "SESSION_CAPACITY_EXHAUSTED", "That session no longer has enough capacity.");
  if (message.includes("SESSION_NOT_OPEN")) throw new ApiError(409, "SESSION_UNAVAILABLE", "That session is no longer available.");
  if (message.includes("BOOKING_PRICE_NOT_SNAPSHOTTED")) throw new ApiError(409, "BOOKING_PRICE_MISSING", "This session is not ready for booking.");
  if (message.includes("BOOKING_NOT_APPROVED_FOR_PAYMENT")) throw new ApiError(409, "PAYMENT_NOT_READY", "The tutor has not approved this booking for payment.");
  if (message.includes("PAYMENT_NOT_RETRYABLE")) throw new ApiError(409, "PAYMENT_NOT_RETRYABLE", "This payment cannot be retried.");
  if (message.includes("BOOKING_CONFLICT")) throw new ApiError(409, "BOOKING_CONFLICT", "This booking conflicts with another active booking.");
  if (message.includes("INVALID_TRANSITION")) throw new ApiError(409, "INVALID_LIFECYCLE_TRANSITION", "That action is not valid for the current state.");
  if (message.includes("INVALID_IDEMPOTENCY_KEY")) throw new ApiError(400, "INVALID_IDEMPOTENCY_KEY", "The idempotency key is invalid.");
  throw new ApiError(503, "BOOKING_SERVICE_UNAVAILABLE", "Booking service is temporarily unavailable.");
}

async function readAfterMutation(service: BookingService, token: string, bookingId: string, fallback: unknown) {
  const read = await service.getBooking(token, bookingId);
  return read.error ? fallback : read.data;
}

export const bookingRoutes: FastifyPluginAsync<{ service: BookingService }> = async (app, options) => {
  app.get("/api/v1/sessions", async (request) => {
    const raw = request.query as { tutorProfileId?: unknown };
    const tutorProfileId = raw.tutorProfileId === undefined ? undefined : routeId(raw.tutorProfileId, "tutorProfileId");
    const result = await options.service.listSessions(tutorProfileId);
    if (result.error) fail(result);
    return { ok: true, sessions: result.data };
  });

  app.get("/api/v1/sessions/:sessionId", async (request) => {
    const sessionId = routeId((request.params as { sessionId?: unknown }).sessionId, "sessionId");
    const result = await options.service.getSession(sessionId);
    if (result.error) fail(result);
    if (result.data === null) throw new ApiError(404, "SESSION_NOT_FOUND", "Session was not found.");
    return { ok: true, session: result.data };
  });

  app.post("/api/v1/bookings", { preHandler: app.authenticate }, async (request) => {
    const body = createBookingSchema.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "BOOKING_INVALID", "Booking details are invalid.");
    const result = await options.service.createBooking(request.auth.accessToken, body.data.sessionId, body.data.participantCount);
    if (result.error) fail(result);
    return { ok: true, booking: await readAfterMutation(options.service, request.auth.accessToken, (result.data as { id: string }).id, result.data) };
  });

  app.get("/api/v1/bookings", { preHandler: app.authenticate }, async (request) => {
    const result = await options.service.listLearnerBookings(request.auth.accessToken);
    if (result.error) fail(result);
    return { ok: true, bookings: result.data };
  });

  app.get("/api/v1/me/tutor-bookings", { preHandler: app.authenticate }, async (request) => {
    const result = await options.service.listTutorBookings(request.auth.accessToken);
    if (result.error) fail(result);
    return { ok: true, bookings: result.data };
  });

  app.get("/api/v1/bookings/:bookingId", { preHandler: app.authenticate }, async (request) => {
    const bookingId = routeId((request.params as { bookingId?: unknown }).bookingId, "bookingId");
    const result = await options.service.getBooking(request.auth.accessToken, bookingId);
    if (result.error) fail(result);
    if (result.data === null) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking was not found.");
    return { ok: true, booking: result.data };
  });

  app.get("/api/v1/bookings/:bookingId/cancellation-preview", { preHandler: app.authenticate }, async (request) => {
    const bookingId = routeId((request.params as { bookingId?: unknown }).bookingId, "bookingId");
    const result = await options.service.getCancellationPreview(request.auth.accessToken, bookingId);
    if (result.error) fail(result);
    if (result.data === null) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking was not found.");
    return { ok: true, preview: result.data };
  });

  app.post("/api/v1/bookings/:bookingId/accept", { preHandler: app.authenticate }, async (request) => {
    const bookingId = routeId((request.params as { bookingId?: unknown }).bookingId, "bookingId");
    const result = await options.service.tutorAccept(request.auth.accessToken, bookingId);
    if (result.error) fail(result);
    return { ok: true, booking: await readAfterMutation(options.service, request.auth.accessToken, bookingId, result.data) };
  });

  app.post("/api/v1/bookings/:bookingId/reject", { preHandler: app.authenticate }, async (request) => {
    const bookingId = routeId((request.params as { bookingId?: unknown }).bookingId, "bookingId");
    const body = versionBody.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "BOOKING_INVALID", "Expected booking version is required.");
    const result = await options.service.tutorReject(request.auth.accessToken, bookingId, body.data.expectedVersion);
    if (result.error) fail(result);
    return { ok: true, booking: await readAfterMutation(options.service, request.auth.accessToken, bookingId, result.data) };
  });

  app.post("/api/v1/tutor/bookings/:bookingId/cancel", { preHandler: app.authenticate }, async (request) => {
    const bookingId = routeId((request.params as { bookingId?: unknown }).bookingId, "bookingId");
    const body = cancelBody.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "BOOKING_INVALID", "Cancellation details are invalid.");
    const result = await options.service.tutorCancel(request.auth.accessToken, bookingId, body.data.expectedVersion, body.data.reason);
    if (result.error) fail(result);
    return { ok: true, booking: await readAfterMutation(options.service, request.auth.accessToken, bookingId, result.data) };
  });

  app.post("/api/v1/bookings/:bookingId/cancel", { preHandler: app.authenticate }, async (request) => {
    const bookingId = routeId((request.params as { bookingId?: unknown }).bookingId, "bookingId");
    const body = cancelBody.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "BOOKING_INVALID", "Cancellation details are invalid.");
    const result = await options.service.learnerCancel(request.auth.accessToken, bookingId, body.data.expectedVersion, body.data.reason);
    if (result.error) fail(result);
    return { ok: true, booking: await readAfterMutation(options.service, request.auth.accessToken, bookingId, result.data) };
  });

  app.post("/api/v1/bookings/:bookingId/reschedule-requests", { preHandler: app.authenticate }, async (request) => {
    const bookingId = routeId((request.params as { bookingId?: unknown }).bookingId, "bookingId");
    const body = rescheduleBody.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "RESCHEDULE_INVALID", "Reschedule details are invalid.");
    const result = await options.service.createRescheduleRequest(request.auth.accessToken, bookingId, body.data.targetSessionId, body.data.expectedVersion, body.data.reason);
    if (result.error) fail(result);
    return { ok: true, request: result.data };
  });

  app.post("/api/v1/reschedule-requests/:requestId/accept", { preHandler: app.authenticate }, async (request) => {
    const requestId = routeId((request.params as { requestId?: unknown }).requestId, "requestId");
    const result = await options.service.acceptReschedule(request.auth.accessToken, requestId);
    if (result.error) fail(result);
    return { ok: true, result: result.data };
  });

  app.post("/api/v1/reschedule-requests/:requestId/reject", { preHandler: app.authenticate }, async (request) => {
    const requestId = routeId((request.params as { requestId?: unknown }).requestId, "requestId");
    const result = await options.service.rejectReschedule(request.auth.accessToken, requestId);
    if (result.error) fail(result);
    return { ok: true, result: result.data };
  });

  app.post("/api/v1/reschedule-requests/:requestId/cancel", { preHandler: app.authenticate }, async (request) => {
    const requestId = routeId((request.params as { requestId?: unknown }).requestId, "requestId");
    const result = await options.service.cancelReschedule(request.auth.accessToken, requestId);
    if (result.error) fail(result);
    return { ok: true, result: result.data };
  });

  app.post("/api/v1/sessions/:sessionId/cancel", { preHandler: app.authenticate }, async (request) => {
    const sessionId = routeId((request.params as { sessionId?: unknown }).sessionId, "sessionId");
    const body = cancelBody.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "SESSION_INVALID", "Cancellation details are invalid.");
    const result = await options.service.cancelSession(request.auth.accessToken, sessionId, body.data.expectedVersion, body.data.reason);
    if (result.error) fail(result);
    return { ok: true, session: result.data };
  });

  app.post("/api/v1/sessions/:sessionId/reschedule", { preHandler: app.authenticate }, async (request) => {
    const sessionId = routeId((request.params as { sessionId?: unknown }).sessionId, "sessionId");
    const body = rescheduleSessionBody.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "SESSION_INVALID", "Reschedule details are invalid.");
    const result = await options.service.rescheduleSession(request.auth.accessToken, sessionId, body.data.startsAt, body.data.endsAt, body.data.expectedVersion);
    if (result.error) fail(result);
    return { ok: true, session: result.data };
  });
};
