import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { FollowService } from "../services/follow-service.js";

const noStore = async (_request: unknown, reply: any, payload: unknown) => { reply.header("Cache-Control", "no-store"); return payload; };

const userNameParam = z.string().trim().min(1).max(128);

export const followRoutes: FastifyPluginAsync<{
  authService: AuthService;
  followService: FollowService;
  publishMax: number;
  readMax: number;
  windowMs: number;
}> = async (app, options) => {
  // Check if following a user.
  app.get("/api/v1/users/:name/following", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = userNameParam.safeParse((request.params as { name?: string }).name ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "User not found.");
    const result = await options.followService.isFollowing(parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "User not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Service temporarily unavailable.");
    return result.data;
  });

  // Follow a user.
  app.post("/api/v1/users/:name/follow", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = userNameParam.safeParse((request.params as { name?: string }).name ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "User not found.");
    const result = await options.followService.follow(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "User not found.");
    if (result.status === "invalid") {
      if (result.code === "CANNOT_FOLLOW_SELF") throw new ApiError(400, "CANNOT_FOLLOW_SELF", "You cannot follow yourself.");
      throw new ApiError(400, result.code, "Invalid follow request.");
    }
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Follow is temporarily unavailable.");
    return result.data;
  });

  // Unfollow a user.
  app.delete("/api/v1/users/:name/follow", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = userNameParam.safeParse((request.params as { name?: string }).name ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "User not found.");
    const result = await options.followService.unfollow(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "User not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Unfollow is temporarily unavailable.");
    return result.data;
  });

  // List followers.
  app.get("/api/v1/users/:name/followers", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = userNameParam.safeParse((request.params as { name?: string }).name ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "User not found.");
    const result = await options.followService.listFollowers(parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "User not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Service temporarily unavailable.");
    return { followers: result.data.users };
  });

  // List following.
  app.get("/api/v1/users/:name/following-list", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = userNameParam.safeParse((request.params as { name?: string }).name ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "User not found.");
    const result = await options.followService.listFollowing(parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "User not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Service temporarily unavailable.");
    return { following: result.data.users };
  });
};
