import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";
import type { ThreadService } from "../src/services/thread-service.js";
import type { ArticleService } from "../src/services/article-service.js";
import type { CommentService } from "../src/services/comment-service.js";

const userId = "11111111-1111-4111-8111-111111111111";
const token = "test-token";
const apps: any[] = [];

const authed = () => {
  const auth = new FakeAuthService();
  auth.authentication = { status: "authenticated", user: { id: userId, email: "tutor@example.com" } };
  auth.profile = {
    status: "found",
    profile: { id: userId, role: "tutor", name: "Thu Ha", phone: null, avatar_url: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
  };
  return auth;
};

const fakeThreadService = (): ThreadService => ({
  createThread: async () => ({ status: "ok", data: { id: "thread-1", status: "published" } }),
  listPublicThreads: async () => ({ status: "ok", data: { threads: [], nextCursor: null } }),
  getPublicThread: async () => ({ status: "ok", data: { thread: { id: "thread-1", title: "Hi" }, replies: [] } }),
  reply: async () => ({ status: "ok", data: { id: "reply-1", depth: 1, status: "published" } }),
  closeThread: async () => ({ status: "ok", data: { id: "thread-1", status: "closed" } }),
  reopenThread: async () => ({ status: "ok", data: { id: "thread-1", status: "published" } }),
  deleteThread: async () => ({ status: "ok", data: { id: "thread-1", status: "deleted" } }),
  deleteReply: async () => ({ status: "ok", data: { id: "reply-1", status: "deleted" } }),
  appreciate: async () => ({ status: "ok", data: { target_type: "thread", target_id: "thread-1", appreciated_count: 1, appreciated_by_me: true } }),
  unappreciate: async () => ({ status: "ok", data: { target_type: "thread", target_id: "thread-1", appreciated_count: 0, appreciated_by_me: false } }),
  report: async () => ({ status: "ok", data: { id: "report-1", status: "pending" } }),
});

const fakeArticleService = (): ArticleService => ({
  createDraft: async () => ({ status: "ok", data: { id: "art-1", status: "draft" } }),
  updateDraft: async () => ({ status: "ok", data: { id: "art-1", status: "draft" } }),
  publish: async () => ({ status: "ok", data: { id: "art-1", slug: "my-article", status: "published" } }),
  unpublish: async () => ({ status: "ok", data: { id: "art-1", status: "draft" } }),
  deleteArticle: async () => ({ status: "ok", data: { id: "art-1", status: "deleted" } }),
  getPublicArticle: async () => ({ status: "ok", data: { id: "art-1", slug: "my-article", title: "My Article", content_html: "<p>Hi</p>" } }),
  listPublicArticles: async () => ({ status: "ok", data: { articles: [], nextCursor: null } }),
  listMyArticles: async () => ({ status: "ok", data: { articles: [] } }),
  getMyArticle: async () => ({ status: "ok", data: { id: "art-1", title: "Draft" } }),
});

const fakeCommentService = (): CommentService => ({
  create: async () => ({ status: "ok", data: { id: "c-1", depth: 1, status: "published" } }),
  deleteComment: async () => ({ status: "ok", data: { id: "c-1", status: "deleted" } }),
  appreciate: async () => ({ status: "ok", data: { comment_id: "c-1", appreciated_count: 1, appreciated_by_me: true } }),
  unappreciate: async () => ({ status: "ok", data: { comment_id: "c-1", appreciated_count: 0, appreciated_by_me: false } }),
  listPublic: async () => ({ status: "ok", data: { comments: [] } }),
});

afterEach(async () => {
  for (const app of apps) await app.close();
  apps.length = 0;
});

describe("threads route auth gating", () => {
  it("rejects POST /api/v1/threads without auth (401)", async () => {
    const auth = new FakeAuthService();
    const app = createApp({ config: testConfig, authService: auth, threadService: fakeThreadService() });
    apps.push(app);
    const res = await app.inject({ method: "POST", url: "/api/v1/threads", payload: { title: "x", anchorType: "external_url" } });
    expect(res.statusCode).toBe(401);
  });

  it("allows GET /api/v1/threads without auth (public)", async () => {
    const auth = new FakeAuthService();
    const app = createApp({ config: testConfig, authService: auth, threadService: fakeThreadService() });
    apps.push(app);
    const res = await app.inject({ method: "GET", url: "/api/v1/threads" });
    expect(res.statusCode).toBe(200);
    expect(res.json().threads).toEqual([]);
  });

it("validates thread create body (400 on empty title)", async () => {
    const app = createApp({ config: testConfig, authService: authed(), threadService: fakeThreadService() });
    apps.push(app);
    const res = await app.inject({ method: "POST", url: "/api/v1/threads", headers: { authorization: `Bearer ${token}` }, payload: { title: "", anchorType: "external_url" } });
    expect(res.statusCode).toBe(400);
  });

  it("validates anchor URL is https-only (400)", async () => {
    const app = createApp({ config: testConfig, authService: authed(), threadService: fakeThreadService() });
    apps.push(app);
    const res = await app.inject({
      method: "POST", url: "/api/v1/threads",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Bad anchor", anchorType: "external_url", anchorUrl: "http://insecure.com" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("creates a thread with valid payload (200)", async () => {
    const service = fakeThreadService();
    const app = createApp({ config: testConfig, authService: authed(), threadService: service });
    apps.push(app);
    const res = await app.inject({
      method: "POST", url: "/api/v1/threads",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "How is this course?", anchorType: "external_url", anchorUrl: "https://example.com/course" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe("thread-1");
  });
});

describe("articles route auth gating", () => {
  it("rejects POST /api/v1/articles without auth (401)", async () => {
    const auth = new FakeAuthService();
    const app = createApp({ config: testConfig, authService: auth, articleService: fakeArticleService() });
    apps.push(app);
    const res = await app.inject({ method: "POST", url: "/api/v1/articles", payload: { title: "x", contentHtml: "<p>x</p>", contentJson: {} } });
    expect(res.statusCode).toBe(401);
  });

  it("validates article create body (400 on empty title)", async () => {
    const app = createApp({ config: testConfig, authService: authed(), articleService: fakeArticleService() });
    apps.push(app);
    const res = await app.inject({ method: "POST", url: "/api/v1/articles", headers: { authorization: `Bearer ${token}` }, payload: { title: "", contentHtml: "<p>x</p>", contentJson: {} } });
    expect(res.statusCode).toBe(400);
  });

  it("allows GET /api/v1/articles/:slug without auth (public)", async () => {
    const auth = new FakeAuthService();
    const app = createApp({ config: testConfig, authService: auth, articleService: fakeArticleService() });
    apps.push(app);
    const res = await app.inject({ method: "GET", url: "/api/v1/articles/my-article" });
    expect(res.statusCode).toBe(200);
    expect(res.json().slug).toBe("my-article");
  });
});

describe("comments route auth gating", () => {
  it("rejects POST /api/v1/comments without auth (401)", async () => {
    const auth = new FakeAuthService();
    const app = createApp({ config: testConfig, authService: auth, commentService: fakeCommentService() });
    apps.push(app);
    const res = await app.inject({ method: "POST", url: "/api/v1/comments", payload: { ownerType: "thread", ownerId: "00000000-0000-0000-0000-000000000000", body: "Hi" } });
    expect(res.statusCode).toBe(401);
  });

  it("allows GET /api/v1/comments without auth (public)", async () => {
    const auth = new FakeAuthService();
    const app = createApp({ config: testConfig, authService: auth, commentService: fakeCommentService() });
    apps.push(app);
    const res = await app.inject({ method: "GET", url: "/api/v1/comments?ownerType=thread&ownerId=00000000-0000-0000-0000-000000000000" });
    expect(res.statusCode).toBe(200);
    expect(res.json().comments).toEqual([]);
  });
});
