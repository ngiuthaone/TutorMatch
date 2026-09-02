import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { ModerationService } from "../services/moderation-service.js";

const noStore = async (_request: unknown, reply: any, payload: unknown) => { reply.header("Cache-Control", "no-store"); return payload; };

const idParamSchema = z.string().uuid();
const removeBodySchema = z.object({ reason: z.string().max(500).optional() });

export const moderationRoutes: FastifyPluginAsync<{
  authService: AuthService;
  moderationService: ModerationService;
  publishMax: number;
  windowMs: number;
}> = async (app, options) => {
  // Post moderation
  app.post("/api/v1/posts/:id/pin", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Post not found.");
    const result = await options.moderationService.pinPost(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Post not found or not in a community.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only community moderators can pin posts.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Pin is temporarily unavailable.");
    return result.data;
  });

  app.delete("/api/v1/posts/:id/pin", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Post not found.");
    const result = await options.moderationService.unpinPost(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Post not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only community moderators can unpin posts.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Unpin is temporarily unavailable.");
    return result.data;
  });

  app.post("/api/v1/posts/:id/lock", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Post not found.");
    const result = await options.moderationService.lockPost(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Post not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only community moderators can lock posts.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Lock is temporarily unavailable.");
    return result.data;
  });

  app.delete("/api/v1/posts/:id/lock", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Post not found.");
    const result = await options.moderationService.unlockPost(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Post not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only community moderators can unlock posts.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Unlock is temporarily unavailable.");
    return result.data;
  });

  app.post("/api/v1/posts/:id/remove", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Post not found.");
    const body = removeBodySchema.safeParse(request.body ?? {});
    const reason = body.success ? body.data.reason : undefined;
    const result = await options.moderationService.removePost(request.auth.accessToken, parsed.data, reason);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Post not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only community moderators can remove posts.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Remove is temporarily unavailable.");
    return result.data;
  });

  app.post("/api/v1/posts/:id/restore", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Post not found.");
    const result = await options.moderationService.restorePost(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Post not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only community moderators can restore posts.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Restore is temporarily unavailable.");
    return result.data;
  });

  // Thread moderation
  app.post("/api/v1/threads/:id/pin", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const result = await options.moderationService.pinThread(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only community moderators can pin threads.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Pin is temporarily unavailable.");
    return result.data;
  });

  app.delete("/api/v1/threads/:id/pin", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const result = await options.moderationService.unpinThread(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only community moderators can unpin threads.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Unpin is temporarily unavailable.");
    return result.data;
  });

  app.post("/api/v1/threads/:id/lock", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const result = await options.moderationService.lockThread(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only community moderators can lock threads.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Lock is temporarily unavailable.");
    return result.data;
  });

  app.delete("/api/v1/threads/:id/lock", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const result = await options.moderationService.unlockThread(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only community moderators can unlock threads.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Unlock is temporarily unavailable.");
    return result.data;
  });

  app.post("/api/v1/threads/:id/remove", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const body = removeBodySchema.safeParse(request.body ?? {});
    const reason = body.success ? body.data.reason : undefined;
    const result = await options.moderationService.removeThread(request.auth.accessToken, parsed.data, reason);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only community moderators can remove threads.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Remove is temporarily unavailable.");
    return result.data;
  });

  app.post("/api/v1/threads/:id/restore", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    const result = await options.moderationService.restoreThread(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only community moderators can restore threads.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Restore is temporarily unavailable.");
    return result.data;
  });
};
