// backend/test/admin-conversation-reports-route.test.ts
// Unit test for the new admin moderation routes for conversation reports.

import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";

const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

const REPORT = {
  id: "77777777-7777-4777-8777-777777777777",
  reporterId: "11111111-1111-4111-8111-111111111111",
  conversationId: "33333333-3333-4333-8333-333333333333",
  messageId: "55555555-5555-4555-8555-555555555555",
  reason: "spam",
  details: "Looks like spam",
  status: "pending",
  resolvedBy: null,
  resolvedAt: null,
  createdAt: "2026-09-02T12:00:00.000Z",
  reporter: { id: "11111111-1111-4111-8111-111111111111", name: "Test user" },
  message_preview: { id: "55555555-5555-4555-8555-555555555555", body: "Spam content", createdAt: "2026-09-02T11:30:00.000Z" },
};

const ADMIN_USER = { id: "99999999-9999-4999-8999-999999999999", email: "admin@example.test", role: "admin" };

function setup(overrides: Record<string, unknown> = {}, authenticated = true) {
  const calls: Array<{ name: string; args: unknown[] }> = [];
  // Provide a fake admin service that satisfies both the existing media
  // moderation surface and the new conversation-report surface. The two
  // surfaces share the same adminService instance in production.
  const adminService = {
    listMediaSubmissions: async (...args: unknown[]) => { calls.push({ name: "listMediaSubmissions", args }); return { status: "ok" as const, data: [] }; },
    decideMediaSubmission: async (...args: unknown[]) => { calls.push({ name: "decideMediaSubmission", args }); return { status: "ok" as const, data: { id: "media-id", status: "approved", decidedAt: "2026-09-02T12:00:00Z" } }; },
    listConversationReports: async (...args: unknown[]) => { calls.push({ name: "listConversationReports", args }); return { status: "ok" as const, data: [REPORT] }; },
    resolveConversationReport: async (...args: unknown[]) => { calls.push({ name: "resolveConversationReport", args }); return { status: "ok" as const, data: { id: REPORT.id, status: "resolved", resolvedBy: ADMIN_USER.id, resolvedAt: "2026-09-02T12:30:00.000Z" } }; },
    logAction: async (...args: unknown[]) => { calls.push({ name: "logAction", args }); return { status: "ok" as const, data: { id: 42 } }; },
    searchAuditLog: async (...args: unknown[]) => { calls.push({ name: "searchAuditLog", args }); return { status: "ok" as const, data: [] }; },
    searchUsers: async (...args: unknown[]) => { calls.push({ name: "searchUsers", args }); return { status: "ok" as const, data: [] }; },
    searchDisputes: async (...args: unknown[]) => { calls.push({ name: "searchDisputes", args }); return { status: "ok" as const, data: [] }; },
    searchHostCancellations: async (...args: unknown[]) => { calls.push({ name: "searchHostCancellations", args }); return { status: "ok" as const, data: [] }; },
    ...overrides,
  };
  const authService = new FakeAuthService();
  if (authenticated) {
    authService.authentication = { status: "authenticated", user: ADMIN_USER };
  }
  // requireAdmin is the app's admin guard, but the test bypasses it by
  // faking the user with role=admin and the auth service's hasRole.
  // The guard is wired by the app.ts for the admin routes; here we just
  // make the app construct with the fake admin service so the
  // admin-moderation routes are mounted.
  const fakeRequireAdmin = async () => undefined;
  const app = createApp({
    config: testConfig,
    authService,
    adminService,
    requireAdmin: fakeRequireAdmin,
  });
  apps.push(app);
  return { app, calls, adminService };
}

const auth = { authorization: "Bearer admin-token" };

describe("admin conversation-report moderation routes", () => {
  it("requires authentication for every endpoint", async () => {
    const { app } = setup({}, false);
    const urls = [
      { method: "GET",  url: "/api/v1/admin/moderation/reports" },
      { method: "POST", url: `/api/v1/admin/moderation/reports/${REPORT.id}/resolve` },
    ];
    for (const req of urls) {
      const response = await app.inject({ method: req.method as "GET" | "POST", url: req.url });
      expect(response.statusCode).toBe(401);
    }
  });

  it("lists conversation reports with the default status filter", async () => {
    const { app, calls } = setup();
    const r = await app.inject({ method: "GET", url: "/api/v1/admin/moderation/reports", headers: auth });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ ok: true, reports: [{ id: REPORT.id }] });
    expect(calls.find((c) => c.name === "listConversationReports")).toBeDefined();
  });

  it("resolves a single conversation report with status=resolved", async () => {
    const { app, calls } = setup();
    const r = await app.inject({
      method: "POST",
      url: `/api/v1/admin/moderation/reports/${REPORT.id}/resolve`,
      headers: auth,
      payload: { status: "resolved", details: "Reviewed; user warned" },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body).toMatchObject({ ok: true, decision: { id: REPORT.id, status: "resolved" } });
    const resolveCall = calls.find((c) => c.name === "resolveConversationReport");
    // args is the variadic tuple passed by the method call. The mock object
    // does not capture `this` as the first arg because the property is an
    // arrow-like rest fn. Assert on the trailing args instead.
    expect(resolveCall?.args).toEqual([REPORT.id, "resolved", "Reviewed; user warned"]);
    const auditCall = calls.find((c) => c.name === "logAction");
    expect(auditCall?.args[0]).toBe("conversation_report.resolved");
  });

  it("maps unavailable service results to 503", async () => {
    const { app } = setup({
      listConversationReports: async () => ({ status: "unavailable" }),
    });
    const r = await app.inject({ method: "GET", url: "/api/v1/admin/moderation/reports", headers: auth });
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("rejects an invalid report id with 400", async () => {
    const { app } = setup();
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/admin/moderation/reports/not-a-uuid/resolve",
      headers: auth,
      payload: { status: "resolved" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("rejects an invalid status with 400", async () => {
    const { app } = setup();
    const r = await app.inject({
      method: "POST",
      url: `/api/v1/admin/moderation/reports/${REPORT.id}/resolve`,
      headers: auth,
      payload: { status: "invalid" },
    });
    expect(r.statusCode).toBe(400);
  });
});
