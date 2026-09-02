import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";
import type { SearchService } from "../src/services/search-service.js";
import type { ThreadService } from "../src/services/thread-service.js";

const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

const THREAD_ID = "11111111-1111-4111-8111-111111111111";

function fakeSearchService(): SearchService {
  return {
    searchAll: async (q: string) => ({
      status: "ok",
      data: {
        posts: q ? [{ id: "p1", body: `Result for ${q}`, like_count: 0, comment_count: 0, created_at: new Date().toISOString() }] : [],
        threads: [],
        communities: [],
        nextCursor: null,
      },
    }),
  } as unknown as SearchService;
}

function fakeThreadService(): ThreadService {
  return {
    create: async () => ({ status: "ok", data: { id: THREAD_ID, status: "published" } }),
    listPublic: async () => ({ status: "ok", data: { threads: [], nextCursor: null } }),
    getPublic: async () => ({ status: "ok", data: { id: THREAD_ID, title: "Test" } }),
    listReplies: async () => ({ status: "ok", data: { replies: [] } }),
    reply: async () => ({ status: "ok", data: { id: "55555555-5555-4555-8555-555555555555", depth: 1, status: "published" } }),
    close: async () => ({ status: "ok", data: { id: THREAD_ID, status: "closed" } }),
    reopen: async () => ({ status: "ok", data: { id: THREAD_ID, status: "published" } }),
    update: async () => ({ status: "ok", data: { id: THREAD_ID, status: "published" } }),
    deleteThread: async () => ({ status: "ok", data: { id: THREAD_ID, status: "deleted" } }),
    deleteReply: async () => ({ status: "ok", data: { id: "55555555-5555-4555-8555-555555555555", status: "deleted" } }),
    appreciate: async () => ({ status: "ok", data: { target_type: "thread", target_id: THREAD_ID, appreciated_count: 1, appreciated_by_me: true } }),
    unappreciate: async () => ({ status: "ok", data: { target_type: "thread", target_id: THREAD_ID, appreciated_count: 0, appreciated_by_me: false } }),
    report: async () => ({ status: "ok", data: { id: "66666666-6666-4666-8666-666666666666", status: "pending" } }),
  } as unknown as ThreadService;
}

function createTestApp(service: FakeAuthService, searchService?: SearchService, threadService?: ThreadService) {
  const app = createApp({
    config: testConfig,
    authService: service,
    searchService: searchService ?? fakeSearchService(),
    threadService: threadService ?? fakeThreadService(),
  });
  apps.push(app);
  return app;
}

describe("search route", () => {
  it("requires q parameter (400)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: "/api/v1/search" });
    expect(res.statusCode).toBe(400);
  });

  it("accepts q parameter (200)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: "/api/v1/search?q=ielts" });
    expect(res.statusCode).toBe(200);
    expect(res.json().posts).toBeDefined();
  });

  it("accepts kind filter (200)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: "/api/v1/search?q=test&kind=communities" });
    expect(res.statusCode).toBe(200);
  });

  it("accepts limit parameter (200)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: "/api/v1/search?q=test&limit=5" });
    expect(res.statusCode).toBe(200);
  });

  it("returns 503 when service unavailable", async () => {
    const service = new FakeAuthService();
    const ss = { searchAll: async () => ({ status: "unavailable" }) } as unknown as SearchService;
    const app = createTestApp(service, ss);
    const res = await app.inject({ method: "GET", url: "/api/v1/search?q=test" });
    expect(res.statusCode).toBe(503);
  });
});

describe("update thread route", () => {
  it("rejects unauthenticated update (401)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "PATCH", url: `/api/v1/threads/${THREAD_ID}`, payload: { title: "New" } });
    expect(res.statusCode).toBe(401);
  });

  it("updates thread with valid auth (200)", async () => {
    const s = new FakeAuthService();
    s.authentication = { status: "authenticated", user: { id: "user-1", email: "test@example.com" } };
    const app = createTestApp(s);
    const res = await app.inject({
      method: "PATCH", url: `/api/v1/threads/${THREAD_ID}`,
      headers: { authorization: "Bearer tok-ok" },
      payload: { title: "Updated title", body: "Updated body" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("validates body (400 on empty title)", async () => {
    const s = new FakeAuthService();
    s.authentication = { status: "authenticated", user: { id: "user-1", email: "test@example.com" } };
    const app = createTestApp(s);
    const res = await app.inject({
      method: "PATCH", url: `/api/v1/threads/${THREAD_ID}`,
      headers: { authorization: "Bearer tok-ok" },
      payload: { title: "" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects invalid UUID (404)", async () => {
    const s = new FakeAuthService();
    s.authentication = { status: "authenticated", user: { id: "user-1", email: "test@example.com" } };
    const app = createTestApp(s);
    const res = await app.inject({
      method: "PATCH", url: "/api/v1/threads/not-a-uuid",
      headers: { authorization: "Bearer tok-ok" },
      payload: { title: "New" },
    });
    expect(res.statusCode).toBe(404);
  });
});
