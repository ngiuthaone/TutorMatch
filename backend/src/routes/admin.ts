import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";

const auditLogSchema = z.object({
  action: z.string().trim().min(1).max(200),
  targetType: z.string().trim().min(1).max(100),
  targetId: z.string().uuid().optional(),
  reason: z.string().trim().min(1).max(1000),
  linkedEntityIds: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const searchSchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const auditLogQuerySchema = z.object({
  action: z.string().trim().min(1).max(200).optional(),
  targetType: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const disputesQuerySchema = z.object({
  status: z.string().trim().min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const hostCancellationsQuerySchema = z.object({
  hostId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const adminRoutes: FastifyPluginAsync<{
  authService: AuthService;
  adminService: ReturnType<typeof import("../services/admin-service.js").createAdminService>;
  requireAdmin: (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
  max: number;
  windowMs: number;
}> = async (app, options) => {
  const adminPreHandler = [app.authenticate, options.requireAdmin];

  /** POST /api/v1/admin/audit-log — record an admin action. */
  app.post("/api/v1/admin/audit-log", {
    preHandler: adminPreHandler,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
  }, async (request) => {
    const body = auditLogSchema.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "AUDIT_INVALID", "Action, target type, and reason are required.");
    const result = await options.adminService.logAction(
      body.data.action,
      body.data.targetType,
      body.data.targetId,
      body.data.reason,
      body.data.linkedEntityIds,
      body.data.metadata,
    );
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Admin service is temporarily unavailable.");
    return { ok: true, id: result.data.id };
  });

  /** GET /api/v1/admin/audit-log — search audit log entries. */
  app.get("/api/v1/admin/audit-log", {
    preHandler: adminPreHandler,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
  }, async (request) => {
    const parsed = auditLogQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "SEARCH_INVALID", "Audit log query is invalid.");
    const result = await options.adminService.searchAuditLog(
      parsed.data.action,
      parsed.data.targetType,
      parsed.data.limit,
    );
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Admin service is temporarily unavailable.");
    return { ok: true, entries: result.data };
  });

  /** GET /api/v1/admin/search/users — search users. */
  app.get("/api/v1/admin/search/users", {
    preHandler: adminPreHandler,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
  }, async (request) => {
    const parsed = searchSchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "SEARCH_INVALID", "Search query is required.");
    const result = await options.adminService.searchUsers(parsed.data.q, parsed.data.limit);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Admin service is temporarily unavailable.");
    return { ok: true, users: result.data };
  });

  /** GET /api/v1/admin/disputes — search disputes. */
  app.get("/api/v1/admin/disputes", {
    preHandler: adminPreHandler,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
  }, async (request) => {
    const parsed = disputesQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "SEARCH_INVALID", "Disputes query is invalid.");
    const result = await options.adminService.searchDisputes(
      parsed.data.status,
      parsed.data.limit,
    );
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Admin service is temporarily unavailable.");
    return { ok: true, disputes: result.data };
  });

  /** GET /api/v1/admin/host-cancellations — search host cancellation records. */
  app.get("/api/v1/admin/host-cancellations", {
    preHandler: adminPreHandler,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
  }, async (request) => {
    const parsed = hostCancellationsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "SEARCH_INVALID", "Host cancellations query is invalid.");
    const result = await options.adminService.searchHostCancellations(
      parsed.data.hostId,
      parsed.data.limit,
    );
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Admin service is temporarily unavailable.");
    return { ok: true, records: result.data };
  });
};
