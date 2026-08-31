import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { MarketplaceKind } from "../services/marketplace-service.js";

// Listing payloads are capped at 500KB by migration 0003 (octet_length on payload);
// the publish route gets a scoped body limit so the global BODY_LIMIT_BYTES stays
// small for every other route.
const MARKETPLACE_BODY_LIMIT_BYTES = 4_000_000;

// Whole-config size cap (R5/L3 mirror of events.ts:181). A single huge jsonb row
// would hurt the DB and the public read; 3MB serialized bounds a realistic course
// (cover image + several inline gallery/curriculum images + form fields) while
// rejecting abuse.
const MAX_CONFIG_BYTES = 3_000_000;

const noStore = async (_request: unknown, reply: any, payload: unknown) => { reply.header("Cache-Control", "no-store"); return payload; };

// Image validation (P3/B mirror of events.ts:18-47). data: URLs (inline base64)
// must be <= 500KB raw bytes, which is ~666KB of base64 text. https: URLs must
// be <= 2KB (host + path + query only; a real image upload goes through object
// storage, not an inline URL).
const IMAGE_DATA_MAX_BYTES = 500 * 1024;
const IMAGE_HTTPS_MAX_BYTES = 2 * 1024;
const DATA_IMAGE_RE = /^data:image\/(?:avif|gif|jpe?g|png|webp);base64,[a-z0-9+/=\s]+$/i;
const HTTPS_URL_RE = /^https:\/\/[^\s]+$/i;

const INTERNAL_HOST_RE = /^(localhost|127\.\d+\.\d+\.\d+|::1|::|0\.0\.0\.0|(10\.\d+|\d{1,3}\.10)\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+)$/i;

function isInternalHost(hostname: string): boolean {
  return INTERNAL_HOST_RE.test(hostname);
}

const safeHttpUrl = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) return trimmed.startsWith("//") ? false : true;
  let url: URL;
  try { url = new URL(trimmed); } catch { return false; }
  if (url.protocol !== "https:") return false;
  // Block SSRF: reject internal/private network hosts
  if (isInternalHost(url.hostname)) return false;
  return true;
};


const courseImageUrl = (value: string): boolean => {
  if (typeof value !== "string") return false;
  if (value === "") return true;
  if (value.startsWith("data:")) {
    if (!DATA_IMAGE_RE.test(value)) return false;
    const b64 = value.split(",")[1] ?? "";
    return Math.ceil((b64.replace(/\s+/g, "").length * 3) / 4) <= IMAGE_DATA_MAX_BYTES;
  }
  if (HTTPS_URL_RE.test(value) || value.startsWith("https://")) {
    return value.length <= IMAGE_HTTPS_MAX_BYTES && safeHttpUrl(value);
  }
  return false;
};

const kindSchema = z.enum(["course", "event"]);
const slugParamSchema = z.string().trim().min(1).max(120);

// coursePostSchema covers the fields the course-creator iframe emits today. The
// payload is free-form for future fields, but the well-known fields are
// validated here so a 5MB image or a malformed URL is rejected with 400 before
// it ever reaches the service. creatorId/hostName/phone are deliberately absent
// (defense-in-depth: the service also strips them, but a request that names
// them cannot match the route schema).
const courseFaqSchema = z.object({ question: z.string().min(1).max(500), answer: z.string().min(1).max(5_000) });
const courseCurriculumItemSchema = z.object({
  title: z.string().min(1).max(300),
  lessons: z.array(z.string().min(1).max(300)).max(100).optional(),
  duration: z.string().max(100).optional(),
});
const courseInstructorSchema = z.object({
  displayName: z.string().max(120).optional(),
  headline: z.string().max(300).optional(),
  bio: z.string().max(5_000).optional(),
  avatar: z.string().max(2_000).refine(safeHttpUrl, "Instructor avatar must be an https:// URL.").optional(),
});

const coursePostSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(300),
  subtitle: z.string().max(300).optional(),
  description: z.string().max(20_000).optional(),
  outcomes: z.array(z.string().min(1).max(500)).max(50).optional(),
  requirements: z.array(z.string().min(1).max(500)).max(50).optional(),
  curriculum: z.array(courseCurriculumItemSchema).max(200).optional(),
  image: z.string().max(700_000).refine(courseImageUrl, "Cover image must be an empty string, an https:// URL (max 2KB), or a data:image/...;base64 URL (max 500KB).").optional(),
  galleryImages: z.array(z.string().min(1).max(700_000).refine(courseImageUrl, "Gallery image must be an https:// URL (max 2KB) or a data:image/...;base64 URL (max 500KB).")).max(20).optional(),
  price: z.number().min(0).optional(),
  currency: z.string().min(1).max(8).optional(),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]).optional(),
  language: z.string().min(1).max(60).optional(),
  faqs: z.array(courseFaqSchema).max(50).optional(),
  instructor: courseInstructorSchema.optional(),
}).superRefine((value, ctx) => {
  const serializedBytes = Buffer.byteLength(JSON.stringify(value), "utf8");
  if (serializedBytes > MAX_CONFIG_BYTES) {
    ctx.addIssue({ code: "custom", message: `Course config is too large (${serializedBytes} bytes; max ${MAX_CONFIG_BYTES}). Use smaller images or upload to object storage.` });
  }
});

const coursePatchSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  subtitle: z.string().max(300).optional(),
  description: z.string().max(20_000).optional(),
  outcomes: z.array(z.string().min(1).max(500)).max(50).optional(),
  requirements: z.array(z.string().min(1).max(500)).max(50).optional(),
  curriculum: z.array(courseCurriculumItemSchema).max(200).optional(),
  image: z.string().max(700_000).refine(courseImageUrl, "Cover image must be an empty string, an https:// URL (max 2KB), or a data:image/...;base64 URL (max 500KB).").optional(),
  galleryImages: z.array(z.string().min(1).max(700_000).refine(courseImageUrl, "Gallery image must be an https:// URL (max 2KB) or a data:image/...;base64 URL (max 500KB).")).max(20).optional(),
  price: z.number().min(0).optional(),
  currency: z.string().min(1).max(8).optional(),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]).optional(),
  language: z.string().min(1).max(60).optional(),
  faqs: z.array(courseFaqSchema).max(50).optional(),
  instructor: courseInstructorSchema.optional(),
  version: z.number().int().min(1),
}).superRefine((value, ctx) => {
  const serializedBytes = Buffer.byteLength(JSON.stringify(value), "utf8");
  if (serializedBytes > MAX_CONFIG_BYTES) {
    ctx.addIssue({ code: "custom", message: `Course config is too large (${serializedBytes} bytes; max ${MAX_CONFIG_BYTES}). Use smaller images or upload to object storage.` });
  }
});

// Loose schema for the (still unported) event kind; mirrors the previous
// marketplace behavior. The marketplace service's scrub is the identity gate.
const eventPostSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(300),
  payload: z.record(z.string(), z.unknown()),
}).superRefine((value, ctx) => {
  if (JSON.stringify(value.payload).length > 500_000) ctx.addIssue({ code: "custom", message: "Payload is too large." });
});

const eventPatchSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  version: z.number().int().min(1),
}).superRefine((value, ctx) => {
  if (value.payload && JSON.stringify(value.payload).length > 500_000) ctx.addIssue({ code: "custom", message: "Payload is too large." });
});

async function requireTutor(authService: AuthService, request: any) {
  const profile = await authService.getOwnProfile(request.auth.accessToken, request.auth.userId);
  if (profile.status === "unavailable") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Profile service is temporarily unavailable.");
  if (profile.status !== "found" || profile.profile.id !== request.auth.userId || profile.profile.role !== "tutor") throw new ApiError(403, "TUTOR_ROLE_REQUIRED", "A tutor account is required.");
}

// Build a free-form payload object from the structured course fields. Anything
// not in the schema is dropped here; the service's scrub is the final
// defense-in-depth layer (R5/L3). title/slug/version are not stored in the
// payload blob because they live as dedicated columns on marketplace_listings.
function courseFieldsToPayload(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === "slug" || key === "title" || key === "version") continue;
    out[key] = value;
  }
  return out;
}

export const marketplaceRoutes: FastifyPluginAsync<{ authService: AuthService; marketplaceService: ReturnType<typeof import("../services/marketplace-service.js").createSupabaseMarketplaceService>; publishMax: number; readMax: number; windowMs: number }> = async (app, options) => {
  app.get("/api/v1/marketplace/:kind", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = kindSchema.safeParse((request.params as { kind?: unknown }).kind);
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Marketplace type not found.");
    const result = await options.marketplaceService.list(parsed.data);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Marketplace is temporarily unavailable.");
    return { ok: true, items: result.data };
  });

  app.get("/api/v1/marketplace/:kind/:slug", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const kind = kindSchema.safeParse((request.params as { kind?: unknown }).kind);
    if (!kind.success) throw new ApiError(404, "NOT_FOUND", "Marketplace type not found.");
    const slug = slugParamSchema.safeParse(decodeURIComponent((request.params as { slug?: string }).slug ?? ""));
    if (!slug.success) throw new ApiError(404, "NOT_FOUND", "Listing not found.");
    const result = await options.marketplaceService.getPublic(kind.data, slug.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Listing not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Marketplace is temporarily unavailable.");
    return { ok: true, item: result.data };
  });

  app.post("/api/v1/marketplace/:kind", { preHandler: app.authenticate, bodyLimit: MARKETPLACE_BODY_LIMIT_BYTES, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    await requireTutor(options.authService, request);
    const kind = kindSchema.safeParse((request.params as { kind?: unknown }).kind);
    if (!kind.success) throw new ApiError(404, "NOT_FOUND", "Marketplace type not found.");

    if (kind.data === "course") {
      const body = coursePostSchema.safeParse(request.body);
      if (!body.success) throw new ApiError(400, "MARKETPLACE_INVALID", "Listing details are invalid.");
      const payload = courseFieldsToPayload(body.data) as Record<string, unknown>;
      const result = await options.marketplaceService.publish(request.auth.accessToken, request.auth.userId, { kind: "course", slug: body.data.slug, title: body.data.title, payload });
      if (result.status === "conflict") throw new ApiError(409, "LISTING_SLUG_CONFLICT", "That public URL belongs to another creator.");
      if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Marketplace is temporarily unavailable.");
      return { ok: true, item: result.data };
    }

    const body = eventPostSchema.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "MARKETPLACE_INVALID", "Listing details are invalid.");
    const result = await options.marketplaceService.publish(request.auth.accessToken, request.auth.userId, { kind: "event", slug: body.data.slug, title: body.data.title, payload: body.data.payload });
    if (result.status === "conflict") throw new ApiError(409, "LISTING_SLUG_CONFLICT", "That public URL belongs to another creator.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Marketplace is temporarily unavailable.");
    return { ok: true, item: result.data };
  });

  app.patch("/api/v1/marketplace/:kind/:slug", { preHandler: app.authenticate, bodyLimit: MARKETPLACE_BODY_LIMIT_BYTES, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    await requireTutor(options.authService, request);
    const kind = kindSchema.safeParse((request.params as { kind?: unknown }).kind);
    if (!kind.success) throw new ApiError(404, "NOT_FOUND", "Marketplace type not found.");
    const slug = slugParamSchema.safeParse(decodeURIComponent((request.params as { slug?: string }).slug ?? ""));
    if (!slug.success) throw new ApiError(404, "NOT_FOUND", "Listing not found.");

    if (kind.data === "course") {
      const body = coursePatchSchema.safeParse(request.body);
      if (!body.success) throw new ApiError(400, "MARKETPLACE_INVALID", "Listing details are invalid.");
      const payloadPatch = courseFieldsToPayload(body.data as unknown as Record<string, unknown>);
      const patch: { title?: string; payload?: Record<string, unknown> } = {};
      if (body.data.title !== undefined) patch.title = body.data.title;
      if (Object.keys(payloadPatch).length) patch.payload = payloadPatch;
      const result = await options.marketplaceService.update(request.auth.accessToken, "course", slug.data, body.data.version, patch);
      if (result.status === "conflict") throw new ApiError(409, "VERSION_CONFLICT", "The listing was modified by another request. Reload and try again.");
      if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Listing not found.");
      if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not own this listing.");
      if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Marketplace is temporarily unavailable.");
      return { ok: true, item: result.data };
    }

    const body = eventPatchSchema.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "MARKETPLACE_INVALID", "Listing details are invalid.");
    const patch: { title?: string; payload?: Record<string, unknown> } = {};
    if (body.data.title !== undefined) patch.title = body.data.title;
    if (body.data.payload !== undefined) patch.payload = body.data.payload;
    const result = await options.marketplaceService.update(request.auth.accessToken, "event", slug.data, body.data.version, patch);
    if (result.status === "conflict") throw new ApiError(409, "VERSION_CONFLICT", "The listing was modified by another request. Reload and try again.");
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Listing not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not own this listing.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Marketplace is temporarily unavailable.");
    return { ok: true, item: result.data };
  });

  app.delete("/api/v1/marketplace/:kind/:slug", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    await requireTutor(options.authService, request);
    const kind = kindSchema.safeParse((request.params as { kind?: unknown }).kind);
    if (!kind.success) throw new ApiError(404, "NOT_FOUND", "Marketplace type not found.");
    const slug = slugParamSchema.safeParse(decodeURIComponent((request.params as { slug?: string }).slug ?? ""));
    if (!slug.success) throw new ApiError(404, "NOT_FOUND", "Listing not found.");
    const result = await options.marketplaceService.unpublish(request.auth.accessToken, kind.data, slug.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Listing not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Marketplace is temporarily unavailable.");
    return { ok: true, item: result.data };
  });
};