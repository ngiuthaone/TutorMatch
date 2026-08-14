import Fastify, { LogController, type FastifyServerOptions } from "fastify";
import type { AppConfig } from "./config/env.js";
import { ApiError } from "./errors/api-error.js";
import { authenticationPlugin } from "./plugins/authenticate.js";
import { securityPlugin } from "./plugins/security.js";
import { healthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";
import { tutorCvRoutes } from "./routes/tutor-cv.js";
import { publicTutorRoutes } from "./routes/public-tutors.js";
import { marketplaceRoutes } from "./routes/marketplace.js";
import { createSupabaseMarketplaceService } from "./services/marketplace-service.js";
import { createSupabasePaymentService } from "./services/payment-service.js";
import { paymentRoutes } from "./routes/payments.js";
import { bookingRoutes } from "./routes/booking.js";
import type { AuthService } from "./services/auth-service.js";
import type { BookingService } from "./services/booking-service.js";
import type { TutorCvService } from "./types/tutor-cv.js";

export function createApp(options: { config: AppConfig; authService: AuthService; tutorCvService?: TutorCvService; marketplaceService?: ReturnType<typeof createSupabaseMarketplaceService>; bookingService?: BookingService; logger?: FastifyServerOptions["logger"] }) {
  const app = Fastify({
    logger: options.logger ?? false, trustProxy: options.config.TRUST_PROXY,
    bodyLimit: options.config.BODY_LIMIT_BYTES, requestTimeout: options.config.REQUEST_TIMEOUT_MS,
    keepAliveTimeout: options.config.KEEP_ALIVE_TIMEOUT_MS,
    logController: new LogController({ disableRequestLogging: true })
  });
  app.register(securityPlugin, { config: options.config });
  app.register(authenticationPlugin, { authService: options.authService, maxHeaderLength: options.config.MAX_AUTHORIZATION_HEADER_LENGTH });
  app.register(healthRoutes);
  app.register(meRoutes, { authService: options.authService, max: options.config.ME_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  if (options.tutorCvService) {
    app.register(tutorCvRoutes, { authService: options.authService, tutorCvService: options.tutorCvService, limits: { get: options.config.TUTOR_CV_GET_RATE_LIMIT_MAX, save: options.config.TUTOR_CV_SAVE_RATE_LIMIT_MAX, publish: options.config.TUTOR_CV_PUBLISH_RATE_LIMIT_MAX }, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
    app.register(publicTutorRoutes, { tutorCvService: options.tutorCvService, listMax: options.config.PUBLIC_TUTORS_LIST_RATE_LIMIT_MAX, detailMax: options.config.PUBLIC_TUTOR_DETAIL_RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  }
  app.register(marketplaceRoutes, { authService: options.authService, marketplaceService: options.marketplaceService ?? createSupabaseMarketplaceService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY), max: options.config.RATE_LIMIT_MAX, windowMs: options.config.RATE_LIMIT_WINDOW_MS });
  if (options.bookingService) app.register(bookingRoutes, { service: options.bookingService });
  if (options.config.VNPAY_TMN_CODE && options.config.VNPAY_HASH_SECRET && options.config.VNPAY_RETURN_URL && options.config.VNPAY_IPN_URL) {
    app.register(paymentRoutes, { service: createSupabasePaymentService(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, options.config.SUPABASE_SERVICE_ROLE_KEY, { tmnCode: options.config.VNPAY_TMN_CODE, hashSecret: options.config.VNPAY_HASH_SECRET, paymentUrl: options.config.VNPAY_PAYMENT_URL, returnUrl: options.config.VNPAY_RETURN_URL, ipnUrl: options.config.VNPAY_IPN_URL }, options.config.VNPAY_API_URL), vnpay: { tmnCode: options.config.VNPAY_TMN_CODE, hashSecret: options.config.VNPAY_HASH_SECRET, paymentUrl: options.config.VNPAY_PAYMENT_URL, returnUrl: options.config.VNPAY_RETURN_URL, ipnUrl: options.config.VNPAY_IPN_URL }, reconciliationToken: options.config.PAYMENT_RECONCILIATION_TOKEN });
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
    request.log.error({ err: error, requestId: request.id }, "Unhandled request error");
    return reply.code(500).send({ ok: false, error: { code: "INTERNAL_ERROR", message: "An internal error occurred." }, requestId: request.id });
  });
  return app;
}
