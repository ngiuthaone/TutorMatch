import type { AppConfig } from "../config/env.js";

export type FinancialWorkerConfig = {
  workerId: string;
  intervalMs: number;
  batchSize: number;
  leaseSeconds: number;
  releaseBackoffSeconds: number;
  logLevel: AppConfig["FINANCIAL_WORKER_LOG_LEVEL"];
};

/** Worker-only checks. The API may run without payment authority; this process may not. */
export function requireFinancialWorkerConfig(config: AppConfig, workerId = config.FINANCIAL_WORKER_WORKER_ID ?? "financial-recovery"): FinancialWorkerConfig {
  const missing = [
    ["SUPABASE_SERVICE_ROLE_KEY", config.SUPABASE_SERVICE_ROLE_KEY],
    ["VNPAY_TMN_CODE", config.VNPAY_TMN_CODE],
    ["VNPAY_HASH_SECRET", config.VNPAY_HASH_SECRET],
    ["VNPAY_RETURN_URL", config.VNPAY_RETURN_URL],
    ["VNPAY_IPN_URL", config.VNPAY_IPN_URL]
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Financial worker critical configuration is missing: ${missing.join(", ")}`);
  if (config.NODE_ENV === "production" && !["staging", "production"].includes(config.TUTORIA_ENVIRONMENT)) {
    throw new Error("Financial worker NODE_ENV=production requires TUTORIA_ENVIRONMENT=staging or production");
  }
  if (config.TUTORIA_ENVIRONMENT === "production" && config.VNPAY_ENVIRONMENT !== "production") {
    throw new Error("Financial worker production requires VNPAY_ENVIRONMENT=production");
  }
  if (config.TUTORIA_ENVIRONMENT !== "production" && config.VNPAY_ENVIRONMENT === "production") {
    throw new Error("Financial worker non-production environments must not use VNPAY_ENVIRONMENT=production");
  }
  return {
    workerId,
    intervalMs: config.FINANCIAL_WORKER_INTERVAL_MS,
    batchSize: config.FINANCIAL_WORKER_BATCH_SIZE,
    leaseSeconds: config.FINANCIAL_WORKER_LEASE_SECONDS,
    releaseBackoffSeconds: config.FINANCIAL_WORKER_RELEASE_BACKOFF_SECONDS,
    logLevel: config.FINANCIAL_WORKER_LOG_LEVEL
  };
}
