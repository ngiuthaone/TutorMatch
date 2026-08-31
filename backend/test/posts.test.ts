import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";
import type { PostService } from "../src/services/post-service.js";

const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function fakePostService(): PostService {
  return {
    create: async () => ({ status: "ok", data: { id: "11111111-1111-4111-8111-111111111111", status: "published" } }),
    update: async () => ({ status: "ok", data: { id: "11111111-1111-4111-8111-111111111111", status: "published" } }),
    delete: async () => ({ status: "ok", data: { id: "11111111-1111-4111-8111-111111111111", status: "deleted" } }),
    getPublic: async () => ({ status: "ok", data: { id: "11111111-1111-4111-8111-111111111111", body: "Hello", author: { name: "Test" } } }),
    listPublic: async () => ({ status: "ok", data: { posts: [], nextCursor: null } }),
    listMyPosts: async () => ({ status: "ok", data: { posts: [] } }),
    repost: async () => ({ status: "ok", data: { post_id: "11111111-1111-4111-8111-111111111111", repost_count: 1, reposted_by_me: true } }),
    unrepost: async () => ({ status: "ok", data: { post_id: "11111111-1111-4111-8111-111111111111", repost_count: 0, reposted_by_me: false } }),
  } as unknown as PostService;
}

const POST_ID = "11111111-1111-4111-8111-111111111111";

function createTestApp(service: FakeAuthService, postService?: PostService) {
  const app = createApp({
    config: testConfig,
    authService: service,
    postService: postService ?? fakePostService(),
  });
  apps.push(app);
  return app;
}

function authed() {
  const service = new FakeAuthService();
  service.authentication = {
    status: "authenticated",
    user: {
      id: "user-1",
      email: "test@example.com",
    },
  };
  return { service, token: "tok-ok" };
}

describe("posts route auth gating", () => {
  it("rejects POST /api/v1/posts without auth (401)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "POST", url: "/api/v1/posts", payload: { body: "Hello" } });
    expect(res.statusCode).toBe(401);
  });

  it("allows GET /api/v1/posts without auth (public)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: "/api/v1/posts" });
    expect(res.statusCode).toBe(200);
    expect(res.json().posts).toEqual([]);
  });

  it("validates post create body (400 on empty body)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({ method: "POST", url: "/api/v1/posts", headers: { authorization: `Bearer ${token}` }, payload: { body: "" } });
    expect(res.statusCode).toBe(400);
  });

  it("creates a post with valid payload (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/posts",
      headers: { authorization: `Bearer ${token}` },
      payload: { body: "Hello world", tags: ["Tech"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(POST_ID);
  });

  it("gets a public post (200)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: `/api/v1/posts/${POST_ID}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().body).toBe("Hello");
  });

  it("reposts a post (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({ method: "POST", url: `/api/v1/posts/${POST_ID}/repost`, headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().reposted_by_me).toBe(true);
  });

  it("unreposts a post (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({ method: "DELETE", url: `/api/v1/posts/${POST_ID}/repost`, headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().reposted_by_me).toBe(false);
  });

  it("lists my posts (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: "/api/v1/posts/mine", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().posts).toEqual([]);
  });

  it("deletes a post (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({ method: "DELETE", url: `/api/v1/posts/${POST_ID}`, headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("deleted");
  });

  it("returns 404 for non-existent post", async () => {
    const service = new FakeAuthService();
    const ps = fakePostService();
    ps.getPublic = async () => ({ status: "not_found" });
    const app = createTestApp(service, ps);
    const res = await app.inject({ method: "GET", url: "/api/v1/posts/00000000-0000-0000-0000-000000000000" });
    expect(res.statusCode).toBe(404);
  });
});

describe("post-service error mapping", () => {
  it("maps create errors correctly", async () => {
    const { createSupabasePostService } = await import("../src/services/post-service.js");
    const svc = createSupabasePostService("https://x.supabase.co", "key", {} as any);
    const invalid = await (svc as any).create("tok", { body: "" });
    expect(invalid.status).toBe("unavailable");
  });
});
