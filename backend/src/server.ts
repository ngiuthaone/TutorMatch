import "dotenv/config";
import * as Sentry from "@sentry/node";
import "@sentry/profiling-node";
import { createClient } from "@supabase/supabase-js";
import { createApp } from "./app.js";
import { parseEnvironment } from "./config/env.js";
import { createSupabaseAuthService } from "./lib/supabase.js";
import { createSupabaseTutorCvService } from "./services/tutor-cv-service.js";
import { createSupabaseBookingService } from "./services/booking-service.js";
import { createSupabasePaymentService } from "./services/payment-service.js";
import { createSupabaseCourseService } from "./services/course-service.js";
import { createPolicyService } from "./services/policy-service.js";
import { createComplianceService } from "./services/compliance-service.js";
import { createPayoutService } from "./services/payout-service.js";
import { createAdminService } from "./services/admin-service.js";
import { createRequireAdmin } from "./plugins/admin-role.js";
import { requireFinancialWorkerConfig } from "./workers/financial-worker-config.js";
import { createFinancialWorkerRuntime } from "./workers/financial-worker-runtime.js";
import { hostname } from "node:os";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.TUTORIA_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  tracesSampler: (samplingContext) => {
    if (samplingContext.request?.url?.includes("/health")) return 0;
    return process.env.NODE_ENV === "production" ? 0.1 : 1.0;
  },
  beforeSendTransaction(event) {
    if (event.transaction === "/health" || event.transaction === "/api/v1/health") return null;
    return event;
  },
});

async function main() {
  const config = parseEnvironment(process.env);
  const authService = createSupabaseAuthService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
  const tutorCvService = createSupabaseTutorCvService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
  const bookingService = createSupabaseBookingService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
  const policyService = createPolicyService(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY ?? config.SUPABASE_PUBLISHABLE_KEY,
    config.SUPABASE_PUBLISHABLE_KEY,
  );
  const complianceService = createComplianceService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
  const payoutService = createPayoutService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
  const courseService = createSupabaseCourseService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
  const adminService = createAdminService(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY ?? config.SUPABASE_PUBLISHABLE_KEY,
  );
  const requireAdmin = createRequireAdmin(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
  const app = createApp({ config, authService, tutorCvService, bookingService, policyService, complianceService, payoutService, adminService, courseService, requireAdmin, logger: {
    level: config.NODE_ENV === "production" ? "info" : "debug",
    redact: { paths: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie", "*.accessToken", "*.refreshToken", "*.password", "*.secretKey", "*.email"], censor: "[REDACTED]" }
  } });

  app.addHook("onError", async (request, _reply, error) => {
    if (error && typeof error === "object" && "statusCode" in error) return;
    Sentry.captureException(error, {
      extra: { requestId: request.id, method: request.method, url: request.url },
    });
  });

  const gracefulShutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down");
    await app.close();
    await Sentry.close(2000);
    process.exit(0);
  };
  process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));

  await app.listen({ host: config.HOST, port: config.PORT });
  app.log.info({ host: config.HOST, port: config.PORT }, "Tutoria API started");

  process.on("unhandledRejection", (reason, promise) => {
    app.log.error({ err: reason, type: "unhandledRejection" }, "Unhandled promise rejection");
    if (process.env.SENTRY_DSN) {
      import("@sentry/node").then(({ captureException }) => {
        captureException(reason, { extra: { type: "unhandledRejection" } });
      }).catch(() => {});
    }
  });

  process.on("uncaughtException", (error) => {
    app.log.error({ err: error, type: "uncaughtException" }, "Uncaught exception");
    if (process.env.SENTRY_DSN) {
      import("@sentry/node").then(({ captureException }) => {
        captureException(error, { extra: { type: "uncaughtException" } });
      }).catch(() => {});
    }
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  });

  if (process.env.START_WORKER === "true" && config.VNPAY_TMN_CODE && config.VNPAY_HASH_SECRET && config.VNPAY_RETURN_URL && config.VNPAY_IPN_URL) {
    try {
      const worker = requireFinancialWorkerConfig(config, `financial-recovery-${hostname()}-${process.pid}`);
      const shutdownController = new AbortController();
      const service = createSupabasePaymentService(
        config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, config.SUPABASE_SERVICE_ROLE_KEY,
        { tmnCode: config.VNPAY_TMN_CODE, hashSecret: config.VNPAY_HASH_SECRET, paymentUrl: config.VNPAY_PAYMENT_URL, returnUrl: config.VNPAY_RETURN_URL, ipnUrl: config.VNPAY_IPN_URL },
        config.VNPAY_API_URL, fetch, { batchSize: worker.batchSize, leaseSeconds: worker.leaseSeconds, releaseBackoffSeconds: worker.releaseBackoffSeconds, providerRequestTimeoutMs: config.VNPAY_REQUEST_TIMEOUT_MS, signal: shutdownController.signal }
      );
      const heartbeatClient = config.SUPABASE_SERVICE_ROLE_KEY
        ? createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
        : null;
      const runtime = createFinancialWorkerRuntime({ service, workerId: worker.workerId, intervalMs: worker.intervalMs, logger: (level: "debug" | "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) => {
        app.log[level]({ event, workerId: worker.workerId, ...fields }, `worker: ${event}`);
        if (heartbeatClient && event === "financial_worker_iteration_completed") {
          const ok = fields.ok === true;
          const lastError = ok ? null : typeof fields.errorCount === "number" && fields.errorCount > 0
            ? `${fields.errorCount} sweep error(s); see worker logs for details`
            : null;
          void (async () => {
            try {
              const writeResult = await heartbeatClient.from("worker_heartbeats").upsert({
                worker_id: worker.workerId,
                last_run_at: new Date().toISOString(),
                last_status: ok ? "ok" : "degraded",
                last_error: lastError,
              }, { onConflict: "worker_id" });
              if (writeResult.error) {
                app.log.warn({ err: writeResult.error.message, workerId: worker.workerId }, "worker_heartbeat_write_failed");
              }
            } catch (writeError) {
              app.log.warn({ err: writeError instanceof Error ? writeError.message : "unknown", workerId: worker.workerId }, "worker_heartbeat_write_failed");
            }
          })();
        }
      }, onStop: () => shutdownController.abort() });
      await runtime.start();
      app.log.info({ workerId: worker.workerId }, "Financial worker started in-process");
    } catch (error) {
      app.log.error({ error: error instanceof Error ? error.message : "unknown" }, "Financial worker failed to start (API continues)");
    }
  }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Backend startup failed"); process.exitCode = 1; });
