import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AdminService } from "../services/admin-service.js";

const listQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "removed", "all"]).default("pending"),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

const decideSchema = z.object({
  decision: z.enum(["approved", "rejected", "removed"]),
  note: z.string().trim().max(1000).optional(),
});

const idParamSchema = z.object({ id: z.string().uuid() });

/**
 * Admin moderation routes for tutor media submissions.
 * Admin-only; pairs with the existing [app.authenticate, requireAdmin] gate
 * and delegates decisions to the security-definer `moderate_tutor_media` RPC
 * so a plain tutor cannot self-approve.
 */
export const adminModerationRoutes: FastifyPluginAsync<{
  adminService: AdminService;
  requireAdmin: (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
  max: number;
  windowMs: number;
}> = async (app, options) => {
  const preHandler = [app.authenticate, options.requireAdmin];

  /** GET /api/v1/admin/moderation/media — list submissions. */
  app.get("/api/v1/admin/moderation/media", {
    preHandler,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
  }, async (request) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "MODERATION_QUERY_INVALID", "Moderation query is invalid.");
    const result = await options.adminService.listMediaSubmissions(parsed.data.status, parsed.data.limit);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Moderation service is temporarily unavailable.");
    return { ok: true, submissions: result.data };
  });

  /** POST /api/v1/admin/moderation/media/:id/decide — approve/reject/remove. */
  app.post("/api/v1/admin/moderation/media/:id/decide", {
    preHandler,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
  }, async (request) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) throw new ApiError(400, "MODERATION_ID_INVALID", "Submission id is not a valid uuid.");
    const body = decideSchema.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "MODERATION_DECISION_INVALID", "Decision must be approved, rejected, or removed.");
    const result = await options.adminService.decideMediaSubmission(
      params.data.id,
      body.data.decision,
      body.data.note ?? null,
    );
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Moderation service is temporarily unavailable.");
    const logResult = await options.adminService.logAction(
      `media.${body.data.decision}`,
      "media_submission",
      params.data.id,
      body.data.note ?? `Admin ${body.data.decision}`,
      undefined,
      undefined,
    );
    return { ok: true, decision: result.data, audited: logResult.status === "ok" };
  });

  /** GET /api/v1/admin/moderation/reports — list conversation reports. */
  app.get("/api/v1/admin/moderation/reports", {
    preHandler,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
  }, async (request) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "MODERATION_QUERY_INVALID", "Reports query is invalid.");
    const result = await options.adminService.listConversationReports(parsed.data.status === "approved" || parsed.data.status === "rejected" || parsed.data.status === "removed" ? "all" : (parsed.data.status === "all" ? "all" : parsed.data.status === "pending" ? "pending" : "all") as "pending" | "resolved" | "dismissed" | "all", parsed.data.limit);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Moderation service is temporarily unavailable.");
    return { ok: true, reports: result.data };
  });

  /** POST /api/v1/admin/moderation/reports/:id/resolve — mark resolved or dismissed. */
  app.post("/api/v1/admin/moderation/reports/:id/resolve", {
    preHandler,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
  }, async (request) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) throw new ApiError(400, "MODERATION_ID_INVALID", "Report id is not a valid uuid.");
    const body = z.object({
      status: z.enum(["resolved", "dismissed"]),
      details: z.string().trim().max(2000).optional(),
    }).safeParse(request.body);
    if (!body.success) throw new ApiError(400, "MODERATION_DECISION_INVALID", "Status must be resolved or dismissed.");
    const result = await options.adminService.resolveConversationReport(
      params.data.id,
      body.data.status,
      body.data.details ?? null,
    );
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Moderation service is temporarily unavailable.");
    const logResult = await options.adminService.logAction(
      `conversation_report.${body.data.status}`,
      "conversation_report",
      params.data.id,
      body.data.details ?? `Admin ${body.data.status}`,
      undefined,
      undefined,
    );
    return { ok: true, decision: result.data, audited: logResult.status === "ok" };
  });
};
