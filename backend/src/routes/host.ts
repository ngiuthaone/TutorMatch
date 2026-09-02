import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { HostCenterService } from "../services/host-center-service.js";

const noStore = async (_request: unknown, reply: any, payload: unknown) => {
  reply.header("Cache-Control", "no-store").header("Pragma", "no-cache");
  return payload;
};

const offeringIdParam = z.object({ id: z.string().uuid() });

const offeringsQuerySchema = z.object({
  status: z.enum(["draft", "published", "unpublished"]).optional(),
  kind: z.enum(["tutor", "workshop", "class", "event"]).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const sessionsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  offeringId: z.string().uuid().optional(),
  status: z.enum(["scheduled", "cancelled", "completed"]).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const attendeesQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  offeringId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const earningsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

function failUnavailable(): never {
  throw new ApiError(503, "HOST_CENTER_UNAVAILABLE", "Tutoria Center is temporarily unavailable.");
}

export const hostCenterRoutes: FastifyPluginAsync<{
  authService: AuthService;
  service: HostCenterService;
  max: number;
  windowMs: number;
}> = async (app, options) => {
  app.get("/api/v1/host/dashboard", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const result = await options.service.getDashboard(request.auth.accessToken, request.auth.userId);
    if (result.status !== "ok") failUnavailable();
    return { ok: true, dashboard: result.data };
  });

  app.get("/api/v1/host/offerings", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const parsed = offeringsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid offerings query parameters.");
    const result = await options.service.listOfferings(request.auth.accessToken, request.auth.userId, {
      status: parsed.data.status,
      kind: parsed.data.kind,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    if (result.status !== "ok") failUnavailable();
    return { ok: true, offerings: result.data };
  });

  app.get("/api/v1/host/offerings/:id", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const parsed = offeringIdParam.safeParse(request.params);
    if (!parsed.success) throw new ApiError(400, "INVALID_ID", "Offering id is invalid.");
    const result = await options.service.getOffering(request.auth.accessToken, request.auth.userId, parsed.data.id);
    if (result.status !== "ok") failUnavailable();
    return { ok: true, offering: result.data };
  });

  app.get("/api/v1/host/sessions", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const parsed = sessionsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid sessions query parameters.");
    const result = await options.service.listSessions(request.auth.accessToken, request.auth.userId, {
      from: parsed.data.from,
      to: parsed.data.to,
      offeringId: parsed.data.offeringId,
      status: parsed.data.status,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    if (result.status !== "ok") failUnavailable();
    return { ok: true, sessions: result.data };
  });

  app.get("/api/v1/host/attendees", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const parsed = attendeesQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid attendees query parameters.");
    const result = await options.service.listAttendees(request.auth.accessToken, request.auth.userId, {
      query: parsed.data.q,
      offeringId: parsed.data.offeringId,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    if (result.status !== "ok") failUnavailable();
    return { ok: true, attendees: result.data };
  });

  app.get("/api/v1/host/earnings", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const parsed = earningsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid earnings query parameters.");
    const result = await options.service.getEarnings(request.auth.accessToken, request.auth.userId, {
      from: parsed.data.from,
      to: parsed.data.to,
    });
    if (result.status !== "ok") failUnavailable();
    return { ok: true, earnings: result.data };
  });
};