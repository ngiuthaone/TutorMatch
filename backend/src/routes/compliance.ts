import type { FastifyPluginAsync } from "fastify";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";

export const complianceRoutes: FastifyPluginAsync<{
  authService: AuthService;
  complianceService: ReturnType<typeof import("../services/compliance-service.js").createComplianceService>;
  max: number;
  windowMs: number;
}> = async (app, options) => {
  /** GET /api/v1/host-compliance — get or initialize host compliance state. */
  app.get("/api/v1/host-compliance", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: async (_request, reply, payload) => { reply.header("Cache-Control", "no-store").header("Pragma", "no-cache"); return payload; },
  }, async (request) => {
    const result = await options.complianceService.ensureCompliance(
      request.auth.accessToken,
      request.auth.userId,
    );
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Compliance service is temporarily unavailable.");
    return { ok: true, compliance: result.data };
  });

  /** GET /api/v1/host-compliance/payout-eligible — server-authoritative eligibility check. */
  app.get("/api/v1/host-compliance/payout-eligible", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: async (_request, reply, payload) => { reply.header("Cache-Control", "no-store").header("Pragma", "no-cache"); return payload; },
  }, async (request) => {
    const result = await options.complianceService.isPayoutEligible(
      request.auth.accessToken,
      request.auth.userId,
    );
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Compliance service is temporarily unavailable.");
    return { ok: true, ...result.data };
  });
};
