import { describe, expect, it } from "vitest";
import { createSupabasePaymentService } from "../src/services/payment-service.js";

const vnpay = { tmnCode: "TUTORIA01", hashSecret: "local-secret", paymentUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html", returnUrl: "https://frontend.test/payments/return", ipnUrl: "https://api.test/api/v1/payments/vnpay/ipn" };

const sweeps = [
  ["sweepRefundExecutions", { claimed: 0, executed: 0 }],
  ["sweepRefundReconciliations", { claimed: 0, reconciled: 0 }],
  ["sweepPendingFinalizations", { claimed: 0, finalized: 0 }],
] as const;

describe("financial payment service shutdown claims", () => {
  it.each(sweeps)("%s returns without claiming when the shutdown signal is already aborted", async (sweep, expected) => {
    const controller = new AbortController();
    controller.abort();
    const service = createSupabasePaymentService("http://127.0.0.1:9", "test-publishable-key", "test-service-role-key", vnpay, "https://sandbox.test/transaction", fetch, { signal: controller.signal });
    const fn = service[sweep] as (workerId: string) => Promise<{ data?: unknown; error?: unknown }>;
    const result = await fn("worker-test");
    expect(result.error).toBeNull();
    expect(result.data).toEqual(expected);
  });
});
