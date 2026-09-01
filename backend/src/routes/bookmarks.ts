import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { BookmarkService, ReportService } from "../services/bookmark-service.js";

const noStore = async (_request: unknown, reply: any, payload: unknown) => { reply.header("Cache-Control", "no-store"); return payload; };

const targetTypeSchema = z.enum(["post", "article", "thread"]);
const targetIdSchema = z.string().uuid();
const reportTargetTypeSchema = z.enum(["post", "article"]);

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const reportSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: targetIdSchema,
  reason: z.string().min(1).max(500),
});

export const bookmarkRoutes: FastifyPluginAsync<{
  authService: AuthService;
  bookmarkService: BookmarkService;
  reportService: ReportService;
  readMax: number;
  publishMax: number;
  windowMs: number;
}> = async (app, options) => {
  // List bookmarks
  app.get("/api/v1/bookmarks", { preHandler: app.authenticate, config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid query.");
    const result = await options.bookmarkService.list(request.auth.accessToken, parsed.data.cursor ?? null, parsed.data.limit ?? 30);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Bookmarks are temporarily unavailable.");
    return { bookmarks: result.data.bookmarks, nextCursor: result.data.nextCursor };
  });

  // Add bookmark
  app.post("/api/v1/bookmarks", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const body = request.body as { targetType?: string; targetId?: string } | undefined;
    const tParsed = targetTypeSchema.safeParse(body?.targetType ?? "");
    if (!tParsed.success) throw new ApiError(400, "INVALID_TARGET_TYPE", "Target type is invalid.");
    const idParsed = targetIdSchema.safeParse(body?.targetId ?? "");
    if (!idParsed.success) throw new ApiError(400, "INVALID_TARGET_ID", "Target id is invalid.");
    const result = await options.bookmarkService.add(request.auth.accessToken, tParsed.data, idParsed.data);
    if (result.status === "invalid") {
      if (result.code === "INVALID_TARGET_TYPE") throw new ApiError(400, "INVALID_TARGET_TYPE", "Target type is invalid.");
      throw new ApiError(400, result.code, "Bookmark failed.");
    }
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Bookmark is temporarily unavailable.");
    return result.data;
  });

  // Remove bookmark
  app.delete("/api/v1/bookmarks", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const body = request.body as { targetType?: string; targetId?: string } | undefined;
    const tParsed = targetTypeSchema.safeParse(body?.targetType ?? "");
    if (!tParsed.success) throw new ApiError(400, "INVALID_TARGET_TYPE", "Target type is invalid.");
    const idParsed = targetIdSchema.safeParse(body?.targetId ?? "");
    if (!idParsed.success) throw new ApiError(400, "INVALID_TARGET_ID", "Target id is invalid.");
    const result = await options.bookmarkService.remove(request.auth.accessToken, tParsed.data, idParsed.data);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Remove is temporarily unavailable.");
    return result.data;
  });

  // Report content (post or article)
  app.post("/api/v1/reports", { preHandler: app.authenticate, config: { rateLimit: { max: 5, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = reportSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_BODY", "Report is invalid.");
    const result = parsed.data.targetType === "post"
      ? await options.reportService.reportPost(request.auth.accessToken, parsed.data.targetId, parsed.data.reason)
      : await options.reportService.reportArticle(request.auth.accessToken, parsed.data.targetId, parsed.data.reason);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Content not found.");
    if (result.status === "invalid") {
      if (result.code === "INVALID_REASON") throw new ApiError(400, "INVALID_REASON", "Reason is required.");
      throw new ApiError(400, result.code, "Report failed.");
    }
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Reporting is temporarily unavailable.");
    return result.data;
  });
};
