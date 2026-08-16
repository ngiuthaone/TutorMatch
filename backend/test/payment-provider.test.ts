import { describe, expect, it } from "vitest";
import { buildVnpayPaymentUrl, buildVnpayTransactionRequest, classifyVnpayRefundOutcome, executeVnpayTransaction, formatVnpayDateTime, normalizeVnpayOutcome, verifyVnpayFields } from "../src/services/vnpay-adapter.js";

const config = { tmnCode: "TUTORIA01", hashSecret: "local-secret", paymentUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html", returnUrl: "https://frontend.test/payments/return", ipnUrl: "https://api.test/api/v1/payments/vnpay/ipn" };

describe("VNPay provider boundary", () => {
  it("builds a signed server-owned VND payment URL", () => {
    const url = buildVnpayPaymentUrl(config, { merchantReference: "TUTORIA-abc", amountVnd: 125000, orderInfo: "Tutoria booking", createdAt: new Date("2026-08-14T10:11:12Z") });
    const fields = Object.fromEntries(new URL(url).searchParams.entries());
    expect(fields.vnp_Amount).toBe("12500000");
    expect(fields.vnp_TxnRef).toBe("TUTORIA-abc");
    expect(verifyVnpayFields(fields, config.hashSecret)).toBe(true);
    expect(verifyVnpayFields({ ...fields, vnp_Amount: "1" }, config.hashSecret)).toBe(false);
  });
  it("signs a booking-correlated return URL supplied by the payment service", () => {
    const url = buildVnpayPaymentUrl(config, { merchantReference: "TUTORIA-abc", amountVnd: 125000, orderInfo: "Tutoria booking", returnUrl: "https://app.test/payments/return?bookingId=booking-1", createdAt: new Date("2026-08-14T10:11:12Z") });
    const fields = Object.fromEntries(new URL(url).searchParams.entries());
    expect(fields.vnp_ReturnUrl).toBe("https://frontend.test/payments/return?bookingId=booking-1");
    expect(fields.vnp_IpnUrl).toBe("https://api.test/api/v1/payments/vnpay/ipn");
    expect(verifyVnpayFields(fields, config.hashSecret)).toBe(true);
  });
  it("normalizes provider success without treating a browser return as authority", () => {
    expect(normalizeVnpayOutcome({ vnp_TxnRef: "TUTORIA-abc", vnp_ResponseCode: "00", vnp_TransactionNo: "123", vnp_Amount: "12500000" })).toEqual({ outcome: "succeeded", eventKey: "return:TUTORIA-abc:123", merchantReference: "TUTORIA-abc", providerTransactionNo: "123", amountVnd: 125000 });
  });
  it("builds auditable full/partial refund and query requests without exposing a customer refund command", () => {
    const refund = buildVnpayTransactionRequest(config, { requestId: "refund-request-0001", command: "refund", merchantReference: "TUTORIA-abc", amountVnd: 125000, transactionNo: "123", transactionType: "02", orderInfo: "system compensation", createdAt: new Date("2026-08-14T10:11:12Z") });
    expect(refund.body.vnp_Amount).toBe("12500000"); expect(refund.body.vnp_TransactionType).toBe("02"); expect(refund.body.vnp_SecureHash).toMatch(/^[a-f0-9]{128}$/);
    const query = buildVnpayTransactionRequest(config, { requestId: "query-request-0001", command: "querydr", merchantReference: "TUTORIA-abc", amountVnd: 125000, orderInfo: "reconciliation", createdAt: new Date("2026-08-14T10:11:12Z") });
    expect(query.body.vnp_Command).toBe("querydr"); expect(query.body.vnp_SecureHash).toMatch(/^[a-f0-9]{128}$/);
    const queryWithTxn = buildVnpayTransactionRequest(config, { requestId: "query-request-0003", command: "querydr", merchantReference: "TUTORIA-abc", amountVnd: 125000, transactionNo: "123", orderInfo: "reconciliation", createdAt: new Date("2026-08-14T10:11:12Z") });
    expect(queryWithTxn.body.vnp_TransactionNo).toBe("123");
  });
  it("classifies refund settlement only from vnp_TransactionStatus=00, not a bare request code", () => {
    expect(classifyVnpayRefundOutcome({ vnp_ResponseCode: "00", vnp_TransactionStatus: "00" })).toBe("succeeded");
    expect(classifyVnpayRefundOutcome({ vnp_ResponseCode: "00", vnp_TransactionStatus: "01" })).toBe("pending");
    expect(classifyVnpayRefundOutcome({ vnp_ResponseCode: "00" })).toBe("pending");
    expect(classifyVnpayRefundOutcome({ vnp_ResponseCode: "00", vnp_TransactionStatus: "02" })).toBe("failed");
    expect(classifyVnpayRefundOutcome({ vnp_ResponseCode: "00", vnp_TransactionStatus: "09" })).toBe("failed");
    expect(classifyVnpayRefundOutcome({ vnp_ResponseCode: "99", vnp_TransactionStatus: "00" })).toBe("failed");
  });
  it("formats VNPay GMT+7 timestamps for querydr vnp_TransactionDate", () => {
    expect(formatVnpayDateTime(new Date("2026-08-14T10:11:12Z"))).toBe("20260814171112");
    expect(formatVnpayDateTime(new Date("2026-01-05T23:59:59Z"))).toBe("20260106065959");
  });
  it("normalizes a provider HTTP response boundary and preserves transport failures for reconciliation", async () => {
    const request = buildVnpayTransactionRequest(config, { requestId: "query-request-0002", command: "querydr", merchantReference: "TUTORIA-abc", amountVnd: 125000, orderInfo: "reconciliation", createdAt: new Date("2026-08-14T10:11:12Z") });
    const body = await executeVnpayTransaction("https://sandbox.test/transaction", request, async () => new Response(JSON.stringify({ vnp_ResponseCode: "00", vnp_TxnRef: "TUTORIA-abc", vnp_TransactionNo: "123", vnp_Amount: "12500000" }), { status: 200 }));
    expect(normalizeVnpayOutcome(body).outcome).toBe("succeeded");
    await expect(executeVnpayTransaction("https://sandbox.test/transaction", request, async () => new Response("timeout", { status: 504 }))).rejects.toThrow("HTTP 504");
  });

  it("bounds a provider request and preserves shutdown abort as an unknown outcome", async () => {
    const request = buildVnpayTransactionRequest(config, { requestId: "query-request-timeout", command: "querydr", merchantReference: "TUTORIA-abc", amountVnd: 125000, orderInfo: "reconciliation", createdAt: new Date("2026-08-14T10:11:12Z") });
    const hangingFetch: typeof fetch = async (_url, init) => await new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
    await expect(executeVnpayTransaction("https://sandbox.test/transaction", request, hangingFetch, 5)).rejects.toThrow("timed out after 5ms");
    const shutdown = new AbortController();
    const aborted = executeVnpayTransaction("https://sandbox.test/transaction", request, hangingFetch, 1000, shutdown.signal);
    shutdown.abort();
    await expect(aborted).rejects.toThrow("aborted during worker shutdown");
  });
});
