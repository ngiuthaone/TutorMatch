import "dotenv/config";
import { hostname } from "node:os";
import { parseEnvironment } from "../config/env.js";
import { createSupabasePaymentService } from "../services/payment-service.js";
import { requireFinancialWorkerConfig } from "./financial-worker-config.js";
import { createFinancialWorkerRuntime } from "./financial-worker-runtime.js";

const safeError = (error: unknown) => (error instanceof Error ? error.message : "unknown startup error").slice(0, 500);
const main = async () => {
  const config = parseEnvironment(process.env);
  const worker = requireFinancialWorkerConfig(config, config.FINANCIAL_WORKER_WORKER_ID ?? `financial-recovery-${hostname()}-${process.pid}`);
  const shutdownController = new AbortController();
  const log = (level: "debug" | "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) => {
    if (level === "debug" && worker.logLevel !== "debug") return;
    const output = JSON.stringify({ timestamp: new Date().toISOString(), level, event, workerId: worker.workerId, ...fields });
    (level === "error" ? console.error : console.log)(output);
  };
  const service = createSupabasePaymentService(
    config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, config.SUPABASE_SERVICE_ROLE_KEY,
    { tmnCode: config.VNPAY_TMN_CODE!, hashSecret: config.VNPAY_HASH_SECRET!, paymentUrl: config.VNPAY_PAYMENT_URL, returnUrl: config.VNPAY_RETURN_URL!, ipnUrl: config.VNPAY_IPN_URL! },
    config.VNPAY_API_URL, fetch, { batchSize: worker.batchSize, leaseSeconds: worker.leaseSeconds, releaseBackoffSeconds: worker.releaseBackoffSeconds, providerRequestTimeoutMs: config.VNPAY_REQUEST_TIMEOUT_MS, signal: shutdownController.signal }
  );
  const runtime = createFinancialWorkerRuntime({ service, workerId: worker.workerId, intervalMs: worker.intervalMs, logger: log, onStop: () => shutdownController.abort() });
  const shutdown = (signal: string) => { void runtime.stop(signal); };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  await runtime.start();
};

main().catch((error: unknown) => {
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", event: "financial_worker_start_failed", error: safeError(error) }));
  process.exitCode = 1;
});
