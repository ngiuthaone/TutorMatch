/**
 * App composition test — proves the merged server simultaneously registers
 * BOTH legacy production routes AND Section 12 routes.
 *
 * This test exists specifically to prevent another destructive app.ts/server.ts
 * replacement that drops either route set.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";

const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function createMergedApp() {
  const service = new FakeAuthService();
  const app = createApp({
    config: testConfig,
    authService: service,
    tutorCvService: {} as any,
    marketplaceService: {} as any,
    bookingService: {} as any,
    policyService: {} as any,
    complianceService: {} as any,
    payoutService: {} as any,
    adminService: {} as any,
    requireAdmin: async () => {},
  });
  apps.push(app);
  return app;
}

describe("app composition — legacy production routes preserved", () => {
  it("registers health route", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(res.statusCode).toBe(200);
  });

  it("registers booking routes", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/bookings", payload: {} });
    expect(res.statusCode).not.toBe(404);
  });

  it("registers payment routes when VNPAY is configured", async () => {
    const service = new FakeAuthService();
    const app = createApp({
      config: {
        ...testConfig,
        VNPAY_TMN_CODE: "test",
        VNPAY_HASH_SECRET: "test",
        VNPAY_RETURN_URL: "https://test.com/return",
        VNPAY_IPN_URL: "https://test.com/ipn",
      },
      authService: service,
      tutorCvService: {} as any,
      marketplaceService: {} as any,
      bookingService: {} as any,
      policyService: {} as any,
      complianceService: {} as any,
      payoutService: {} as any,
      adminService: {} as any,
      requireAdmin: async () => {},
    });
    apps.push(app);
    const res = await app.inject({ method: "POST", url: "/api/v1/payments/start", payload: {} });
    expect(res.statusCode).not.toBe(404);
  });

  it("registers session routes", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/sessions" });
    expect(res.statusCode).not.toBe(404);
  });

  it("registers tutor CV routes", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/me/tutor-cv" });
    expect(res.statusCode).not.toBe(404);
  });

  it("registers public tutor routes", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/tutors" });
    expect(res.statusCode).not.toBe(404);
  });

  it("registers marketplace routes", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/marketplace/course" });
    expect(res.statusCode).not.toBe(404);
  });
});

describe("app composition — Section 12 routes registered", () => {
  it("registers policy list route (public)", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/policies" });
    expect(res.statusCode).not.toBe(404);
  });

  it("registers policy accept route", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/policies/accept", payload: {} });
    expect(res.statusCode).not.toBe(404);
  });

  it("registers policy check route", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/policies/check?type=terms_of_service" });
    expect(res.statusCode).not.toBe(404);
  });

  it("registers policy my-acceptances route", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/policies/my-acceptances" });
    expect(res.statusCode).not.toBe(404);
  });

  it("registers host-compliance route", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/host-compliance" });
    expect(res.statusCode).not.toBe(404);
  });

  it("registers host-compliance payout-eligible route", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/host-compliance/payout-eligible" });
    expect(res.statusCode).not.toBe(404);
  });

  it("registers payouts route", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/payouts" });
    expect(res.statusCode).not.toBe(404);
  });

  it("registers admin audit-log route", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/audit-log" });
    expect(res.statusCode).not.toBe(404);
  });

  it("registers admin search users route", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/search/users?q=test" });
    expect(res.statusCode).not.toBe(404);
  });

  it("registers admin disputes route", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/disputes" });
    expect(res.statusCode).not.toBe(404);
  });

  it("registers admin host-cancellations route", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/host-cancellations" });
    expect(res.statusCode).not.toBe(404);
  });

  it("registers dashboard overview route", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/dashboard/overview" });
    expect(res.statusCode).not.toBe(404);
  });
});

describe("app composition — non-existent routes still 404", () => {
  it("returns 404 for unknown routes", async () => {
    const app = createMergedApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/unknown" });
    expect(res.statusCode).toBe(404);
  });
});
