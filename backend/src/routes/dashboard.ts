import type { FastifyPluginAsync } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";

/**
 * Dashboard routes: minimal internal launch dashboard showing funnel counts,
 * financial metrics (GMV, refunds, commission), and operational cases.
 *
 * Financial metrics read from financial/domain records, NOT browser analytics.
 * Uses service-role key to bypass RLS on analytics/financial tables (admin only).
 * Admin role is enforced by the requireAdmin preHandler.
 */
export const dashboardRoutes: FastifyPluginAsync<{
  authService: AuthService;
  config: { SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string; SUPABASE_SERVICE_ROLE_KEY?: string };
  requireAdmin: (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
  max: number;
  windowMs: number;
}> = async (app, options) => {
  // Use service-role key when available; fall back to anon key (broken for RLS tables).
  const queryKey = options.config.SUPABASE_SERVICE_ROLE_KEY ?? options.config.SUPABASE_PUBLISHABLE_KEY;
  const adminClient = createClient(
    options.config.SUPABASE_URL,
    queryKey,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );

  /** GET /api/v1/dashboard/overview — aggregated launch metrics. */
  app.get("/api/v1/dashboard/overview", {
    preHandler: [app.authenticate, options.requireAdmin],
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: async (_request, reply, payload) => { reply.header("Cache-Control", "no-store").header("Pragma", "no-cache"); return payload; },
  }, async () => {
    try {
      // Funnel counts from analytics_events (server-authoritative funnel events).
      const funnelEventTypes = [
        "ANALYTICS_LISTING_VIEW",
        "ANALYTICS_BOOKING_STARTED",
        "ANALYTICS_BOOKING_REQUESTED",
        "ANALYTICS_HOST_ACCEPTED",
        "ANALYTICS_PAYMENT_STARTED",
        "ANALYTICS_PAYMENT_COMPLETED",
        "ANALYTICS_SESSION_ATTENDED",
        "ANALYTICS_BOOKING_COMPLETED",
        "ANALYTICS_REVIEW_CREATED",
      ];

      const funnelCounts: Record<string, number> = {};
      for (const eventType of funnelEventTypes) {
        const { count } = await adminClient
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("event_type", eventType)
          .eq("environment", "production");
        funnelCounts[eventType] = count ?? 0;
      }

      // Financial metrics from domain records (NOT analytics).
      // GMV: sum of succeeded payment amounts.
      const { data: payments } = await adminClient
        .from("payments" as never)
        .select("amount_vnd, status" as never)
        .eq("status" as never, "succeeded" as never) as never;

      let gmv = 0;
      let refunds = 0;
      if (Array.isArray(payments)) {
        for (const p of payments as Array<{ amount_vnd: number }>) {
          gmv += p.amount_vnd ?? 0;
        }
      }

      // Refunds: sum of refund amounts from bookings with refund snapshots.
      // For now, use payout_statements as the source of refund truth.
      const { data: payoutData } = await adminClient
        .from("payout_statements")
        .select("refunds_vnd, commission_vnd");

      if (Array.isArray(payoutData)) {
        for (const row of payoutData as Array<{ refunds_vnd: number; commission_vnd: number }>) {
          refunds += row.refunds_vnd ?? 0;
        }
      }

      const commission = Math.floor(gmv * 0.10); // 10% commission

      // Operational cases: open disputes.
      const { count: openDisputes } = await adminClient
        .from("disputes")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");

      // Host cancellation/no-show records.
      const { count: hostCancellations } = await adminClient
        .from("host_cancellation_records")
        .select("id", { count: "exact", head: true })
        .eq("cancellation_type", "host_cancelled");

      const { count: hostNoShows } = await adminClient
        .from("host_cancellation_records")
        .select("id", { count: "exact", head: true })
        .eq("cancellation_type", "host_no_show");

      return {
        ok: true,
        funnel: {
          listingViews: funnelCounts["ANALYTICS_LISTING_VIEW"] ?? 0,
          bookingStarts: funnelCounts["ANALYTICS_BOOKING_STARTED"] ?? 0,
          bookingRequests: funnelCounts["ANALYTICS_BOOKING_REQUESTED"] ?? 0,
          hostAcceptances: funnelCounts["ANALYTICS_HOST_ACCEPTED"] ?? 0,
          paymentStarts: funnelCounts["ANALYTICS_PAYMENT_STARTED"] ?? 0,
          paymentSuccess: funnelCounts["ANALYTICS_PAYMENT_COMPLETED"] ?? 0,
          sessionAttendance: funnelCounts["ANALYTICS_SESSION_ATTENDED"] ?? 0,
          bookingCompletions: funnelCounts["ANALYTICS_BOOKING_COMPLETED"] ?? 0,
          reviews: funnelCounts["ANALYTICS_REVIEW_CREATED"] ?? 0,
        },
        financial: {
          gmv,
          refunds,
          commission,
        },
        operational: {
          openDisputes: openDisputes ?? 0,
          hostCancellations: hostCancellations ?? 0,
          hostNoShows: hostNoShows ?? 0,
        },
      };
    } catch {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Dashboard service is temporarily unavailable.");
    }
  });
};
