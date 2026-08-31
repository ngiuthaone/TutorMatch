import Fastify, { LogController, type FastifyServerOptions } from "fastify";
import type { AppConfig } from "./config/env.js";
import { ApiError } from "./errors/api-error.js";
import { authenticationPlugin } from "./plugins/authenticate.js";
import { securityPlugin } from "./plugins/security.js";
import cookie from "@fastify/cookie";
import { healthRoutes } from "./routes/health.js";
import authBffRoutes from "./routes/auth-bff.js";
import { meRoutes } from "./routes/me.js";
import { tutorCvRoutes } from "./routes/tutor-cv.js";
import { publicTutorRoutes } from "./routes/public-tutors.js";
import { marketplaceRoutes } from "./routes/marketplace.js";
import { createSupabaseMarketplaceService } from "./services/marketplace-service.js";
import { createSupabaseEventPublicationService, type EventPublicationService } from "./services/event-publication-service.js";
import { eventPublicationRoutes } from "./routes/events.js";
import { createSupabasePaymentService } from "./services/payment-service.js";
import { paymentRoutes } from "./routes/payments.js";
import { bookingRoutes } from "./routes/booking.js";
import { policyRoutes } from "./routes/policies.js";
import { complianceRoutes } from "./routes/compliance.js";
import { payoutRoutes } from "./routes/payouts.js";
import { adminRoutes } from "./routes/admin.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { messagingRoutes } from "./routes/messaging.js";
import { createSupabaseMessagingService, type MessagingService } from "./services/messaging-service.js";
import { createSupabaseArticleService, type ArticleService } from "./services/article-service.js";
import { createSupabasePostService, type PostService } from "./services/post-service.js";
import { createSupabaseCommentService, type CommentService } from "./services/comment-service.js";
import { articleRoutes } from "./routes/articles.js";
import { postRoutes } from "./routes/posts.js";
import { commentRoutes } from "./routes/comments.js";
import type { AuthService } from "./services/auth-service.js";
import type { BookingService } from "./services/booking-service.js";
import type { TutorCvService } from "./types/tutor-cv.js";
import type { createPolicyService } from "./services/policy-service.js";
import type { createComplianceService } from "./services/compliance-service.js";
import type { createPayoutService } from "./services/payout-service.js";
import type { createAdminService } from "./services/admin-service.js";

export function createApp(options: {
  config: AppConfig;
  authService: AuthService;
  tutorCvService?: TutorCvService;
  marketplaceService?: ReturnType<typeof createSupabaseMarketplaceService>;
  eventService?: EventPublicationService;
  bookingService?: BookingService;
  policyService?: ReturnType<typeof createPolicyService>;
  complianceService?: ReturnType<typeof createComplianceService>;
  payoutService?: ReturnType<typeof createPayoutService>;
  adminService?: ReturnType<typeof createAdminService>;
  articleService?: ArticleService;
  postService?: PostService;
  commentService?: CommentService;
  messagingService?: MessagingService;
  requireAdmin?: (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
  logger?: FastifyServerOptions["logger"];
}) {
  const app = Fastify({
    logger: options.logger ?? false, trustProxy: options.config.TRUST_PROXY,
    bodyLimit: options.config.BODY_LIMIT_BYTES, requestTimeout: options.config.REQUEST_TIMEOUT_MS,
    keepAliveTimeout: options.config.KEEP_ALIVE_TIMEOUT_MS,
    logController: new LogController({ disableRequestLogging: true })
  });
  app.register(cookie);
  app.register(securityPlugin, { config: options.config });
  app.register(authenticationPlugin, { authService: options.authService, maxHeaderLength: options.config.MAX_AUTHORIZATION_HEADER_LENGTH });
  app.register(healthRoutes);
  app.register(authBffRoutes);
  app.register(meRoutes, { authService: options.authService, max: options.config.ME_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  if (options.tutorCvService) {
    app.register(tutorCvRoutes, { authService: options.authService, tutorCvService: options.tutorCvService, limits: { get: options.config.TUTOR_CV_GET_RATE_LIMIT_MAX, save: options.config.TUTOR_CV_SAVE_RATE_LIMIT_MAX, publish: options.config.TUTOR_CV_PUBLISH_RATE_LIMIT_MAX }, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
    app.register(publicTutorRoutes, { tutorCvService: options.tutorCvService, listMax: options.config.PUBLIC_TUTORS_LIST_RATE_LIMIT_MAX, detailMax: options.config.PUBLIC_TUTOR_DETAIL_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  }
  app.register(marketplaceRoutes, { authService: options.authService, marketplaceService: options.marketplaceService ?? createSupabaseMarketplaceService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY), publishMax: options.config.COURSE_PUBLISH_RATE_LIMIT_MAX, readMax: options.config.COURSE_READ_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  app.register(eventPublicationRoutes, { authService: options.authService, eventService: options.eventService ?? createSupabaseEventPublicationService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, options.authService), publishMax: options.config.EVENT_PUBLISH_RATE_LIMIT_MAX, readMax: options.config.EVENT_READ_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  app.register(articleRoutes, { authService: options.authService, articleService: options.articleService ?? createSupabaseArticleService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, options.authService), publishMax: options.config.ARTICLE_PUBLISH_RATE_LIMIT_MAX, readMax: options.config.ARTICLE_READ_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS, allowedImageHosts: options.config.ALLOWED_IMAGE_HOSTS ?? [] });
  app.register(postRoutes, { authService: options.authService, postService: options.postService ?? createSupabasePostService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, options.authService), publishMax: options.config.POST_PUBLISH_RATE_LIMIT_MAX, readMax: options.config.POST_READ_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  app.register(commentRoutes, { authService: options.authService, commentService: options.commentService ?? createSupabaseCommentService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, options.authService), publishMax: options.config.COMMENT_RATE_LIMIT_MAX, readMax: options.config.ARTICLE_READ_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  if (options.bookingService) app.register(bookingRoutes, { service: options.bookingService });
  if (options.config.VNPAY_TMN_CODE && options.config.VNPAY_HASH_SECRET && options.config.VNPAY_RETURN_URL && options.config.VNPAY_IPN_URL) {
    app.register(paymentRoutes, { service: createSupabasePaymentService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, options.config.SUPABASE_SERVICE_ROLE_KEY, { tmnCode: options.config.VNPAY_TMN_CODE, hashSecret: options.config.VNPAY_HASH_SECRET, paymentUrl: options.config.VNPAY_PAYMENT_URL, returnUrl: options.config.VNPAY_RETURN_URL, ipnUrl: options.config.VNPAY_IPN_URL }, options.config.VNPAY_API_URL, fetch, { providerRequestTimeoutMs: options.config.VNPAY_REQUEST_TIMEOUT_MS }), vnpay: { tmnCode: options.config.VNPAY_TMN_CODE, hashSecret: options.config.VNPAY_HASH_SECRET, paymentUrl: options.config.VNPAY_PAYMENT_URL, returnUrl: options.config.VNPAY_RETURN_URL, ipnUrl: options.config.VNPAY_IPN_URL }, reconciliationToken: options.config.PAYMENT_RECONCILIATION_TOKEN });
  }
  if (options.policyService) {
    app.register(policyRoutes, { authService: options.authService, policyService: options.policyService, max: options.config.RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  }
  if (options.complianceService) {
    app.register(complianceRoutes, { authService: options.authService, complianceService: options.complianceService, max: options.config.RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  }
  if (options.payoutService) {
    app.register(payoutRoutes, { authService: options.authService, payoutService: options.payoutService, max: options.config.RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  }
  if (options.adminService && options.requireAdmin) {
    app.register(adminRoutes, { authService: options.authService, adminService: options.adminService, requireAdmin: options.requireAdmin, max: options.config.RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  }
  const messagingService = options.messagingService ?? createSupabaseMessagingService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY);
  app.register(messagingRoutes, { service: messagingService, readMax: options.config.MESSAGING_READ_RATE_LIMIT_MAX, sendMax: options.config.MESSAGING_SEND_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  if (options.requireAdmin) {
    const dashConfig: { SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string; SUPABASE_SERVICE_ROLE_KEY?: string } = {
      SUPABASE_URL: options.config.SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: options.config.SUPABASE_PUBLISHABLE_KEY,
    };
    if (options.config.SUPABASE_SERVICE_ROLE_KEY) dashConfig.SUPABASE_SERVICE_ROLE_KEY = options.config.SUPABASE_SERVICE_ROLE_KEY;
    app.register(dashboardRoutes, { authService: options.authService, config: dashConfig, requireAdmin: options.requireAdmin, max: options.config.RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  }
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ ok: false, error: { code: "NOT_FOUND", message: "Route not found." }, requestId: request.id }));
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      if (error.statusCode >= 400 && error.statusCode < 500) request.log.warn({ requestId: request.id, statusCode: error.statusCode, code: error.code }, "Request rejected");
      if (error.headers) for (const [name, value] of Object.entries(error.headers)) reply.header(name, value);
      return reply.code(error.statusCode).send({ ok: false, error: { code: error.code, message: error.message }, requestId: request.id });
    }
    if (typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 429) {
      request.log.warn({ requestId: request.id }, "Rate limit exceeded");
      return reply.code(429).send({ ok: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests." }, requestId: request.id });
    }
    if (typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 413) {
      request.log.warn({ requestId: request.id }, "Payload too large");
      return reply.code(413).send({ ok: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large." }, requestId: request.id });
    }
    const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
    if (code === "FST_ERR_CTP_INVALID_JSON_BODY" || code === "FST_ERR_CTP_EMPTY_JSON_BODY") {
      request.log.warn({ requestId: request.id, code }, "Malformed JSON body");
      return reply.code(400).send({ ok: false, error: { code: "INVALID_BODY", message: "Request body is not valid JSON." }, requestId: request.id });
    }
    if (code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
      request.log.warn({ requestId: request.id, code }, "Unsupported content type");
      return reply.code(415).send({ ok: false, error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Unsupported content type." }, requestId: request.id });
    }
    request.log.error({ err: error, requestId: request.id }, "Unhandled request error");
    return reply.code(500).send({ ok: false, error: { code: "INTERNAL_ERROR", message: "An internal error occurred." }, requestId: request.id });
  });
  return app;
}
