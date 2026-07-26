import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";

const authenticate: FastifyPluginAsync<{ authService: AuthService; maxHeaderLength: number }> = async (app, options) => {
  app.decorateRequest("auth");
  app.decorate("authenticate", async (request) => {
    const header = request.headers.authorization;
    const unauthorized = () => new ApiError(401, "UNAUTHORIZED", "Authentication is required.", { "WWW-Authenticate": "Bearer" });
    const authorizationHeaderCount = request.raw.rawHeaders.filter((value) => value.toLowerCase() === "authorization").length;
    if (authorizationHeaderCount !== 1 || typeof header !== "string" || header.length > options.maxHeaderLength) throw unauthorized();
    const match = /^Bearer ([^\s]+)$/i.exec(header);
    if (!match?.[1]) throw unauthorized();
    const result = await options.authService.validateAccessToken(match[1]);
    if (result.status === "invalid") throw unauthorized();
    if (result.status === "unavailable") throw new ApiError(503, "AUTH_PROVIDER_UNAVAILABLE", "Authentication service is temporarily unavailable.");
    request.auth = { userId: result.user.id, email: result.user.email, accessToken: match[1] };
  });
};
export const authenticationPlugin = fp(authenticate);
