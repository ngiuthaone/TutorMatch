import type { FastifyPluginAsync } from "fastify";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";

export const payoutRoutes: FastifyPluginAsync<{
  authService: AuthService;
  payoutService: ReturnType<typeof import("../services/payout-service.js").createPayoutService>;
  max: number;
  windowMs: number;
}> = async (app, options) => {
  /** GET /api/v1/payouts — list the current host's payout statements. */
  app.get("/api/v1/payouts", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: async (_request, reply, payload) => { reply.header("Cache-Control", "no-store").header("Pragma", "no-cache"); return payload; },
  }, async (request) => {
    const result = await options.payoutService.getMyPayoutStatements(
      request.auth.accessToken,
    );
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Payout service is temporarily unavailable.");
    return { ok: true, statements: result.data };
  });
};
