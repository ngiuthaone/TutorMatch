import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";
import type { FollowService } from "../src/services/follow-service.js";
import type { NotificationService } from "../src/services/notification-service.js";

const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function fakeFollowService(): FollowService {
  return {
    follow: async () => ({ status: "ok", data: { followee: "user-2", following: true } }),
    unfollow: async () => ({ status: "ok", data: { followee: "user-2", following: false } }),
    isFollowing: async () => ({ status: "ok", data: { following: false } }),
    listFollowers: async () => ({ status: "ok", data: { users: [] } }),
    listFollowing: async () => ({ status: "ok", data: { users: [] } }),
  } as unknown as FollowService;
}

function fakeNotificationService(): NotificationService {
  return {
    listNotifications: async () => ({ status: "ok", data: { notifications: [], nextCursor: null } }),
    getUnreadCount: async () => ({ status: "ok", data: { count: 0 } }),
    markRead: async () => ({ status: "ok", data: { id: "notif-1", read: true } }),
    markAllRead: async () => ({ status: "ok", data: { success: true } }),
    createNotification: async () => ({ status: "ok", data: { id: "notif-1" } }),
  } as unknown as NotificationService;
}

const USER_NAME = "testuser";

function createTestApp(service: FakeAuthService, followService?: FollowService, notificationService?: NotificationService) {
  const app = createApp({
    config: testConfig,
    authService: service,
    followService: followService ?? fakeFollowService(),
    notificationService: notificationService ?? fakeNotificationService(),
  });
  apps.push(app);
  return app;
}

function authed() {
  const service = new FakeAuthService();
  service.authentication = {
    status: "authenticated",
    user: { id: "user-1", email: "test@example.com" },
  };
  return { service, token: "tok-ok" };
}

describe("follows route auth gating", () => {
  it("rejects POST /api/v1/users/:name/follow without auth (401)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "POST", url: `/api/v1/users/${USER_NAME}/follow` });
    expect(res.statusCode).toBe(401);
  });

  it("allows GET /api/v1/users/:name/following without auth (public)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: `/api/v1/users/${USER_NAME}/following` });
    expect(res.statusCode).toBe(200);
  });

  it("follows a user with valid auth (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: `/api/v1/users/${USER_NAME}/follow`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().following).toBe(true);
  });

  it("unfollows a user with valid auth (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "DELETE", url: `/api/v1/users/${USER_NAME}/follow`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().following).toBe(false);
  });

  it("lists followers (200)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: `/api/v1/users/${USER_NAME}/followers` });
    expect(res.statusCode).toBe(200);
    expect(res.json().followers).toEqual([]);
  });

  it("lists following (200)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: `/api/v1/users/${USER_NAME}/following-list` });
    expect(res.statusCode).toBe(200);
    expect(res.json().following).toEqual([]);
  });

  it("returns 404 for non-existent user", async () => {
    const service = new FakeAuthService();
    const fs = fakeFollowService();
    fs.isFollowing = async () => ({ status: "not_found" });
    const app = createTestApp(service, fs);
    const res = await app.inject({ method: "GET", url: "/api/v1/users/nonexistent/following" });
    expect(res.statusCode).toBe(404);
  });
});

describe("notifications route auth gating", () => {
  it("rejects GET /api/v1/notifications without auth (401)", async () => {
    const service = new FakeAuthService();
    const app = createTestApp(service);
    const res = await app.inject({ method: "GET", url: "/api/v1/notifications" });
    expect(res.statusCode).toBe(401);
  });

  it("lists notifications with valid auth (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "GET", url: "/api/v1/notifications",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().notifications).toEqual([]);
  });

  it("gets unread count (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "GET", url: "/api/v1/notifications/unread-count",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(0);
  });

  it("marks notification as read (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "PATCH", url: "/api/v1/notifications/11111111-1111-4111-8111-111111111111/read",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().read).toBe(true);
  });

  it("marks all notifications as read (200)", async () => {
    const { service, token } = authed();
    const app = createTestApp(service);
    const res = await app.inject({
      method: "POST", url: "/api/v1/notifications/read-all",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });
});

describe("follow-service error mapping", () => {
  it("maps follow errors correctly", async () => {
    const { createSupabaseFollowService } = await import("../src/services/follow-service.js");
    const svc = createSupabaseFollowService("https://x.supabase.co", "key", {} as any);
    const result = await (svc as any).follow("tok", "user-2");
    expect(result.status).toBe("unavailable");
  });

  it("maps notification errors correctly", async () => {
    const { createSupabaseNotificationService } = await import("../src/services/notification-service.js");
    const svc = createSupabaseNotificationService("https://x.supabase.co", "key", {} as any);
    const result = await (svc as any).listNotifications("tok");
    expect(result.status).toBe("unavailable");
  });
});
