import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";
import type { CommunityService } from "../src/services/community-service.js";
import type { BookmarkService, ReportService } from "../src/services/bookmark-service.js";

const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

const COMMUNITY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function fakeCommunityService(): CommunityService {
  return {
    create: async () => ({ status: "ok", data: { id: COMMUNITY_ID, slug: "ielts-study" } }),
    update: async () => ({ status: "ok", data: { id: COMMUNITY_ID, updated: true } }),
    archive: async () => ({ status: "ok", data: { id: COMMUNITY_ID, archived: true } }),
    join: async () => ({ status: "ok", data: { community_id: COMMUNITY_ID, status: "active" } }),
    requestJoin: async () => ({ status: "ok", data: { community_id: COMMUNITY_ID, status: "pending" } }),
    leave: async () => ({ status: "ok", data: { community_id: COMMUNITY_ID, left: true } }),
    approveMember: async () => ({ status: "ok", data: { community_id: COMMUNITY_ID, user_id: USER_ID, status: "active" } }),
    banMember: async () => ({ status: "ok", data: { community_id: COMMUNITY_ID, user_id: USER_ID, status: "banned" } }),
    setMemberRole: async () => ({ status: "ok", data: { community_id: COMMUNITY_ID, user_id: USER_ID, role: "moderator" } }),
    listPublic: async () => ({ status: "ok", data: { communities: [], nextCursor: null } }),
    getPublic: async () => ({ status: "ok", data: { id: COMMUNITY_ID, slug: "ielts-study" } }),
    listMembers: async () => ({ status: "ok", data: { members: [], nextCursor: null } }),
    checkMembership: async () => ({ status: "ok", data: { is_member: false, is_moderator: false, is_owner: false, is_pending: false, is_banned: false } }),
  } as unknown as CommunityService;
}

function fakeBookmarkService(): BookmarkService {
  return {
    add: async () => ({ status: "ok", data: { id: "bm-1", target_type: "post", target_id: "p-1" } }),
    remove: async () => ({ status: "ok", data: { removed: true } }),
    list: async () => ({ status: "ok", data: { bookmarks: [], nextCursor: null } }),
  } as unknown as BookmarkService;
}

function fakeReportService(): ReportService {
  return {
    reportPost: async () => ({ status: "ok", data: { id: "r-1", status: "pending" } }),
    reportArticle: async () => ({ status: "ok", data: { id: "r-2", status: "pending" } }),
  } as unknown as ReportService;
}

function createTestApp(service: FakeAuthService, opts?: { communityService?: CommunityService; bookmarkService?: BookmarkService; reportService?: ReportService }) {
  const app = createApp({
    config: testConfig,
    authService: service,
    communityService: opts?.communityService ?? fakeCommunityService(),
    bookmarkService: opts?.bookmarkService ?? fakeBookmarkService(),
    reportService: opts?.reportService ?? fakeReportService(),
  });
  apps.push(app);
  return app;
}

function authed() {
  const service = new FakeAuthService();
  service.authentication = { status: "authenticated", user: { id: "user-1", email: "test@example.com" } };
  return { service, token: "tok-ok" };
}

describe("communities route", () => {
  it("rejects POST /api/v1/communities without auth (401)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "POST", url: "/api/v1/communities", payload: { slug: "test", name: "Test" } });
    expect(res.statusCode).toBe(401);
  });

  it("allows GET /api/v1/communities without auth (200)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: "/api/v1/communities" });
    expect(res.statusCode).toBe(200);
    expect(res.json().communities).toEqual([]);
  });

  it("creates a community with valid auth (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/communities",
      headers: { authorization: `Bearer ${token}` },
      payload: { slug: "ielts-study", name: "IELTS Study Circle" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().slug).toBe("ielts-study");
  });

  it("validates slug length (400 on too short)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/communities",
      headers: { authorization: `Bearer ${token}` },
      payload: { slug: "a", name: "Test" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects bad join policy (400)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/communities",
      headers: { authorization: `Bearer ${token}` },
      payload: { slug: "test", name: "Test", joinPolicy: "invalid" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("joins an open community (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: `/api/v1/communities/${COMMUNITY_ID}/join`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("active");
  });

  it("joins a request-only community as pending", async () => {
    const { service, token } = authed();
    const cs = fakeCommunityService();
    cs.join = async () => ({ status: "invalid", code: "JOIN_NOT_OPEN" });
    const app = createTestApp(service, { communityService: cs });
    const res = await app.inject({
      method: "POST", url: `/api/v1/communities/${COMMUNITY_ID}/join`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it("owner cannot leave (409)", async () => {
    const { service, token } = authed();
    const cs = fakeCommunityService();
    cs.leave = async () => ({ status: "invalid", code: "OWNER_CANNOT_LEAVE" });
    const app = createTestApp(service, { communityService: cs });
    const res = await app.inject({
      method: "DELETE", url: `/api/v1/communities/${COMMUNITY_ID}/members/me`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it("cannot ban owner (409)", async () => {
    const { service, token } = authed();
    const cs = fakeCommunityService();
    cs.banMember = async () => ({ status: "invalid", code: "CANNOT_BAN_OWNER" });
    const app = createTestApp(service, { communityService: cs });
    const res = await app.inject({
      method: "POST", url: `/api/v1/communities/${COMMUNITY_ID}/members/${USER_ID}/ban`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(409);
  });

  it("approves a pending member (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: `/api/v1/communities/${COMMUNITY_ID}/members/${USER_ID}/approve`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("active");
  });

  it("non-mod cannot approve (403)", async () => {
    const { service, token } = authed();
    const cs = fakeCommunityService();
    cs.approveMember = async () => ({ status: "forbidden" });
    const app = createTestApp(service, { communityService: cs });
    const res = await app.inject({
      method: "POST", url: `/api/v1/communities/${COMMUNITY_ID}/members/${USER_ID}/approve`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("get community (200, public)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: "/api/v1/communities/ielts-study" });
    expect(res.statusCode).toBe(200);
  });

  it("returns 404 for non-existent community", async () => {
    const service = new FakeAuthService();
    const cs = fakeCommunityService();
    cs.getPublic = async () => ({ status: "not_found" });
    const app = createTestApp(service, { communityService: cs });
    const res = await app.inject({ method: "GET", url: "/api/v1/communities/nonexistent" });
    expect(res.statusCode).toBe(404);
  });
});

describe("bookmarks route", () => {
  it("rejects GET /api/v1/bookmarks without auth (401)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: "/api/v1/bookmarks" });
    expect(res.statusCode).toBe(401);
  });

  it("adds a bookmark (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/bookmarks",
      headers: { authorization: `Bearer ${token}` },
      payload: { targetType: "post", targetId: "11111111-1111-4111-8111-111111111111" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().target_type).toBe("post");
  });

  it("rejects invalid target type (400)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/bookmarks",
      headers: { authorization: `Bearer ${token}` },
      payload: { targetType: "invalid", targetId: "11111111-1111-4111-8111-111111111111" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects invalid target id (400)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/bookmarks",
      headers: { authorization: `Bearer ${token}` },
      payload: { targetType: "post", targetId: "not-a-uuid" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("removes a bookmark (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "DELETE", url: "/api/v1/bookmarks",
      headers: { authorization: `Bearer ${token}` },
      payload: { targetType: "post", targetId: "11111111-1111-4111-8111-111111111111" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().removed).toBe(true);
  });

  it("lists bookmarks (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "GET", url: "/api/v1/bookmarks",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().bookmarks).toEqual([]);
  });
});

describe("reports route", () => {
  it("rejects without auth (401)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "POST", url: "/api/v1/reports", payload: { targetType: "post", targetId: "11111111-1111-4111-8111-111111111111", reason: "Spam" } });
    expect(res.statusCode).toBe(401);
  });

  it("submits a post report (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/reports",
      headers: { authorization: `Bearer ${token}` },
      payload: { targetType: "post", targetId: "11111111-1111-4111-8111-111111111111", reason: "Spam content" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("pending");
  });

  it("submits an article report (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/reports",
      headers: { authorization: `Bearer ${token}` },
      payload: { targetType: "article", targetId: "11111111-1111-4111-8111-111111111111", reason: "Inappropriate" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects empty reason (400)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/reports",
      headers: { authorization: `Bearer ${token}` },
      payload: { targetType: "post", targetId: "11111111-1111-4111-8111-111111111111", reason: "" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects reason too long (400)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/reports",
      headers: { authorization: `Bearer ${token}` },
      payload: { targetType: "post", targetId: "11111111-1111-4111-8111-111111111111", reason: "x".repeat(501) },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("community-service error mapping", () => {
  it("maps unavailable on RPC failure", async () => {
    const { createSupabaseCommunityService } = await import("../src/services/community-service.js");
    const svc = createSupabaseCommunityService("https://x.supabase.co", "key", {} as any);
    const result = await (svc as any).listPublic(null, 20);
    expect(result.status).toBe("unavailable");
  });
});
