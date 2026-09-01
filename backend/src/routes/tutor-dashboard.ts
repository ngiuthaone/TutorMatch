import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import { createClient } from "@supabase/supabase-js";
import { logServiceError } from "../lib/service-error.js";
import type { AppConfig } from "../config/env.js";
import type { AuthService } from "../services/auth-service.js";

const noStore = async (_request: unknown, reply: any, payload: unknown) => {
  reply.header("Cache-Control", "no-store").header("Pragma", "no-cache");
  return payload;
};

interface TutorDashboardRouteOptions {
  authService: AuthService;
  config: AppConfig;
  max: number;
  windowMs: number;
}

function client(url: string, key: string, token?: string) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}

const reviewBodySchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(10).max(2000),
});

export const tutorDashboardRoutes: FastifyPluginAsync<TutorDashboardRouteOptions> = async (app, options) => {
  app.get("/api/v1/me/tutor-dashboard", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const userId = request.auth.userId;
    const supabase = client(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, request.auth.accessToken);
    const { data, error } = await supabase.rpc("get_tutor_dashboard", { p_user_id: userId });
    if (error) {
      const message = typeof error.message === "string" ? error.message : "";
      const code = typeof error.code === "string" ? error.code : "";
      if (code === "42501" || message.includes("FORBIDDEN")) {
        throw new ApiError(403, "FORBIDDEN", "Only the tutor can view this dashboard.");
      }
      if (message.includes("not_a_tutor")) {
        return { ok: true, isTutor: false, dashboard: null };
      }
      logServiceError({ service: "tutor-dashboard-route", operation: "get_tutor_dashboard", error });
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Tutor dashboard is temporarily unavailable.");
    }
    return { ok: true, isTutor: true, dashboard: data };
  });

  app.post("/api/v1/me/tutor-reviews", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const parsed = reviewBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_REVIEW", "Review payload is invalid.");
    }
    const supabase = client(options.config.SUPABASE_URL, options.config.SUPABASE_PUBLISHABLE_KEY, request.auth.accessToken);
    const { data, error } = await supabase.rpc("create_tutor_review", {
      p_booking_id: parsed.data.bookingId,
      p_rating: parsed.data.rating,
      p_body: parsed.data.body,
    });
    if (error) {
      const message = typeof error.message === "string" ? error.message : "";
      const code = typeof error.code === "string" ? error.code : "";
      if (code === "42501") throw new ApiError(403, "FORBIDDEN", "You cannot review this booking.");
      if (message.includes("BOOKING_NOT_COMPLETED")) throw new ApiError(409, "BOOKING_NOT_COMPLETED", "Only completed bookings can be reviewed.");
      if (message.includes("BOOKING_NOT_FOUND")) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking was not found.");
      if (message.includes("PAYMENT_NOT_FINALIZED") || message.includes("NO_PAYMENT")) throw new ApiError(409, "PAYMENT_NOT_FINALIZED", "Payment has not finalized.");
      if (message.includes("INVALID_RATING") || message.includes("INVALID_BODY")) throw new ApiError(400, "INVALID_REVIEW", "Review payload is invalid.");
      logServiceError({ service: "tutor-dashboard-route", operation: "create_tutor_review", error });
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Reviews are temporarily unavailable.");
    }
    return { ok: true, review: data };
  });
};
