import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { CommunityService } from "../services/community-service.js";

const noStore = async (_request: unknown, reply: any, payload: unknown) => { reply.header("Cache-Control", "no-store"); return payload; };

const slugOrIdParam = z.string().min(1).max(128);
const communityIdParam = z.string().uuid();
const userIdParam = z.string().uuid();

const createCommunitySchema = z.object({
  slug: z.string().min(2).max(60),
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["public", "private"]).default("public"),
  joinPolicy: z.enum(["open", "request", "invite"]).default("open"),
});

const updateCommunitySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["public", "private"]).optional(),
  joinPolicy: z.enum(["open", "request", "invite"]).optional(),
});

const setRoleSchema = z.object({ role: z.enum(["member", "moderator"]) });
const banSchema = z.object({ reason: z.string().max(500).optional() });

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  q: z.string().max(100).optional(),
});

const memberListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const communityRoutes: FastifyPluginAsync<{
  authService: AuthService;
  communityService: CommunityService;
  publishMax: number;
  readMax: number;
  windowMs: number;
}> = async (app, options) => {
  // List communities (public)
  app.get("/api/v1/communities", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid community query.");
    const result = await options.communityService.listPublic(parsed.data.cursor ?? null, parsed.data.limit ?? 20, parsed.data.q ?? null);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Communities are temporarily unavailable.");
    return { communities: result.data.communities, nextCursor: result.data.nextCursor };
  });

  // Get community by slug or id (public for public, auth for private)
  app.get("/api/v1/communities/:slugOrId", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = slugOrIdParam.safeParse((request.params as { slugOrId?: string }).slugOrId ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Community not found.");
    const result = await options.communityService.getPublic(parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Community not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Community is temporarily unavailable.");
    return result.data;
  });

  // List community members
  app.get("/api/v1/communities/:id/members", { preHandler: app.authenticate, config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = communityIdParam.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Community not found.");
    const qParsed = memberListQuerySchema.safeParse(request.query);
    if (!qParsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid query.");
    const result = await options.communityService.listMembers(parsed.data, qParsed.data.cursor ?? null, qParsed.data.limit ?? 30);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Members are temporarily unavailable.");
    return { members: result.data.members, nextCursor: result.data.nextCursor };
  });

  // Create community
  app.post("/api/v1/communities", { preHandler: app.authenticate, config: { rateLimit: { max: 5, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = createCommunitySchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_BODY", "Community details are invalid.");
    const result = await options.communityService.create(request.auth.accessToken, {
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      visibility: parsed.data.visibility,
      joinPolicy: parsed.data.joinPolicy,
    });
    if (result.status === "invalid") {
      if (result.code === "SLUG_TAKEN") throw new ApiError(409, "SLUG_TAKEN", "This URL slug is already in use.");
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email first.");
      throw new ApiError(400, result.code, "Community details are invalid.");
    }
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Not allowed.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Community creation is temporarily unavailable.");
    return result.data;
  });

  // Update community
  app.patch("/api/v1/communities/:id", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = communityIdParam.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Community not found.");
    const bodyParsed = updateCommunitySchema.safeParse(request.body);
    if (!bodyParsed.success) throw new ApiError(400, "INVALID_BODY", "Update is invalid.");
    const result = await options.communityService.update(request.auth.accessToken, idParsed.data, bodyParsed.data);
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only moderators can update the community.");
    if (result.status === "invalid") {
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email first.");
      throw new ApiError(400, result.code, "Update is invalid.");
    }
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Update is temporarily unavailable.");
    return result.data;
  });

  // Archive community (owner only)
  app.post("/api/v1/communities/:id/archive", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = communityIdParam.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Community not found.");
    const result = await options.communityService.archive(request.auth.accessToken, parsed.data);
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only the owner can archive.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Archive is temporarily unavailable.");
    return result.data;
  });

  // Join community
  app.post("/api/v1/communities/:id/join", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = communityIdParam.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Community not found.");
    const result = await options.communityService.join(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Community not found.");
    if (result.status === "invalid") {
      if (result.code === "JOIN_NOT_OPEN") throw new ApiError(409, "JOIN_NOT_OPEN", "This community requires approval to join.");
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email first.");
      throw new ApiError(400, result.code, "Join failed.");
    }
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Join is temporarily unavailable.");
    return result.data;
  });

  // Request to join
  app.post("/api/v1/communities/:id/request-join", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = communityIdParam.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Community not found.");
    const result = await options.communityService.requestJoin(request.auth.accessToken, parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Community not found.");
    if (result.status === "invalid") {
      if (result.code === "JOIN_NOT_REQUEST") throw new ApiError(409, "JOIN_NOT_REQUEST", "This community doesn't accept join requests.");
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email first.");
      throw new ApiError(400, result.code, "Request failed.");
    }
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Request is temporarily unavailable.");
    return result.data;
  });

  // Leave community
  app.delete("/api/v1/communities/:id/members/me", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = communityIdParam.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Community not found.");
    const result = await options.communityService.leave(request.auth.accessToken, parsed.data);
    if (result.status === "invalid") {
      if (result.code === "OWNER_CANNOT_LEAVE") throw new ApiError(409, "OWNER_CANNOT_LEAVE", "The owner cannot leave. Archive the community instead.");
      if (result.code === "NOT_MEMBER") throw new ApiError(404, "NOT_MEMBER", "You are not a member of this community.");
      throw new ApiError(400, result.code, "Leave failed.");
    }
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Not allowed.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Leave is temporarily unavailable.");
    return result.data;
  });

  // Approve a pending member (mod/owner)
  app.post("/api/v1/communities/:id/members/:userId/approve", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = communityIdParam.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Community not found.");
    const userParsed = userIdParam.safeParse((request.params as { userId?: string }).userId ?? "");
    if (!userParsed.success) throw new ApiError(404, "NOT_FOUND", "User not found.");
    const result = await options.communityService.approveMember(request.auth.accessToken, idParsed.data, userParsed.data);
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only moderators can approve members.");
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "No pending request found.");
    if (result.status === "invalid") {
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email first.");
      throw new ApiError(400, result.code, "Approval failed.");
    }
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Approval is temporarily unavailable.");
    return result.data;
  });

  // Set member role (owner only)
  app.patch("/api/v1/communities/:id/members/:userId/role", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = communityIdParam.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Community not found.");
    const userParsed = userIdParam.safeParse((request.params as { userId?: string }).userId ?? "");
    if (!userParsed.success) throw new ApiError(404, "NOT_FOUND", "User not found.");
    const bodyParsed = setRoleSchema.safeParse(request.body);
    if (!bodyParsed.success) throw new ApiError(400, "INVALID_BODY", "Role is invalid.");
    const result = await options.communityService.setMemberRole(request.auth.accessToken, idParsed.data, userParsed.data, bodyParsed.data.role);
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only the owner can change roles.");
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "User is not a member.");
    if (result.status === "invalid") {
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email first.");
      throw new ApiError(400, result.code, "Role change failed.");
    }
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Role change is temporarily unavailable.");
    return result.data;
  });

  // Ban a member (mod/owner)
  app.post("/api/v1/communities/:id/members/:userId/ban", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = communityIdParam.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Community not found.");
    const userParsed = userIdParam.safeParse((request.params as { userId?: string }).userId ?? "");
    if (!userParsed.success) throw new ApiError(404, "NOT_FOUND", "User not found.");
    const bodyParsed = banSchema.safeParse(request.body ?? {});
    if (!bodyParsed.success) throw new ApiError(400, "INVALID_BODY", "Ban reason is invalid.");
    const result = await options.communityService.banMember(request.auth.accessToken, idParsed.data, userParsed.data, bodyParsed.data.reason);
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "Only moderators can ban members.");
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "User is not a member.");
    if (result.status === "invalid") {
      if (result.code === "CANNOT_BAN_OWNER") throw new ApiError(409, "CANNOT_BAN_OWNER", "Cannot ban the owner.");
      if (result.code === "CANNOT_BAN_SELF") throw new ApiError(400, "CANNOT_BAN_SELF", "Cannot ban yourself.");
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email first.");
      throw new ApiError(400, result.code, "Ban failed.");
    }
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Ban is temporarily unavailable.");
    return result.data;
  });
};
