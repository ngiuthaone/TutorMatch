import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";
import type { ThreadService } from "../src/services/thread-service.js";

const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function fakeThreadService(): ThreadService {
  const id = "11111111-1111-4111-8111-111111111111";
  return {
    create: async () => ({ status: "ok", data: { id, status: "published" } }),
    listPublic: async () => ({ status: "ok", data: { threads: [], nextCursor: null } }),
    getPublic: async () => ({ status: "ok", data: { id, title: "Test thread" } }),
    listReplies: async () => ({ status: "ok", data: { replies: [] } }),
    reply: async () => ({ status: "ok", data: { id: "22222222-2222-4222-8222-222222222222", depth: 1, status: "published" } }),
    close: async () => ({ status: "ok", data: { id, status: "closed" } }),
    reopen: async () => ({ status: "ok", data: { id, status: "published" } }),
    deleteThread: async () => ({ status: "ok", data: { id, status: "deleted" } }),
    deleteReply: async () => ({ status: "ok", data: { id, status: "deleted" } }),
    appreciate: async () => ({ status: "ok", data: { target_type: "thread", target_id: id, appreciated_count: 1, appreciated_by_me: true } }),
    unappreciate: async () => ({ status: "ok", data: { target_type: "thread", target_id: id, appreciated_count: 0, appreciated_by_me: false } }),
    report: async () => ({ status: "ok", data: { id: "33333333-3333-4333-8333-333333333333", status: "pending" } }),
  } as unknown as ThreadService;
}

const THREAD_ID = "11111111-1111-4111-8111-111111111111";

function createTestApp(service: FakeAuthService, threadService?: ThreadService) {
  const app = createApp({
    config: testConfig,
    authService: service,
    threadService: threadService ?? fakeThreadService(),
  });
  apps.push(app);
  return app;
}

function authed() {
  const service = new FakeAuthService();
  service.authentication = { status: "authenticated", user: { id: "user-1", email: "test@example.com" } };
  return { service, token: "tok-ok" };
}

describe("threads route auth gating", () => {
  it("rejects POST /api/v1/threads without auth (401)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/threads",
      payload: { title: "Test", anchorType: "external_url", anchorUrl: "https://example.com" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("allows GET /api/v1/threads without auth (200)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: "/api/v1/threads" });
    expect(res.statusCode).toBe(200);
    expect(res.json().threads).toEqual([]);
  });

  it("creates a thread with valid auth (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/threads",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Test thread", anchorType: "external_url", anchorUrl: "https://example.com" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(THREAD_ID);
  });

  it("validates thread body (400 on empty title)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/threads",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "", anchorType: "external_url" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("validates external URL format (400 on javascript: URL)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/threads",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Bad", anchorType: "external_url", anchorUrl: "javascript:alert(1)" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects HTTP URL for external anchor (400)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/threads",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Bad", anchorType: "external_url", anchorUrl: "ftp://example.com" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("gets thread detail (200, public)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: `/api/v1/threads/${THREAD_ID}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe("Test thread");
  });

  it("replies to a thread (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: `/api/v1/threads/${THREAD_ID}/replies`,
      headers: { authorization: `Bearer ${token}` },
      payload: { body: "My reply" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().depth).toBe(1);
  });

  it("appreciates a thread (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/threads/appreciate",
      headers: { authorization: `Bearer ${token}` },
      payload: { targetType: "thread", targetId: THREAD_ID },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().appreciated_by_me).toBe(true);
  });

  it("closes thread (owner, 200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "PATCH", url: `/api/v1/threads/${THREAD_ID}/close`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("closed");
  });

  it("deletes thread (owner, 200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "DELETE", url: `/api/v1/threads/${THREAD_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("deleted");
  });

  it("submits a report (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/threads/report",
      headers: { authorization: `Bearer ${token}` },
      payload: { targetType: "thread", targetId: THREAD_ID, reason: "Spam content" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("pending");
  });

  it("returns 404 for non-existent thread on close (service-level)", async () => {
    const { service, token } = authed();
    const ts = fakeThreadService();
    ts.close = async () => ({ status: "not_found" });
    const app = createTestApp(service, ts);
    const res = await app.inject({
      method: "PATCH", url: `/api/v1/threads/${THREAD_ID}/close`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("thread-service error mapping", () => {
  it("maps unavailable on RPC failure", async () => {
    const { createSupabaseThreadService } = await import("../src/services/thread-service.js");
    const svc = createSupabaseThreadService("https://x.supabase.co", "key", {} as any);
    const result = await (svc as any).listPublic(null, 20);
    expect(result.status).toBe("unavailable");
  });
});
