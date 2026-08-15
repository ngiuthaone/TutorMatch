import { describe, expect, it } from "vitest";
import { parseEnvironment } from "../src/config/env.js";
import { requireFinancialWorkerConfig } from "../src/workers/financial-worker-config.js";

const valid = {
  NODE_ENV: "development", FRONTEND_ORIGINS: "http://localhost:4173", SUPABASE_URL: "https://p.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable", SUPABASE_SERVICE_ROLE_KEY: "service-role", VNPAY_ENVIRONMENT: "sandbox",
  VNPAY_TMN_CODE: "tmn", VNPAY_HASH_SECRET: "hash", VNPAY_RETURN_URL: "https://example.test/return", VNPAY_IPN_URL: "https://example.test/ipn"
};

describe("financial worker configuration", () => {
  it("uses bounded operational defaults", () => {
    const config = requireFinancialWorkerConfig(parseEnvironment(valid), "worker-test");
    expect(config).toMatchObject({ workerId: "worker-test", intervalMs: 60_000, batchSize: 50, leaseSeconds: 300, releaseBackoffSeconds: 60 });
  });
  it("fails closed when authority or provider configuration is incomplete", () => {
    expect(() => requireFinancialWorkerConfig(parseEnvironment({ ...valid, SUPABASE_SERVICE_ROLE_KEY: undefined }))).toThrow("SUPABASE_SERVICE_ROLE_KEY");
    expect(() => requireFinancialWorkerConfig(parseEnvironment({ ...valid, NODE_ENV: "production", VNPAY_ENVIRONMENT: "sandbox", SUPABASE_URL: "https://p.supabase.co", FRONTEND_ORIGINS: "https://app.example.test" }))).toThrow("VNPAY_ENVIRONMENT=production");
  });
});
