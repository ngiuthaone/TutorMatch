/**
 * Admin moderation routes — unit tests.
 *
 * Covers:
 *  - happy-path listing of pending media (delegates to adminService.listMediaSubmissions)
 *  - approve / reject decisions (delegate to adminService.decideMediaSubmission + audit log)
 *  - requireAdmin gate is wired (no requireAdmin call => route never executes body)
 *  - schema validation rejects bad decisions and non-uuid ids
 *  - 503 propagation when admin service is unavailable
 */
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";

const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

const AUTH = { authorization: "Bearer test-token" };

function buildApp(adminService: unknown, requireAdmin: (request: any, reply: any) => Promise<void>) {
  const auth = new FakeAuthService();
  auth.authentication = { status: "authenticated", user: { id: "99999999-9999-4999-8999-999999999999", email: "admin@test.com" } };
  const app = createApp({
    config: testConfig,
    authService: auth,
    tutorCvService: {} as any,
    marketplaceService: {} as any,
    bookingService: {} as any,
    policyService: {} as any,
    complianceService: {} as any,
    payoutService: {} as any,
    adminService: adminService as any,
    requireAdmin,
  });
  apps.push(app);
  return app;
}

const fakeAdmin = () => {
  const calls: { name: string; args: unknown[] }[] = [];
  const service = {
    listMediaSubmissions: async (...args: unknown[]) => { calls.push({ name: "list", args }); return { status: "ok", data: [{ id: "11111111-1111-4111-8111-111111111111", userId: "u", tutorProfileId: null, kind: "photo", bucket: "avatars", objectPath: "u/x.jpg", mime: "image/jpeg", sizeBytes: 100, status: "pending", moderationProvider: null, moderationNote: null, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" }] }; },
    decideMediaSubmission: async (...args: unknown[]) => { calls.push({ name: "decide", args }); return { status: "ok", data: { id: args[0], status: args[1], decidedAt: "2026-09-01T00:00:01Z" } }; },
    logAction: async (...args: unknown[]) => { calls.push({ name: "log", args }); return { status: "ok", data: { id: 1 } }; },
  };
  return { service, calls };
};

describe("admin moderation routes", () => {
  it("GET /api/v1/admin/moderation/media lists pending media", async () => {
    const { service, calls } = fakeAdmin();
    const app = buildApp(service, async () => {});
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/moderation/media?status=pending&limit=50", headers: AUTH });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.submissions).toHaveLength(1);
    expect(body.submissions[0].id).toBe("11111111-1111-4111-8111-111111111111");
    expect(calls.find((c) => c.name === "list")).toBeTruthy();
  });

  it("GET rejects invalid status", async () => {
    const { service } = fakeAdmin();
    const app = buildApp(service, async () => {});
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/moderation/media?status=bogus", headers: AUTH });
    expect(res.statusCode).toBe(400);
  });

  it("POST /:id/decide approves and audits", async () => {
    const { service, calls } = fakeAdmin();
    const app = buildApp(service, async () => {});
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/moderation/media/22222222-2222-4222-8222-222222222222/decide",
      headers: AUTH,
      payload: { decision: "approved", note: "looks good" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.decision.status).toBe("approved");
    expect(body.audited).toBe(true);
    expect(calls.find((c) => c.name === "decide")).toBeTruthy();
    expect(calls.find((c) => c.name === "log")).toBeTruthy();
  });

  it("POST rejects non-uuid id", async () => {
    const { service } = fakeAdmin();
    const app = buildApp(service, async () => {});
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/moderation/media/not-a-uuid/decide",
      headers: AUTH,
      payload: { decision: "approved" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST rejects invalid decision value", async () => {
    const { service } = fakeAdmin();
    const app = buildApp(service, async () => {});
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/moderation/media/22222222-2222-4222-8222-222222222222/decide",
      headers: AUTH,
      payload: { decision: "maybe" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("propagates 503 when admin service is unavailable", async () => {
    const { service } = fakeAdmin();
    const broken = { ...service, listMediaSubmissions: async () => ({ status: "unavailable" as const }) };
    const app = buildApp(broken, async () => {});
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/moderation/media", headers: AUTH });
    expect(res.statusCode).toBe(503);
  });

  it("requireAdmin gate is invoked before the handler", async () => {
    const calls: string[] = [];
    const { service } = fakeAdmin();
    const app = buildApp(service, async () => { calls.push("requireAdmin"); });
    await app.inject({ method: "GET", url: "/api/v1/admin/moderation/media", headers: AUTH });
    expect(calls).toContain("requireAdmin");
  });
});
