import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { EventPublicationService } from "../services/event-publication-service.js";

// Realistic event payloads carry base64 cover/gallery/plan images up to ~350KB
// each; mirror the discover `eventPostSchema` image caps and allow a full event
// with several photos. The global BODY_LIMIT_BYTES stays small; this route gets
// a scoped cap that is bounded but large enough for a realistic multi-photo form.
const EVENTS_BODY_LIMIT_BYTES = 4_000_000;

const noStore = async (_request: unknown, reply: any, payload: unknown) => { reply.header("Cache-Control", "no-store"); return payload; };

// Image validation caps (P3/B). data: URLs (inline base64) must be <= 500KB raw,
// which is ~666KB of base64 text. https: URLs must be <= 2KB (host + path + query
// only; a real image upload goes through object storage, not an inline URL).
const IMAGE_DATA_MAX_BYTES = 500 * 1024;
const IMAGE_HTTPS_MAX_BYTES = 2 * 1024;
const DATA_IMAGE_RE = /^data:image\/(?:avif|gif|jpe?g|png|webp);base64,[a-z0-9+/=\s]+$/i;
const HTTPS_URL_RE = /^https:\/\/[^\s]+$/i;

const safeHttpUrl = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) return trimmed.startsWith("//") ? false : true;
  let url: URL;
  try { url = new URL(trimmed); } catch { return false; }
  return url.protocol === "https:";
};

const eventImageUrl = (value: string): boolean => {
  if (typeof value !== "string") return false;
  if (value === "") return true;
  // data: URL: must be an image, base64, and within the raw-bytes cap.
  if (value.startsWith("data:")) {
    if (!DATA_IMAGE_RE.test(value)) return false;
    const b64 = value.split(",")[1] ?? "";
    // base64 expands ~4/3; raw bytes <= 500KB means base64 <= ~666KB.
    return Math.ceil((b64.replace(/\s+/g, "").length * 3) / 4) <= IMAGE_DATA_MAX_BYTES;
  }
  // https: URL: must be https, total length <= 2KB.
  if (HTTPS_URL_RE.test(value) || value.startsWith("https://")) {
    return value.length <= IMAGE_HTTPS_MAX_BYTES && safeHttpUrl(value);
  }
  return false;
};

const eventSessionSchema = z.object({
  id: z.string().min(1).max(80),
  date: z.string().max(60),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  times: z.array(z.string().max(30)).max(20),
});
const eventPlanItemSchema = z.object({
  title: z.string().max(300),
  duration: z.string().max(100),
  description: z.string().max(5_000),
  image: z.string().min(1).max(700_000).refine(eventImageUrl, "Plan image must be an https:// URL (max 2KB) or a data:image/...;base64 URL (max 500KB).").optional(),
});
const eventReviewSchema = z.object({
  name: z.string().max(60),
  attended: z.string().max(60),
  rating: z.number().min(0).max(5),
  body: z.string().max(5_000),
  avatar: z.string().max(2_000).refine(safeHttpUrl, "Unsafe review avatar URL."),
});
const eventFaqSchema = z.object({ question: z.string().max(500), answer: z.string().max(5_000) });
const eventPackageSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  price: z.number().min(0),
  description: z.string().max(2_000).optional(),
  badge: z.string().max(200).optional(),
  includes: z.array(z.string().max(500)).max(100),
});

// Mirrors the discover `eventPostSchema` fields the creator emits today.
const eventPostSchema = z.object({
  slug: z.string().min(1).max(120).regex(/^[\w-]+$/, "Slug may only contain letters, numbers, dashes, and underscores."),
  title: z.string().min(1).max(300),
  subtitle: z.string().max(300).optional(),
  date: z.string().max(60),
  time: z.string().max(60),
  duration: z.string().max(100),
  location: z.string().max(300),
  timezone: z.string().max(80).optional(),
  type: z.enum(["In person", "Online"]),
  price: z.string().max(60),
  attending: z.number().int().min(0).optional(),
  capacity: z.number().int().min(1).max(100_000),
  image: z.string().max(700_000).refine(eventImageUrl, "Image must be an empty string, an https:// URL (max 2KB), or a data:image/...;base64 URL (max 500KB).").optional(),
  topic: z.string().max(120),
  level: z.string().max(120),
  languages: z.array(z.string().max(60)).max(12),
  minimumAge: z.string().max(60),
  accessibility: z.string().max(5_000),
  studioName: z.string().max(200),
  address: z.string().max(500),
  sessions: z.array(eventSessionSchema).max(100),
  spotsLeft: z.number().int().min(0).optional(),
  about: z.array(z.string().max(20_000)).max(50),
  note: z.string().max(10_000),
  highlights: z.array(z.object({ title: z.string().max(200), description: z.string().max(2_000) })).max(30),
  learn: z.array(z.string().max(500)).max(100),
  included: z.array(z.string().max(500)).max(100),
  bring: z.array(z.string().max(500)).max(100),
  plan: z.array(eventPlanItemSchema).max(100),
  faqs: z.array(eventFaqSchema).max(30),
  galleryImage: z.string().min(1).max(700_000).refine(eventImageUrl, "Gallery image must be an https:// URL (max 2KB) or a data:image/...;base64 URL (max 500KB).").optional(),
  hostRole: z.string().max(120),
  hostExperience: z.string().max(5_000),
  hostBio: z.string().max(5_000),
  hostImage: z.string().max(2_000).refine(eventImageUrl, "Host image must be an https:// URL (max 2KB).").optional(),
  hostRecommendation: z.string().max(500),
  beforeYouAttend: z.array(z.object({ title: z.string().max(200), items: z.array(z.string().max(500)).max(50) })).max(30),
  cancellation: z.array(z.string().max(500)).max(30),
  reviews: z.array(eventReviewSchema).max(100),
  packages: z.array(eventPackageSchema).max(40).optional(),
  pricingMode: z.enum(["single", "multiple"]).optional(),
  creatorId: z.string().optional(),
  creatorName: z.string().max(120).optional(),
  publishedAt: z.string().max(60).optional(),
  // Visibility is mapped server-side (V1-V3): "Public" -> publish, else draft.
  visibility: z.enum(["Public", "Unlisted", "Community only"]).default("Unlisted"),
});

const slugParamSchema = z.string().trim().min(1).max(120);

export const eventPublicationRoutes: FastifyPluginAsync<{
  authService: AuthService;
  eventService: EventPublicationService;
  publishMax: number;
  readMax: number;
  windowMs: number;
}> = async (app, options) => {
  // Public browse listing: published events only, newest first (L1/L4).
  // No authenticate. Backs the /events browse in live mode.
  app.get("/api/v1/events", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const listStart = Date.now();
    request.log.info({ event: "events.list", query: request.query }, "events list requested");
    const result = await options.eventService.listPublicEvents();
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Events are temporarily unavailable.");
    const latencyMs = Date.now() - listStart;
    request.log.info({ event: "events.list", count: result.data.events.length, latencyMs }, "events list completed");
    return { events: result.data.events };
  });

  // Public read: published events only (R1/R2/R4). No authenticate.
  app.get("/api/v1/events/:slug", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const getStart = Date.now();
    request.log.info({ event: "events.get", slug: (request.params as { slug?: string }).slug }, "event get requested");
    const parsed = slugParamSchema.safeParse(decodeURIComponent((request.params as { slug?: string }).slug ?? ""));
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Event not found.");
    const result = await options.eventService.getPublicEventBySlug(parsed.data);
    if (result.status === "not_found") {
      request.log.info({ event: "events.get", slug: parsed.data, status: "not_found", latencyMs: Date.now() - getStart }, "event get not_found");
      throw new ApiError(404, "NOT_FOUND", "Event not found.");
    }
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Events are temporarily unavailable.");
    request.log.info({ event: "events.get", slug: parsed.data, status: "found", latencyMs: Date.now() - getStart }, "event get completed");
    return result.data;
  });

  // Publish/create (D1 verified author gate via RPC). No cross-user mutation:
  // ownership derives from the JWT; client creatorIdentity keys are stripped.
  app.post("/api/v1/events", {
    preHandler: app.authenticate,
    bodyLimit: EVENTS_BODY_LIMIT_BYTES,
    config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const publishStart = Date.now();
    const parsed = eventPostSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "EVENT_INVALID", "Event details are invalid.");
    const body = parsed.data;
    request.log.info({ event: "events.publish.attempt", slug: body.slug, userId: request.auth?.userId }, "event publish attempted");
    // Whole-config size cap (P3/B). A single huge jsonb row would hurt the DB
    // and the public read; 1MB serialized bounds a realistic multi-photo event
    // (a few 500KB inline images + form fields) while rejecting abuse.
    const MAX_CONFIG_BYTES = 3_000_000;
    const serializedBytes = Buffer.byteLength(JSON.stringify(body), "utf8");
    if (serializedBytes > MAX_CONFIG_BYTES) {
      throw new ApiError(400, "EVENT_INVALID", `Event config is too large (${serializedBytes} bytes; max ${MAX_CONFIG_BYTES}). Use smaller images or upload to object storage.`);
    }
    const config: Record<string, unknown> = { ...body };
    // Visibility maps to the publish flag and is not stored as event content.
    delete config.visibility;
    // Strip client-provided identity/owner keys before they reach the service/RPC.
    delete config.creatorId;
    delete config.publishedAt;
    let result;
    try {
      result = await options.eventService.publishEvent(
        request.auth.accessToken,
        { requestedSlug: body.slug, title: body.title, config, publish: body.visibility === "Public" },
        { userId: request.auth.userId, email: request.auth.email },
      );
    } catch (err) {
      const apiError = err as { code?: string; message?: string } | null;
      request.log.warn({ event: "events.publish.failure", slug: body.slug, code: apiError?.code, message: apiError?.message, userId: request.auth?.userId }, "event publish failed");
      throw err;
    }
    if (result.status === "invalid") {
      request.log.warn({ event: "events.publish.failure", slug: body.slug, code: result.code, userId: request.auth?.userId }, "event publish failed");
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email before publishing.");
      if (result.code === "FORBIDDEN") throw new ApiError(403, "FORBIDDEN", "You are not allowed to publish an event.");
      if (result.code === "SLUG_EXHAUSTED" || result.code === "INVALID_SLUG" || result.code === "INVALID_TRANSITION") {
        throw new ApiError(400, result.code, "The event slug or title is invalid.");
      }
    }
    if (result.status !== "ok") {
      request.log.warn({ event: "events.publish.failure", slug: body.slug, code: "SERVICE_UNAVAILABLE", userId: request.auth?.userId }, "event publish failed");
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Events are temporarily unavailable.");
    }
    const latencyMs = Date.now() - publishStart;
    request.log.info({
      event: "events.publish.success",
      slug: result.data.slug,
      status: result.data.status,
      offeringId: result.data.offeringId,
      version: result.data.version,
      userId: request.auth?.userId,
      latencyMs,
    }, "event published");
    return { slug: result.data.slug, status: result.data.status, offeringId: result.data.offeringId };
  });
};
