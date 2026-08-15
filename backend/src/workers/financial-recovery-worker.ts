import "dotenv/config";
import { hostname } from "node:os";
import { parseEnvironment } from "../config/env.js";
import { createSupabasePaymentService } from "../services/payment-service.js";

// Tutoria durable financial recovery worker (Phase 3). A thin loop that runs
// the three one-pass sweeps on an interval. Every command is idempotent and
// DB-claim-gated (FOR UPDATE SKIP LOCKED + lease), so multiple worker
// processes can run safely and a process restart loses no durable financial
// work: obligations are re-claimed after lease expiry, pending/ambiguous
// refunds are reconciled via querydr, and PAYMENT_SUCCEEDED events drive the
// booking finalize retry. Requires the trusted service-role authority and a
// VNPay configuration; exits cleanly when not configured (e.g. frontend-only
// deployments must never run this process).
async function main() {
  const config = parseEnvironment(process.env);
  const workerId = process.env.FINANCIAL_WORKER_WORKER_ID ?? `financial-recovery-${hostname()}-${process.pid}`;
  const intervalMs = Number(process.env.FINANCIAL_WORKER_INTERVAL_MS ?? 60_000);
  if (!Number.isFinite(intervalMs) || intervalMs < 1000) throw new Error("FINANCIAL_WORKER_INTERVAL_MS must be >= 1000");
  if (!config.SUPABASE_SERVICE_ROLE_KEY || !config.VNPAY_TMN_CODE || !config.VNPAY_HASH_SECRET || !config.VNPAY_RETURN_URL || !config.VNPAY_IPN_URL) {
    console.warn("Financial recovery worker requires the service-role key and a complete VNPay configuration; exiting.");
    return;
  }
  const service = createSupabasePaymentService(
    config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, config.SUPABASE_SERVICE_ROLE_KEY,
    { tmnCode: config.VNPAY_TMN_CODE, hashSecret: config.VNPAY_HASH_SECRET, paymentUrl: config.VNPAY_PAYMENT_URL, returnUrl: config.VNPAY_RETURN_URL, ipnUrl: config.VNPAY_IPN_URL },
    config.VNPAY_API_URL
  );
  let running = true;
  async function sweep() {
    if (!running) return;
    for (const label of ["executions", "reconciliations", "finalizations"]) {
      const call = label === "executions" ? service.sweepRefundExecutions(workerId)
        : label === "reconciliations" ? service.sweepRefundReconciliations(workerId)
        : service.sweepPendingFinalizations(workerId);
      const result = await call;
      if (result.error) console.error(`[${workerId}] ${label} sweep error:`, (result.error as Error).message);
    }
  }
  await sweep();
  const timer = setInterval(() => { sweep().catch((error: unknown) => console.error(`[${workerId}] sweep failed:`, error instanceof Error ? error.message : error)); }, intervalMs);
  const shutdown = async (signal: string) => {
    running = false;
    clearInterval(timer);
    console.log(`[${workerId}] received ${signal}; stopping`);
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  console.log(`[${workerId}] financial recovery worker started (interval ${intervalMs}ms)`);
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Financial recovery worker failed to start"); process.exitCode = 1; });
