import { describe, expect, it } from "vitest";
import { buildVnpayPaymentUrl, buildVnpayTransactionRequest, executeVnpayTransaction, normalizeVnpayOutcome, verifyVnpayFields } from "../src/services/vnpay-adapter.js";

const config = { tmnCode: "TUTORIA01", hashSecret: "local-secret", paymentUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html", returnUrl: "https://app.test/payments/return", ipnUrl: "https://api.test/payments/ipn" };

describe("VNPay provider boundary", () => {
  it("builds a signed server-owned VND payment URL", () => {
    const url = buildVnpayPaymentUrl(config, { merchantReference: "TUTORIA-abc", amountVnd: 125000, orderInfo: "Tutoria booking", createdAt: new Date("2026-08-14T10:11:12Z") });
    const fields = Object.fromEntries(new URL(url).searchParams.entries());
    expect(fields.vnp_Amount).toBe("12500000");
    expect(fields.vnp_TxnRef).toBe("TUTORIA-abc");
    expect(verifyVnpayFields(fields, config.hashSecret)).toBe(true);
    expect(verifyVnpayFields({ ...fields, vnp_Amount: "1" }, config.hashSecret)).toBe(false);
  });
  it("normalizes provider success without treating a browser return as authority", () => {
    expect(normalizeVnpayOutcome({ vnp_TxnRef: "TUTORIA-abc", vnp_ResponseCode: "00", vnp_TransactionNo: "123", vnp_Amount: "12500000" })).toEqual({ outcome: "succeeded", eventKey: "return:TUTORIA-abc:123", merchantReference: "TUTORIA-abc", providerTransactionNo: "123", amountVnd: 125000 });
  });
  it("builds auditable full/partial refund and query requests without exposing a customer refund command", () => {
    const refund = buildVnpayTransactionRequest(config, { requestId: "refund-request-0001", command: "refund", merchantReference: "TUTORIA-abc", amountVnd: 125000, transactionNo: "123", transactionType: "02", orderInfo: "system compensation", createdAt: new Date("2026-08-14T10:11:12Z") });
    expect(refund.body.vnp_Amount).toBe("12500000"); expect(refund.body.vnp_TransactionType).toBe("02"); expect(refund.body.vnp_SecureHash).toMatch(/^[a-f0-9]{128}$/);
    const query = buildVnpayTransactionRequest(config, { requestId: "query-request-0001", command: "querydr", merchantReference: "TUTORIA-abc", amountVnd: 125000, orderInfo: "reconciliation", createdAt: new Date("2026-08-14T10:11:12Z") });
    expect(query.body.vnp_Command).toBe("querydr"); expect(query.body.vnp_SecureHash).toMatch(/^[a-f0-9]{128}$/);
  });
  it("normalizes a provider HTTP response boundary and preserves transport failures for reconciliation", async () => {
    const request = buildVnpayTransactionRequest(config, { requestId: "query-request-0002", command: "querydr", merchantReference: "TUTORIA-abc", amountVnd: 125000, orderInfo: "reconciliation", createdAt: new Date("2026-08-14T10:11:12Z") });
    const body = await executeVnpayTransaction("https://sandbox.test/transaction", request, async () => new Response(JSON.stringify({ vnp_ResponseCode: "00", vnp_TxnRef: "TUTORIA-abc", vnp_TransactionNo: "123", vnp_Amount: "12500000" }), { status: 200 }));
    expect(normalizeVnpayOutcome(body).outcome).toBe("succeeded");
    await expect(executeVnpayTransaction("https://sandbox.test/transaction", request, async () => new Response("timeout", { status: 504 }))).rejects.toThrow("HTTP 504");
  });
});
