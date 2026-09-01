import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { ThreadService } from "../services/thread-service.js";

const noStore = async (_request: unknown, reply: any, payload: unknown) => { reply.header("Cache-Control", "no-store"); return payload; };

const safeHttpUrl = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) return trimmed.startsWith("//") ? false : true;
  let url: URL;
  try { url = new URL(trimmed); } catch { return false; }
  return url.protocol === "https:";
};

const createThreadSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(2000).nullable().optional(),
  anchorType: z.enum(["course", "event", "workshop", "article", "tutor_profile", "external_url"]),
  anchorId: z.string().uuid().nullable().optional(),
  anchorUrl: z.string().url().max(2048).refine((v) => safeHttpUrl(v), "Anchor URL must be an https:// URL.").nullable().optional(),
  anchorTitle: z.string().max(500).nullable().optional(),
  tags: z.array(z.string().max(50)).max(5).optional(),
  level: z.enum(["complete_beginner", "beginner", "intermediate", "advanced", "all_levels"]).nullable().optional(),
  visibility: z.enum(["public", "community"]).default("public"),
  communityId: z.string().uuid().nullable().optional(),
  replyPermission: z.enum(["everyone", "community_members", "disabled"]).default("everyone"),
});

const replySchema = z.object({
  body: z.string().min(1).max(2000),
  parentId: z.string().uuid().nullable().optional(),
});

const reportSchema = z.object({
  targetType: z.enum(["thread", "reply"]),
  targetId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

const idParamSchema = z.string().uuid();
const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  tag: z.string().max(50).optional(),
  level: z.enum(["complete_beginner", "beginner", "intermediate", "advanced", "all_levels"]).optional(),
  anchorType: z.enum(["course", "event", "workshop", "article", "tutor_profile", "external_url"]).optional(),
});

export const threadRoutes: FastifyPluginAsync<{
  authService: AuthService;
  threadService: ThreadService;
  publishMax: number;
  readMax: number;
  windowMs: number;
}> = async (app, options) => {
  // Public feed (cursor-paginated).
  app.get("/api/v1/threads", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid filter parameters.");
    const q = parsed.data;
    const result = await options.threadService.listPublicThreads(q.cursor ?? null, q.limit ?? 20, q.tag ?? null, q.level ?? null, q.anchorType ?? null);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Threads are temporarily unavailable.");
    return { threads: result.data.threads, nextCursor: result.data.nextCursor };
  });

  // Public thread detail.
  app.get("/api/v1/threads/:id", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const result = await options.threadService.getPublicThread(parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Threads are temporarily unavailable.");
    return result.data;
  });

  // Create thread.
  app.post("/api/v1/threads", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = createThreadSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "THREAD_INVALID", "Thread details are invalid.");
    const body = parsed.data;
    request.log.info({ event: "threads.create.attempt", userId: request.auth?.userId }, "thread create attempted");
    const result = await options.threadService.createThread(request.auth.accessToken, {
      title: body.title,
      body: body.body,
      anchorType: body.anchorType,
      anchorId: body.anchorId,
      anchorUrl: body.anchorUrl,
      anchorTitle: body.anchorTitle,
      tags: body.tags,
      level: body.level,
      visibility: body.visibility,
      communityId: body.communityId,
      replyPermission: body.replyPermission,
    });
    if (result.status === "invalid") {
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email before posting.");
      throw new ApiError(400, result.code, "Thread details are invalid.");
    }
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You are not allowed to create a thread.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Threads are temporarily unavailable.");
    request.log.info({ event: "threads.create.success", threadId: result.data.id, userId: request.auth?.userId }, "thread created");
    return { id: result.data.id, status: result.data.status };
  });

  // Reply to thread.
  app.post("/api/v1/threads/:id/replies", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const bodyParsed = replySchema.safeParse(request.body);
    if (!bodyParsed.success) throw new ApiError(400, "REPLY_INVALID", "Reply body is invalid.");
    const result = await options.threadService.reply(request.auth.accessToken, idParsed.data, bodyParsed.data.body, bodyParsed.data.parentId ?? null);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread or parent reply not found.");
    if (result.status === "invalid") {
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email before posting.");
      if (result.code === "THREAD_CLOSED") throw new ApiError(409, "THREAD_CLOSED", "This thread is closed.");
      if (result.code === "REPLIES_DISABLED") throw new ApiError(409, "REPLIES_DISABLED", "Replies are disabled for this thread.");
      if (result.code === "DEPTH_EXCEEDED") throw new ApiError(409, "DEPTH_EXCEEDED", "Maximum reply depth reached.");
      throw new ApiError(400, result.code, "Reply is invalid.");
    }
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You are not allowed to reply.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Threads are temporarily unavailable.");
    return { id: result.data.id, depth: result.data.depth, status: result.data.status };
  });

  // Appreciate thread.
  app.post("/api/v1/threads/:id/appreciate", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const result = await options.threadService.appreciate(request.auth.accessToken, "thread", idParsed.data);
    if (result.status === "invalid") throw new ApiError(400, "INVALID_TARGET", "Invalid appreciation target.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Threads are temporarily unavailable.");
    return result.data;
  });

  // Unappreciate thread.
  app.delete("/api/v1/threads/:id/appreciate", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const result = await options.threadService.unappreciate(request.auth.accessToken, "thread", idParsed.data);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Threads are temporarily unavailable.");
    return result.data;
  });

  // Close thread (owner).
  app.patch("/api/v1/threads/:id/close", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const result = await options.threadService.closeThread(request.auth.accessToken, idParsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only the thread creator can close it.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Threads are temporarily unavailable.");
    return result.data;
  });

  // Reopen thread (owner).
  app.patch("/api/v1/threads/:id/reopen", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const result = await options.threadService.reopenThread(request.auth.accessToken, idParsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only the thread creator can reopen it.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Threads are temporarily unavailable.");
    return result.data;
  });

  // Delete thread (owner, soft-delete).
  app.delete("/api/v1/threads/:id", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const result = await options.threadService.deleteThread(request.auth.accessToken, idParsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only the thread creator can delete it.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Threads are temporarily unavailable.");
    return result.data;
  });

  // Delete reply (owner, soft-delete).
  app.delete("/api/v1/threads/replies/:id", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Reply not found.");
    const result = await options.threadService.deleteReply(request.auth.accessToken, idParsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Reply not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only the reply author can delete it.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Threads are temporarily unavailable.");
    return result.data;
  });

  // Report thread/reply content.
  app.post("/api/v1/threads/report", { preHandler: app.authenticate, config: { rateLimit: { max: Math.min(options.publishMax, 5), timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = reportSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "REPORT_INVALID", "Report details are invalid.");
    const body = parsed.data;
    const result = await options.threadService.report(request.auth.accessToken, body.targetType, body.targetId, body.reason);
    if (result.status === "invalid") throw new ApiError(400, "REPORT_INVALID", "Report details are invalid.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Reporting is temporarily unavailable.");
    return { id: result.data.id, status: result.data.status };
  });
};
