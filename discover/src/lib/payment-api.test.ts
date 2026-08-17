import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSessionAccessTokenMock = vi.hoisted(() => vi.fn<() => string | null>(() => "learner-token"));
const getApiBaseUrlMock = vi.hoisted(() => vi.fn(() => "http://api.example.com"));

vi.mock("@/lib/auth/session", () => ({ getSessionAccessToken: getSessionAccessTokenMock }));
vi.mock("@/lib/auth/config", () => ({ getApiBaseUrl: getApiBaseUrlMock }));

import { resetPaymentIdempotencyForTests, startPayment } from "@/lib/payment-api";

describe("payment-api", () => {
  beforeEach(() => {
    resetPaymentIdempotencyForTests();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends only the booking identity and idempotency key", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, payment: { redirectUrl: "https://sandbox.vnpayment.vn/payment?opaque=1" } }), { status: 200 }));
    await startPayment("99999999-8888-4777-8666-555555555555");
    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body).toEqual(expect.objectContaining({ bookingId: "99999999-8888-4777-8666-555555555555", idempotencyKey: expect.any(String) }));
    expect(body).not.toHaveProperty("amount");
    expect(body).not.toHaveProperty("currency");
  });

  it("returns the provider URL unchanged", async () => {
    const redirectUrl = "https://sandbox.vnpayment.vn/payment?vnp_Amount=30000000&vnp_SecureHash=opaque";
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, payment: { redirectUrl } }), { status: 200 }));
    await expect(startPayment("99999999-8888-4777-8666-555555555555")).resolves.toEqual({ redirectUrl });
  });

  it("uses the same idempotency key if a duplicate interaction reaches the client", async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ ok: true, payment: { redirectUrl: "https://provider.test/1" } }), { status: 200 }));
    const first = startPayment("99999999-8888-4777-8666-555555555555");
    const second = startPayment("99999999-8888-4777-8666-555555555555");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    await Promise.all([first, second]);
    const firstBody = JSON.parse(String((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body));
    const secondBody = JSON.parse(String((vi.mocked(fetch).mock.calls[1]?.[1] as RequestInit).body));
    expect(firstBody.idempotencyKey).toBe(secondBody.idempotencyKey);
  });
});
