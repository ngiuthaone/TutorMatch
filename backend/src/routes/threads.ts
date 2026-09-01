import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import { isSafeHttpUrl } from "../lib/sanitize.js";
import type { AuthService } from "../services/auth-service.js";
import type { ThreadService } from "../services/thread-service.js";

const noStore = async (_request: unknown, reply: any, payload: unknown) => { reply.header("Cache-Control", "no-store"); return payload; };

const idParamSchema = z.string().uuid();
const replyIdParamSchema = z.string().uuid();

const createThreadSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(2000).optional(),
  anchorType: z.enum(["course", "event", "workshop", "article", "tutor_profile", "external_url"]),
  anchorId: z.string().uuid().optional(),
  anchorUrl: z.string().max(2048).refine((v) => isSafeHttpUrl(v), { message: "INVALID_URL" }).optional(),
  anchorTitle: z.string().max(500).optional(),
  anchorDomain: z.string().max(255).optional(),
  tags: z.array(z.string().max(50)).max(5).optional(),
  level: z.enum(["complete_beginner", "beginner", "intermediate", "advanced", "all_levels"]).optional(),
  visibility: z.enum(["public", "community"]).default("public"),
  communityId: z.string().uuid().optional(),
  replyPermission: z.enum(["everyone", "community_members", "disabled"]).default("everyone"),
});

const replySchema = z.object({
  body: z.string().min(1).max(2000),
  parentId: z.string().uuid().optional(),
});

const reportSchema = z.object({
  targetType: z.enum(["thread", "reply", "comment"]),
  targetId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

const appreciateSchema = z.object({
  targetType: z.enum(["thread", "reply"]),
  targetId: z.string().uuid(),
});

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  tag: z.string().optional(),
  level: z.string().optional(),
  anchorType: z.string().optional(),
});

export const threadRoutes: FastifyPluginAsync<{
  authService: AuthService;
  threadService: ThreadService;
  publishMax: number;
  readMax: number;
  windowMs: number;
}> = async (app, options) => {
  // List threads (public)
  app.get("/api/v1/threads", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid thread query parameters.");
    const q = parsed.data;
    const result = await options.threadService.listPublic(q.cursor ?? null, q.limit ?? 20, q.tag ?? null, q.level ?? null, q.anchorType ?? null);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Threads are temporarily unavailable.");
    return { threads: result.data.threads, nextCursor: result.data.nextCursor };
  });

  // Get thread detail (public)
  app.get("/api/v1/threads/:id", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const result = await options.threadService.getPublic(parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Thread is temporarily unavailable.");
    return result.data;
  });

  // Get thread replies (public)
  app.get("/api/v1/threads/:id/replies", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const result = await options.threadService.listReplies(parsed.data);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Replies are temporarily unavailable.");
    return result.data;
  });

  // Create thread
  app.post("/api/v1/threads", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = createThreadSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_BODY", "Thread details are invalid.");
    const result = await options.threadService.create(request.auth.accessToken, {
      title: parsed.data.title,
      body: parsed.data.body ?? null,
      anchorType: parsed.data.anchorType,
      anchorId: parsed.data.anchorId ?? null,
      anchorUrl: parsed.data.anchorUrl ?? null,
      anchorTitle: parsed.data.anchorTitle ?? null,
      anchorDomain: parsed.data.anchorDomain ?? null,
      tags: parsed.data.tags ?? [],
      level: parsed.data.level ?? null,
      visibility: parsed.data.visibility,
      communityId: parsed.data.communityId ?? null,
      replyPermission: parsed.data.replyPermission,
    });
    if (result.status === "invalid") {
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email before posting.");
      throw new ApiError(400, result.code, "Thread is invalid.");
    }
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You are not allowed to create threads.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Thread creation is temporarily unavailable.");
    return result.data;
  });

  // Reply to thread
  app.post("/api/v1/threads/:id/replies", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const bodyParsed = replySchema.safeParse(request.body);
    if (!bodyParsed.success) throw new ApiError(400, "INVALID_BODY", "Reply is invalid.");
    const result = await options.threadService.reply(request.auth.accessToken, idParsed.data, bodyParsed.data.body, bodyParsed.data.parentId ?? null);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    if (result.status === "invalid") {
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email before replying.");
      if (result.code === "THREAD_CLOSED") throw new ApiError(409, "THREAD_CLOSED", "This thread is closed for new replies.");
      if (result.code === "REPLIES_DISABLED") throw new ApiError(403, "REPLIES_DISABLED", "Replies are disabled for this thread.");
      if (result.code === "DEPTH_EXCEEDED") throw new ApiError(409, "DEPTH_EXCEEDED", "Maximum reply depth reached.");
      throw new ApiError(400, result.code, "Reply is invalid.");
    }
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You are not allowed to reply.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Reply is temporarily unavailable.");
    return result.data;
  });

  // Appreciate thread or reply
  app.post("/api/v1/threads/appreciate", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = appreciateSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_BODY", "Appreciation request is invalid.");
    const result = await options.threadService.appreciate(request.auth.accessToken, parsed.data.targetType, parsed.data.targetId);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Content not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Appreciation is temporarily unavailable.");
    return result.data;
  });

  // Unappreciate
  app.delete("/api/v1/threads/appreciate", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = appreciateSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_BODY", "Appreciation request is invalid.");
    const result = await options.threadService.unappreciate(request.auth.accessToken, parsed.data.targetType, parsed.data.targetId);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Unappreciation is temporarily unavailable.");
    return result.data;
  });

  // Close thread (owner)
  app.patch("/api/v1/threads/:id/close", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const result = await options.threadService.close(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only the thread creator can close it.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Close is temporarily unavailable.");
    return result.data;
  });

  // Reopen thread (owner)
  app.patch("/api/v1/threads/:id/reopen", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const result = await options.threadService.reopen(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only the thread creator can reopen it.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Reopen is temporarily unavailable.");
    return result.data;
  });

  // Delete thread (owner)
  app.delete("/api/v1/threads/:id", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const result = await options.threadService.deleteThread(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only the thread creator can delete it.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Delete is temporarily unavailable.");
    return result.data;
  });

  // Delete reply (owner)
  app.delete("/api/v1/threads/replies/:id", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = replyIdParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Reply not found.");
    const result = await options.threadService.deleteReply(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Reply not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only the reply author can delete it.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Delete is temporarily unavailable.");
    return result.data;
  });

  // Report content
  app.post("/api/v1/threads/report", { preHandler: app.authenticate, config: { rateLimit: { max: 5, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = reportSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_BODY", "Report is invalid.");
    const result = await options.threadService.report(request.auth.accessToken, parsed.data.targetType, parsed.data.targetId, parsed.data.reason);
    if (result.status === "invalid") {
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email before reporting.");
      throw new ApiError(400, result.code, "Report is invalid.");
    }
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Reporting is temporarily unavailable.");
    return result.data;
  });
};
