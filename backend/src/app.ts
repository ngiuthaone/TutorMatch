import Fastify, { LogController, type FastifyServerOptions } from "fastify";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "./config/env.js";
import { ApiError } from "./errors/api-error.js";
import { authenticationPlugin } from "./plugins/authenticate.js";
import { securityPlugin } from "./plugins/security.js";
import cookie from "@fastify/cookie";
import { healthRoutes } from "./routes/health.js";
import authBffRoutes from "./routes/auth-bff.js";
import securityAlertRoutes from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { tutorCvRoutes } from "./routes/tutor-cv.js";
import { publicTutorRoutes } from "./routes/public-tutors.js";
import tutorSearchRoutes from "./routes/tutor-search.js";
import { marketplaceRoutes } from "./routes/marketplace.js";
import { courseRoutes } from "./routes/courses.js";
import { createSupabaseCourseService } from "./services/course-service.js";
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
import { adminModerationRoutes } from "./routes/admin-moderation.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { tutorDashboardRoutes } from "./routes/tutor-dashboard.js";
import { messagingRoutes } from "./routes/messaging.js";
import { createSupabaseMessagingService, type MessagingService } from "./services/messaging-service.js";
import { createSupabaseHostCenterService, type HostCenterService } from "./services/host-center-service.js";
import { hostCenterRoutes } from "./routes/host.js";
import { createSupabaseArticleService, type ArticleService } from "./services/article-service.js";
import { createSupabasePostService, type PostService } from "./services/post-service.js";
import { createSupabaseCommentService, type CommentService } from "./services/comment-service.js";
import { createSupabaseFollowService, type FollowService } from "./services/follow-service.js";
import { createSupabaseNotificationService, type NotificationService } from "./services/notification-service.js";
import { createSupabaseThreadService, type ThreadService } from "./services/thread-service.js";
import { createSupabaseCommunityService, type CommunityService } from "./services/community-service.js";
import { type SearchService } from "./services/search-service.js";
import { createSupabaseBookmarkService, type BookmarkService, createSupabaseReportService, type ReportService } from "./services/bookmark-service.js";
import { createSupabaseModerationService, type ModerationService } from "./services/moderation-service.js";
import { articleRoutes } from "./routes/articles.js";
import { postRoutes } from "./routes/posts.js";
import { commentRoutes } from "./routes/comments.js";
import { followRoutes } from "./routes/follows.js";
import { notificationRoutes } from "./routes/notifications.js";
import { threadRoutes } from "./routes/threads.js";
import { communityRoutes } from "./routes/communities.js";
import { bookmarkRoutes } from "./routes/bookmarks.js";
import { moderationRoutes } from "./routes/moderation.js";
import { searchRoutes } from "./routes/search.js";
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
  courseService?: ReturnType<typeof createSupabaseCourseService>;
  eventService?: EventPublicationService;
  bookingService?: BookingService;
  policyService?: ReturnType<typeof createPolicyService>;
  complianceService?: ReturnType<typeof createComplianceService>;
  payoutService?: ReturnType<typeof createPayoutService>;
  adminService?: ReturnType<typeof createAdminService>;
  articleService?: ArticleService;
  postService?: PostService;
  commentService?: CommentService;
  followService?: FollowService;
  notificationService?: NotificationService;
  threadService?: ThreadService;
  communityService?: CommunityService;
  bookmarkService?: BookmarkService;
  reportService?: ReportService;
  moderationService?: ModerationService;
  searchService?: SearchService;
  messagingService?: MessagingService;
  hostCenterService?: HostCenterService;
  requireAdmin?: (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
  logger?: FastifyServerOptions["logger"];
}) {
  const app = Fastify({
    logger: options.logger ?? false, trustProxy: options.config.TRUST_PROXY,
    bodyLimit: options.config.BODY_LIMIT_BYTES, requestTimeout: options.config.REQUEST_TIMEOUT_MS,
    keepAliveTimeout: options.config.KEEP_ALIVE_TIMEOUT_MS,
    logController: new LogController({ disableRequestLogging: true })
  });

  // Request tracing: assign/propagate x-request-id and bind to logger so
  // downstream log lines are correlated. Honors caller-supplied IDs.
  app.addHook("onRequest", async (request, reply) => {
    const incoming = request.headers["x-request-id"];
    const id = typeof incoming === "string" && incoming.length > 0 && incoming.length <= 128 ? incoming : randomUUID();
    request.id = id;
    reply.header("x-request-id", id);
    request.log = request.log.child({ requestId: id });
  });
  // SLO measurement: capture per-request route, status, latency. Fire-and-forget
  // to request_logs (added in W4.A). Skipped when service role key is absent (dev).
  const supabaseUrl = options.config.SUPABASE_URL;
  const supabaseServiceKey = options.config.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseServiceKey) {
    app.addHook("onResponse", async (request, reply) => {
      try {
        const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
        const route = (request as unknown as { routerPath?: string }).routerPath ?? url.pathname;
        const elapsed = (reply as unknown as { elapsedTime?: number }).elapsedTime;
        const latency = typeof elapsed === "number" ? Math.round(elapsed) : 0;
        const auth = (request as unknown as { auth?: { userId?: string } }).auth;
        const userId = auth?.userId ?? null;
        void fetch(`${supabaseUrl}/rest/v1/request_logs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "apikey": supabaseServiceKey,
            "Prefer": "return=minimal"
          },
          body: JSON.stringify({
            request_id: request.id,
            method: request.method,
            route,
            status: reply.statusCode,
            latency_ms: latency,
            user_id: userId
          })
        }).catch(() => { /* swallow */ });
      } catch {
        /* never block the response */
      }
    });
  }
  app.register(cookie);
  app.register(securityPlugin, { config: options.config });
  app.register(authenticationPlugin, { authService: options.authService, maxHeaderLength: options.config.MAX_AUTHORIZATION_HEADER_LENGTH });
  app.register(healthRoutes, { config: options.config, ...(options.requireAdmin ? { requireAdmin: options.requireAdmin } : {}) });
  app.register(authBffRoutes, { supabaseUrl: options.config.SUPABASE_URL, supabasePublishableKey: options.config.SUPABASE_PUBLISHABLE_KEY, signInRateMax: options.config.AUTH_SIGN_IN_RATE_LIMIT_MAX, signInWindowMs: options.config.AUTH_SIGN_IN_WINDOW_MS });
  app.register(securityAlertRoutes);
  app.register(meRoutes, { authService: options.authService, max: options.config.ME_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  if (options.tutorCvService) {
    app.register(tutorCvRoutes, { authService: options.authService, tutorCvService: options.tutorCvService, limits: { get: options.config.TUTOR_CV_GET_RATE_LIMIT_MAX, save: options.config.TUTOR_CV_SAVE_RATE_LIMIT_MAX, publish: options.config.TUTOR_CV_PUBLISH_RATE_LIMIT_MAX }, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
    app.register(publicTutorRoutes, { tutorCvService: options.tutorCvService, listMax: options.config.PUBLIC_TUTORS_LIST_RATE_LIMIT_MAX, detailMax: options.config.PUBLIC_TUTOR_DETAIL_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
    app.register(tutorSearchRoutes, { config: options.config, max: options.config.PUBLIC_TUTORS_LIST_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  }
  app.register(marketplaceRoutes, { authService: options.authService, marketplaceService: options.marketplaceService ?? createSupabaseMarketplaceService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY), publishMax: options.config.COURSE_PUBLISH_RATE_LIMIT_MAX, readMax: options.config.COURSE_READ_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  if (options.courseService) {
    app.register(courseRoutes, { courseService: options.courseService, authService: options.authService });
  }
  app.register(eventPublicationRoutes, { authService: options.authService, eventService: options.eventService ?? createSupabaseEventPublicationService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, options.authService), publishMax: options.config.EVENT_PUBLISH_RATE_LIMIT_MAX, readMax: options.config.EVENT_READ_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  app.register(articleRoutes, { authService: options.authService, articleService: options.articleService ?? createSupabaseArticleService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, options.authService), publishMax: options.config.ARTICLE_PUBLISH_RATE_LIMIT_MAX, readMax: options.config.ARTICLE_READ_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS, allowedImageHosts: options.config.ALLOWED_IMAGE_HOSTS ?? [] });
  app.register(postRoutes, { authService: options.authService, postService: options.postService ?? createSupabasePostService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, options.authService), publishMax: options.config.POST_PUBLISH_RATE_LIMIT_MAX, readMax: options.config.POST_READ_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  app.register(commentRoutes, { authService: options.authService, commentService: options.commentService ?? createSupabaseCommentService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, options.authService), publishMax: options.config.COMMENT_RATE_LIMIT_MAX, readMax: options.config.ARTICLE_READ_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  app.register(followRoutes, { authService: options.authService, followService: options.followService ?? createSupabaseFollowService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, options.authService), publishMax: options.config.FOLLOW_RATE_LIMIT_MAX, readMax: options.config.POST_READ_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  app.register(notificationRoutes, { authService: options.authService, notificationService: options.notificationService ?? createSupabaseNotificationService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, options.authService), readMax: options.config.NOTIFICATION_READ_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  app.register(threadRoutes, { authService: options.authService, threadService: options.threadService ?? createSupabaseThreadService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, options.authService), publishMax: options.config.THREAD_PUBLISH_RATE_LIMIT_MAX, readMax: options.config.THREAD_READ_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  app.register(communityRoutes, { authService: options.authService, communityService: options.communityService ?? createSupabaseCommunityService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, options.authService), publishMax: options.config.THREAD_PUBLISH_RATE_LIMIT_MAX, readMax: options.config.THREAD_READ_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  if (options.searchService) app.register(searchRoutes, { authService: options.authService, searchService: options.searchService, readMax: options.config.POST_READ_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  app.register(bookmarkRoutes, { authService: options.authService, bookmarkService: options.bookmarkService ?? createSupabaseBookmarkService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, options.authService), reportService: options.reportService ?? createSupabaseReportService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, options.authService), readMax: options.config.NOTIFICATION_READ_RATE_LIMIT_MAX, publishMax: options.config.COMMENT_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  if (options.bookingService) app.register(bookingRoutes, { service: options.bookingService, authService: options.authService, supabaseUrl: options.config.SUPABASE_URL, serviceRoleKey: options.config.SUPABASE_SERVICE_ROLE_KEY });
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
    app.register(adminModerationRoutes, { adminService: options.adminService, requireAdmin: options.requireAdmin, max: options.config.RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  }
  const messagingService = options.messagingService ?? createSupabaseMessagingService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY);
  app.register(messagingRoutes, { service: messagingService, readMax: options.config.MESSAGING_READ_RATE_LIMIT_MAX, sendMax: options.config.MESSAGING_SEND_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  app.register(tutorDashboardRoutes, { authService: options.authService, config: options.config, max: options.config.RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  app.register(hostCenterRoutes, {
    authService: options.authService,
    service: options.hostCenterService ?? createSupabaseHostCenterService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY),
    max: options.config.HOST_CENTER_RATE_LIMIT_MAX,
    windowMs: options.config.RATE_LIMIT_WINDOW_MS,
  });
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
