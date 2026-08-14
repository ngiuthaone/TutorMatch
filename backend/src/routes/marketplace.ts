import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { MarketplaceKind } from "../services/marketplace-service.js";

// Listing payloads are capped at 500KB by migration 0003; the publish route gets a
// scoped body limit so the global BODY_LIMIT_BYTES stays small for every other route.
const MARKETPLACE_BODY_LIMIT_BYTES = 600_000;
const kindSchema = z.enum(["course", "event"]);
const publishSchema = z.object({ slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), title: z.string().trim().min(1).max(300), payload: z.record(z.string(), z.unknown()) }).superRefine((value, ctx) => {
  if (JSON.stringify(value.payload).length > 500_000) ctx.addIssue({ code: "custom", message: "Payload is too large." });
});
const noStore = async (_request: unknown, reply: any, payload: unknown) => { reply.header("Cache-Control", "no-store"); return payload; };

async function requireTutor(authService: AuthService, request: any) {
  const profile = await authService.getOwnProfile(request.auth.accessToken, request.auth.userId);
  if (profile.status === "unavailable") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Profile service is temporarily unavailable.");
  if (profile.status !== "found" || profile.profile.id !== request.auth.userId || profile.profile.role !== "tutor") throw new ApiError(403, "TUTOR_ROLE_REQUIRED", "A tutor account is required.");
}

export const marketplaceRoutes: FastifyPluginAsync<{ authService: AuthService; marketplaceService: ReturnType<typeof import("../services/marketplace-service.js").createSupabaseMarketplaceService>; max: number; windowMs: number }> = async (app, options) => {
  app.get("/api/v1/marketplace/:kind", { config: { rateLimit: { max: options.max, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = kindSchema.safeParse((request.params as { kind?: unknown }).kind);
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Marketplace type not found.");
    const result = await options.marketplaceService.list(parsed.data);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Marketplace is temporarily unavailable.");
    return { ok: true, items: result.data };
  });
  app.post("/api/v1/marketplace/:kind", { preHandler: app.authenticate, bodyLimit: MARKETPLACE_BODY_LIMIT_BYTES, config: { rateLimit: { max: options.max, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    await requireTutor(options.authService, request);
    const kind = kindSchema.safeParse((request.params as { kind?: unknown }).kind);
    const body = publishSchema.safeParse(request.body);
    if (!kind.success || !body.success) throw new ApiError(400, "MARKETPLACE_INVALID", "Listing details are invalid.");
    const result = await options.marketplaceService.publish(request.auth.accessToken, request.auth.userId, { kind: kind.data as MarketplaceKind, ...body.data });
    if (result.status === "conflict") throw new ApiError(409, "LISTING_SLUG_CONFLICT", "That public URL belongs to another creator.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Marketplace is temporarily unavailable.");
    return { ok: true, item: result.data };
  });
};
