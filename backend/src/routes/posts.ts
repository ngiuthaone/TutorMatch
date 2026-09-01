import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { PostService } from "../services/post-service.js";

const noStore = async (_request: unknown, reply: any, payload: unknown) => { reply.header("Cache-Control", "no-store"); return payload; };

const createPostSchema = z.object({
  body: z.string().min(1).max(5000),
  tags: z.array(z.string()).max(5).optional(),
  level: z.string().optional().nullable(),
  postType: z.enum(["insight", "question", "tip", "tutorial", "experience", "project", "discussion"]).optional().nullable(),
  replyPermission: z.enum(["everyone", "community_members", "disabled"]).optional(),
  communityId: z.string().uuid().optional().nullable(),
});

const updatePostSchema = z.object({
  body: z.string().min(1).max(5000).optional(),
  tags: z.array(z.string()).max(5).optional(),
  level: z.string().optional().nullable(),
  postType: z.enum(["insight", "question", "tip", "tutorial", "experience", "project", "discussion"]).optional().nullable(),
  replyPermission: z.enum(["everyone", "community_members", "disabled"]).optional(),
});

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  tag: z.string().optional(),
  postType: z.string().optional(),
  authorName: z.string().optional(),
});

const idParamSchema = z.string().uuid();

export const postRoutes: FastifyPluginAsync<{
  authService: AuthService;
  postService: PostService;
  publishMax: number;
  readMax: number;
  windowMs: number;
}> = async (app, options) => {
  // Public post list.
  app.get("/api/v1/posts", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid post query parameters.");
    const q = parsed.data;
    const result = await options.postService.listPublic(q.cursor ?? null, q.limit ?? 20, q.tag ?? null, q.postType ?? null, q.authorName ?? null);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Posts are temporarily unavailable.");
    return { posts: result.data.posts, nextCursor: result.data.nextCursor };
  });

  // Public post detail.
  app.get("/api/v1/posts/:id", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Post not found.");
    const result = await options.postService.getPublic(parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Post not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Post is temporarily unavailable.");
    return result.data;
  });

  // Create post.
  app.post("/api/v1/posts", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = createPostSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_BODY", "Post details are invalid.");
    const result = await options.postService.create(request.auth.accessToken, {
      body: parsed.data.body,
      tags: parsed.data.tags ?? [],
      level: parsed.data.level ?? null,
      postType: parsed.data.postType ?? null,
      replyPermission: parsed.data.replyPermission ?? "everyone",
      communityId: parsed.data.communityId ?? null,
    });
    if (result.status === "invalid") {
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email before posting.");
      throw new ApiError(400, result.code, "Post is invalid.");
    }
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You are not allowed to post.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Posting is temporarily unavailable.");
    return result.data;
  });

  // Update post.
  app.patch("/api/v1/posts/:id", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Post not found.");
    const bodyParsed = updatePostSchema.safeParse(request.body);
    if (!bodyParsed.success) throw new ApiError(400, "INVALID_BODY", "Post update is invalid.");
    const updateInput: { body?: string; tags?: string[]; level?: string | null; postType?: string | null; replyPermission?: string | null } = {};
    if (bodyParsed.data.body !== undefined) updateInput.body = bodyParsed.data.body;
    if (bodyParsed.data.tags !== undefined) updateInput.tags = bodyParsed.data.tags;
    if (bodyParsed.data.level !== undefined) updateInput.level = bodyParsed.data.level;
    if (bodyParsed.data.postType !== undefined) updateInput.postType = bodyParsed.data.postType;
    if (bodyParsed.data.replyPermission !== undefined) updateInput.replyPermission = bodyParsed.data.replyPermission;
    const result = await options.postService.update(request.auth.accessToken, idParsed.data, updateInput);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Post not found.");
    if (result.status === "invalid") {
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email before posting.");
      throw new ApiError(400, result.code, "Post update is invalid.");
    }
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only the author can edit this post.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Update is temporarily unavailable.");
    return result.data;
  });

  // Delete post (owner, soft-delete).
  app.delete("/api/v1/posts/:id", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Post not found.");
    const result = await options.postService.delete(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Post not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only the author can delete this post.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Delete is temporarily unavailable.");
    return result.data;
  });

  // Repost post.
  app.post("/api/v1/posts/:id/repost", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Post not found.");
    const result = await options.postService.repost(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Post not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Repost is temporarily unavailable.");
    return result.data;
  });

  // Unrepost post.
  app.delete("/api/v1/posts/:id/repost", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Post not found.");
    const result = await options.postService.unrepost(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Post not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Unrepost is temporarily unavailable.");
    return result.data;
  });

  // Like post.
  app.post("/api/v1/posts/:id/like", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Post not found.");
    const result = await options.postService.like(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Post not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Like is temporarily unavailable.");
    return result.data;
  });

  // Unlike post.
  app.delete("/api/v1/posts/:id/like", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Post not found.");
    const result = await options.postService.unlike(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Post not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Unlike is temporarily unavailable.");
    return result.data;
  });

  // My posts.
  app.get("/api/v1/posts/mine", { preHandler: app.authenticate, config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const result = await options.postService.listMyPosts(request.auth.accessToken);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Posts are temporarily unavailable.");
    return result.data;
  });
};
