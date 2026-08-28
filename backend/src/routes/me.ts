import type { FastifyPluginAsync } from "fastify";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";

export const meRoutes: FastifyPluginAsync<{ authService: AuthService; max: number; windowMs: number }> = async (app, options) => {
  app.get("/api/v1/me", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: async (_request, reply, payload) => { reply.header("Cache-Control", "no-store").header("Pragma", "no-cache"); return payload; }
  }, async (request) => {
    const result = await options.authService.getOwnProfile(request.auth.accessToken, request.auth.userId);
    if (result.status === "not_found") throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile was not found.");
    if (result.status === "unavailable") throw new ApiError(503, "PROFILE_SERVICE_UNAVAILABLE", "Profile service is temporarily unavailable.");
    if (result.status === "invalid_data" || result.profile.id !== request.auth.userId) throw new ApiError(500, "INTERNAL_ERROR", "An internal error occurred.");
    const profile = result.profile;
    return { ok: true, user: {
      id: profile.id, email: request.auth.email, role: profile.role, name: profile.name, phone: profile.phone,
      avatarUrl: profile.avatar_url, createdAt: profile.created_at, updatedAt: profile.updated_at
    } };
  });
};
