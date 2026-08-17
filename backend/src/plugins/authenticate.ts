import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";

const authenticate: FastifyPluginAsync<{ authService: AuthService; maxHeaderLength: number }> = async (app, options) => {
  app.decorateRequest("auth");
  app.decorate("authenticate", async (request) => {
    const header = request.headers.authorization;
    const unauthorized = () => new ApiError(401, "UNAUTHORIZED", "Authentication is required.", { "WWW-Authenticate": "Bearer" });
    const reject = (reason: string): never => {
      request.log.warn({ requestId: request.id, reason }, "Authentication rejected");
      throw unauthorized();
    };
    const authorizationHeaderCount = request.raw.rawHeaders.filter((value) => value.toLowerCase() === "authorization").length;
    if (authorizationHeaderCount !== 1 || typeof header !== "string" || header.length > options.maxHeaderLength) return reject("invalid_authorization_header");
    const match = /^Bearer ([^\s]+)$/i.exec(header);
    if (!match?.[1]) return reject("invalid_bearer_token");
    const accessToken = match[1];
    const result = await options.authService.validateAccessToken(accessToken);
    if (result.status === "invalid") return reject("invalid_access_token");
    if (result.status === "unavailable") {
      request.log.warn({ requestId: request.id }, "Authentication provider unavailable");
      throw new ApiError(503, "AUTH_PROVIDER_UNAVAILABLE", "Authentication service is temporarily unavailable.");
    }
    if (result.status !== "authenticated") return reject("unrecognized_auth_result");
    request.auth = { userId: result.user.id, email: result.user.email, accessToken };
  });
};
export const authenticationPlugin = fp(authenticate);
