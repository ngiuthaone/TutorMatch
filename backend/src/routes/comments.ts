import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { CommentService } from "../services/comment-service.js";

const noStore = async (_request: unknown, reply: any, payload: unknown) => { reply.header("Cache-Control", "no-store"); return payload; };

const createCommentSchema = z.object({
  ownerType: z.enum(["thread", "article"]),
  ownerId: z.string().uuid(),
  body: z.string().min(1).max(2000),
  parentId: z.string().uuid().nullable().optional(),
});

const idParamSchema = z.string().uuid();
const listQuerySchema = z.object({
  ownerType: z.enum(["thread", "article"]),
  ownerId: z.string().uuid(),
});

export const commentRoutes: FastifyPluginAsync<{
  authService: AuthService;
  commentService: CommentService;
  publishMax: number;
  readMax: number;
  windowMs: number;
}> = async (app, options) => {
  // Public comment list for an owner (thread or article).
  app.get("/api/v1/comments", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid comment query parameters.");
    const q = parsed.data;
    const result = await options.commentService.listPublic(q.ownerType, q.ownerId);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Comments are temporarily unavailable.");
    return result.data;
  });

  // Create comment.
  app.post("/api/v1/comments", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = createCommentSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "COMMENT_INVALID", "Comment details are invalid.");
    const body = parsed.data;
    const result = await options.commentService.create(request.auth.accessToken, {
      ownerType: body.ownerType,
      ownerId: body.ownerId,
      body: body.body,
      parentId: body.parentId ?? null,
    });
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Thread, article, or parent comment not found.");
    if (result.status === "invalid") {
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email before posting.");
      if (result.code === "OWNER_CLOSED") throw new ApiError(409, "OWNER_CLOSED", "This content is closed for comments.");
      if (result.code === "COMMENTS_DISABLED") throw new ApiError(409, "COMMENTS_DISABLED", "Comments are disabled for this content.");
      if (result.code === "DEPTH_EXCEEDED") throw new ApiError(409, "DEPTH_EXCEEDED", "Maximum reply depth reached.");
      throw new ApiError(400, result.code, "Comment is invalid.");
    }
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You are not allowed to comment.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Comments are temporarily unavailable.");
    return { id: result.data.id, depth: result.data.depth, status: result.data.status };
  });

  // Delete comment (creator only, soft-delete).
  app.delete("/api/v1/comments/:id", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Comment not found.");
    const result = await options.commentService.deleteComment(request.auth.accessToken, idParsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Comment not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only the comment author can delete it.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Comments are temporarily unavailable.");
    return result.data;
  });

  // Appreciate comment.
  app.post("/api/v1/comments/:id/appreciate", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Comment not found.");
    const result = await options.commentService.appreciate(request.auth.accessToken, idParsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Comment not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Comments are temporarily unavailable.");
    return result.data;
  });

  // Unappreciate comment.
  app.delete("/api/v1/comments/:id/appreciate", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Comment not found.");
    const result = await options.commentService.unappreciate(request.auth.accessToken, idParsed.data);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Comments are temporarily unavailable.");
    return result.data;
  });
};
