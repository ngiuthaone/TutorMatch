import "dotenv/config";
import { createApp } from "./app.js";
import { parseEnvironment } from "./config/env.js";
import { createSupabaseAuthService } from "./lib/supabase.js";
import { createSupabaseTutorCvService } from "./services/tutor-cv-service.js";
import { createSupabaseBookingService } from "./services/booking-service.js";
import { createSupabasePaymentService } from "./services/payment-service.js";
import { createPolicyService } from "./services/policy-service.js";
import { createComplianceService } from "./services/compliance-service.js";
import { createPayoutService } from "./services/payout-service.js";
import { createAdminService } from "./services/admin-service.js";
import { createRequireAdmin } from "./plugins/admin-role.js";
import { requireFinancialWorkerConfig } from "./workers/financial-worker-config.js";
import { createFinancialWorkerRuntime } from "./workers/financial-worker-runtime.js";
import { hostname } from "node:os";

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
  const adminService = createAdminService(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY ?? config.SUPABASE_PUBLISHABLE_KEY,
  );
  const requireAdmin = createRequireAdmin(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
  const app = createApp({ config, authService, tutorCvService, bookingService, policyService, complianceService, payoutService, adminService, requireAdmin, logger: {
    level: config.NODE_ENV === "production" ? "info" : "debug",
    redact: { paths: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie", "*.accessToken", "*.refreshToken", "*.password", "*.secretKey"], censor: "[REDACTED]" }
  } });
  const shutdown = async (signal: string) => { app.log.info({ signal }, "Shutting down"); await app.close(); };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  await app.listen({ host: config.HOST, port: config.PORT });
  app.log.info({ host: config.HOST, port: config.PORT }, "Tutoria API started");
  app.log.info({
    VNPAY_TMN_CODE: Boolean(config.VNPAY_TMN_CODE),
    VNPAY_HASH_SECRET: Boolean(config.VNPAY_HASH_SECRET),
    VNPAY_RETURN_URL: Boolean(config.VNPAY_RETURN_URL),
    VNPAY_IPN_URL: Boolean(config.VNPAY_IPN_URL),
    VNPAY_ENVIRONMENT: config.VNPAY_ENVIRONMENT,
    paymentRoutesRegistered: Boolean(config.VNPAY_TMN_CODE && config.VNPAY_HASH_SECRET && config.VNPAY_RETURN_URL && config.VNPAY_IPN_URL),
  }, "VNPay env diagnostics");

  if (process.env.START_WORKER === "true" && config.VNPAY_TMN_CODE && config.VNPAY_HASH_SECRET && config.VNPAY_RETURN_URL && config.VNPAY_IPN_URL) {
    try {
      const worker = requireFinancialWorkerConfig(config, `financial-recovery-${hostname()}-${process.pid}`);
      const shutdownController = new AbortController();
      const service = createSupabasePaymentService(
        config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, config.SUPABASE_SERVICE_ROLE_KEY,
        { tmnCode: config.VNPAY_TMN_CODE, hashSecret: config.VNPAY_HASH_SECRET, paymentUrl: config.VNPAY_PAYMENT_URL, returnUrl: config.VNPAY_RETURN_URL, ipnUrl: config.VNPAY_IPN_URL },
        config.VNPAY_API_URL, fetch, { batchSize: worker.batchSize, leaseSeconds: worker.leaseSeconds, releaseBackoffSeconds: worker.releaseBackoffSeconds, providerRequestTimeoutMs: config.VNPAY_REQUEST_TIMEOUT_MS, signal: shutdownController.signal }
      );
      const runtime = createFinancialWorkerRuntime({ service, workerId: worker.workerId, intervalMs: worker.intervalMs, logger: (level: "debug" | "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) => {
        app.log[level]({ event, workerId: worker.workerId, ...fields }, `worker: ${event}`);
      }, onStop: () => shutdownController.abort() });
      await runtime.start();
      app.log.info({ workerId: worker.workerId }, "Financial worker started in-process");
    } catch (error) {
      app.log.error({ error: error instanceof Error ? error.message : "unknown" }, "Financial worker failed to start (API continues)");
    }
  }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Backend startup failed"); process.exitCode = 1; });
