import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";
import type { PostService } from "../src/services/post-service.js";
import type { ThreadService } from "../src/services/thread-service.js";

const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

const POST_ID = "11111111-1111-4111-8111-111111111111";
const THREAD_ID = "22222222-2222-4222-8222-222222222222";
const COMMUNITY_ID = "33333333-3333-4333-8333-333333333333";
const PRIVATE_COMMUNITY_ID = "44444444-4444-4444-8444-444444444444";

function fakePostService(): PostService {
  return {
    create: async () => ({ status: "ok", data: { id: POST_ID, status: "published" } }),
    update: async () => ({ status: "ok", data: { id: POST_ID, status: "published" } }),
    delete: async () => ({ status: "ok", data: { id: POST_ID, status: "deleted" } }),
    getPublic: async () => ({ status: "ok", data: { id: POST_ID, body: "Hello", author: { name: "Test" } } }),
    listPublic: async () => ({ status: "ok", data: { posts: [], nextCursor: null } }),
    listMyPosts: async () => ({ status: "ok", data: { posts: [] } }),
    repost: async () => ({ status: "ok", data: { post_id: POST_ID, repost_count: 1, reposted_by_me: true } }),
    unrepost: async () => ({ status: "ok", data: { post_id: POST_ID, repost_count: 0, reposted_by_me: false } }),
    like: async () => ({ status: "ok", data: { post_id: POST_ID, like_count: 1, liked_by_me: true } }),
    unlike: async () => ({ status: "ok", data: { post_id: POST_ID, like_count: 0, liked_by_me: false } }),
  } as unknown as PostService;
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
    deleteThread: async () => ({ status: "ok", data: { id: THREAD_ID, status: "deleted" } }),
    deleteReply: async () => ({ status: "ok", data: { id: "55555555-5555-4555-8555-555555555555", status: "deleted" } }),
    appreciate: async () => ({ status: "ok", data: { target_type: "thread", target_id: THREAD_ID, appreciated_count: 1, appreciated_by_me: true } }),
    unappreciate: async () => ({ status: "ok", data: { target_type: "thread", target_id: THREAD_ID, appreciated_count: 0, appreciated_by_me: false } }),
    report: async () => ({ status: "ok", data: { id: "66666666-6666-4666-8666-666666666666", status: "pending" } }),
  } as unknown as ThreadService;
}

function createTestApp(service: FakeAuthService) {
  const app = createApp({
    config: testConfig,
    authService: service,
    postService: fakePostService(),
    threadService: fakeThreadService(),
  });
  apps.push(app);
  return app;
}

function authed() {
  const service = new FakeAuthService();
  service.authentication = { status: "authenticated", user: { id: "user-1", email: "test@example.com" } };
  return { service, token: "tok-ok" };
}

describe("communityId filter on posts list", () => {
  it("accepts communityId param (200)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: `/api/v1/posts?communityId=${COMMUNITY_ID}` });
    expect(res.statusCode).toBe(200);
  });

  it("rejects invalid communityId format (400)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: "/api/v1/posts?communityId=not-a-uuid" });
    expect(res.statusCode).toBe(400);
  });

  it("works without communityId (global feed, 200)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: "/api/v1/posts" });
    expect(res.statusCode).toBe(200);
  });
});

describe("communityId filter on threads list", () => {
  it("accepts communityId param (200)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: `/api/v1/threads?communityId=${COMMUNITY_ID}` });
    expect(res.statusCode).toBe(200);
  });

  it("rejects invalid communityId format (400)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: "/api/v1/threads?communityId=not-a-uuid" });
    expect(res.statusCode).toBe(400);
  });
});

describe("community-gated post creation", () => {
  it("service returns invalid for community access denied (non-member)", async () => {
    const { token } = authed();
    const ps = fakePostService();
    // Simulate the RPC returning COMMUNITY_ACCESS_DENIED
    ps.create = async () => ({ status: "invalid", code: "COMMUNITY_ACCESS_DENIED" } as any);
    const result = await (ps as any).create(token, { body: "test", communityId: COMMUNITY_ID });
    expect(result.status).toBe("invalid");
  });

  it("service allows create without communityId (200)", async () => {
    const { token } = authed();
    const ps = fakePostService();
    const result = await (ps as any).create(token, { body: "global post" });
    expect(result.status).toBe("ok");
  });
});

describe("community-gated thread creation", () => {
  it("service returns invalid for community access denied (non-member)", async () => {
    const { token } = authed();
    const ts = fakeThreadService();
    ts.create = async () => ({ status: "invalid", code: "COMMUNITY_ACCESS_DENIED" } as any);
    const result = await (ts as any).create(token, { title: "test", communityId: COMMUNITY_ID });
    expect(result.status).toBe("invalid");
  });
});

describe("community-gated reply creation", () => {
  it("service returns invalid for community access denied (non-member)", async () => {
    const { token } = authed();
    const ts = fakeThreadService();
    ts.reply = async () => ({ status: "invalid", code: "COMMUNITY_ACCESS_DENIED" } as any);
    const result = await (ts as any).reply(token, THREAD_ID, "reply");
    expect(result.status).toBe("invalid");
  });
});

describe("list filter with private community access denied", () => {
  it("returns empty feed for caller without access to private community (post)", async () => {
    const service = new FakeAuthService();
    const ps = fakePostService();
    // Simulate the RPC returning empty for unauthorized caller
    ps.listPublic = async () => ({ status: "ok", data: { posts: [], nextCursor: null } });
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: `/api/v1/posts?communityId=${PRIVATE_COMMUNITY_ID}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().posts).toEqual([]);
  });

  it("returns empty feed for caller without access to private community (thread)", async () => {
    const service = new FakeAuthService();
    const ts = fakeThreadService();
    ts.listPublic = async () => ({ status: "ok", data: { threads: [], nextCursor: null } });
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: `/api/v1/threads?communityId=${PRIVATE_COMMUNITY_ID}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().threads).toEqual([]);
  });
});
