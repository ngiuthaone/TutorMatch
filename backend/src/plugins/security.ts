import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import type { AppConfig } from "../config/env.js";

const security: FastifyPluginAsync<{ config: AppConfig }> = async (app, { config }) => {
  await app.register(helmet, { ...(config.NODE_ENV === "production" ? {} : { hsts: false }), referrerPolicy: { policy: "no-referrer" }, contentSecurityPolicy: false, xFrameOptions: { action: "deny" } });
  await app.register(cors, {
    origin: (origin, callback) => callback(null, !origin || config.FRONTEND_ORIGINS.map(o => o.toLowerCase()).includes(origin?.toLowerCase() ?? "")),
    methods: ["GET", "PUT", "POST", "DELETE", "OPTIONS"], allowedHeaders: ["Authorization", "Content-Type", "Accept"], credentials: false
  });
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX, timeWindow: config.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: (request, context) => ({ statusCode: context.statusCode, ok: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests." }, requestId: request.id })
  });
};
export const securityPlugin = fp(security);
