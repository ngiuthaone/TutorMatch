import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { PolicyType } from "../services/policy-service.js";

const policyTypeSchema = z.enum([
  "terms_of_service",
  "privacy_policy",
  "cancellation_refund_policy",
  "host_agreement",
  "payment_payout_rules",
]);

const acceptanceSchema = z.object({
  policyType: policyTypeSchema,
  policyVersion: z.string().trim().min(1).max(100),
  locale: z.string().trim().max(20).optional(),
});

export const policyRoutes: FastifyPluginAsync<{
  authService: AuthService;
  policyService: ReturnType<typeof import("../services/policy-service.js").createPolicyService>;
  max: number;
  windowMs: number;
}> = async (app, options) => {
  /** GET /api/v1/policies — list active policy versions (public). */
  app.get("/api/v1/policies", {
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
  }, async () => {
    const result = await options.policyService.listActivePolicies();
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Policy service is temporarily unavailable.");
    return { ok: true, policies: result.data };
  });

  /** POST /api/v1/policies/accept — record a policy acceptance. */
  app.post("/api/v1/policies/accept", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
  }, async (request) => {
    const body = acceptanceSchema.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "POLICY_INVALID", "Policy type and version are required.");
    const result = await options.policyService.recordAcceptance(
      request.auth.accessToken,
      request.auth.userId,
      body.data.policyType as PolicyType,
      body.data.policyVersion,
      "api",
      body.data.locale,
    );
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Policy service is temporarily unavailable.");
    return { ok: true, ...result.data };
  });

  /** GET /api/v1/policies/check — check if the current user has accepted a policy. */
  app.get("/api/v1/policies/check", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
  }, async (request) => {
    const { type, version } = request.query as { type?: string; version?: string };
    if (!type) throw new ApiError(400, "POLICY_TYPE_REQUIRED", "policy type query parameter is required.");
    const parsed = policyTypeSchema.safeParse(type);
    if (!parsed.success) throw new ApiError(400, "POLICY_INVALID", "Invalid policy type.");
    const result = await options.policyService.hasAccepted(
      request.auth.accessToken,
      request.auth.userId,
      parsed.data,
      version,
    );
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Policy service is temporarily unavailable.");
    return { ok: true, ...result.data };
  });

  /** GET /api/v1/policies/my-acceptances — list the current user's acceptances. */
  app.get("/api/v1/policies/my-acceptances", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
  }, async (request) => {
    const result = await options.policyService.getMyAcceptances(
      request.auth.accessToken,
    );
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Policy service is temporarily unavailable.");
    return { ok: true, acceptances: result.data };
  });
};
