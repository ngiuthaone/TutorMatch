import Fastify, { LogController, type FastifyServerOptions } from "fastify";
import type { AppConfig } from "./config/env.js";
import { ApiError } from "./errors/api-error.js";
import { authenticationPlugin } from "./plugins/authenticate.js";
import { securityPlugin } from "./plugins/security.js";
import { healthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";
import { tutorCvRoutes } from "./routes/tutor-cv.js";
import { publicTutorRoutes } from "./routes/public-tutors.js";
import type { AuthService } from "./services/auth-service.js";
import type { TutorCvService } from "./types/tutor-cv.js";

export function createApp(options: { config: AppConfig; authService: AuthService; tutorCvService?: TutorCvService; logger?: FastifyServerOptions["logger"] }) {
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
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ ok: false, error: { code: "NOT_FOUND", message: "Route not found." }, requestId: request.id }));
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      if (error.headers) for (const [name, value] of Object.entries(error.headers)) reply.header(name, value);
      return reply.code(error.statusCode).send({ ok: false, error: { code: error.code, message: error.message }, requestId: request.id });
    }
    if (typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 429) return reply.code(429).send({ ok: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests." }, requestId: request.id });
    request.log.error({ err: error, requestId: request.id }, "Unhandled request error");
    return reply.code(500).send({ ok: false, error: { code: "INTERNAL_ERROR", message: "An internal error occurred." }, requestId: request.id });
  });
  return app;
}
