import { describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    rpc: rpcMock,
  })),
}));

const { createSupabaseThreadService } = await import("../src/services/thread-service.js");
const { createSupabaseArticleService } = await import("../src/services/article-service.js");
const { createSupabaseCommentService } = await import("../src/services/comment-service.js");

const nopAuthService = { validateAccessToken: vi.fn(), getOwnProfile: vi.fn() };
const url = "https://project.supabase.co";
const key = "test-key";

describe("thread-service error mapping", () => {
  it("maps rpc error to unavailable on generic failure", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "boom" } });
    const service = createSupabaseThreadService(url, key, nopAuthService as any);
    const result = await service.getPublicThread("00000000-0000-0000-0000-000000000000");
    expect(result.status).toBe("unavailable");
  });

  it("maps a successful rpc row to ok for getPublicThread", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { thread: { id: "abc", title: "Hi" }, replies: [] },
      error: null,
    });
    const service = createSupabaseThreadService(url, key, nopAuthService as any);
    const result = await service.getPublicThread("00000000-0000-0000-0000-000000000000");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect((result.data as any).thread.title).toBe("Hi");
    }
  });

  it("returns not_found when rpc returns null data", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const service = createSupabaseThreadService(url, key, nopAuthService as any);
    const result = await service.getPublicThread("00000000-0000-0000-0000-000000000000");
    expect(result.status).toBe("not_found");
  });
});

describe("article-service error mapping", () => {
  it("maps P0001 EMAIL_VERIFICATION_REQUIRED to invalid code", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "EMAIL_VERIFICATION_REQUIRED" } });
    const service = createSupabaseArticleService(url, key, nopAuthService as any);
    const result = await service.createDraft("tok-ok", { title: "Test", contentHtml: "<p>hi</p>", contentJson: {} });
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.code).toBe("EMAIL_VERIFICATION_REQUIRED");
    }
  });

  it("maps CONTENT_TOO_LARGE to invalid code on update", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "22023", message: "CONTENT_TOO_LARGE" } });
    const service = createSupabaseArticleService(url, key, nopAuthService as any);
    const result = await service.updateDraft("tok-ok", "00000000-0000-0000-0000-000000000000", { title: "X" });
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.code).toBe("CONTENT_TOO_LARGE");
    }
  });

  it("maps FORBIDDEN (42501) to forbidden on publish", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "permission denied" } });
    const service = createSupabaseArticleService(url, key, nopAuthService as any);
    const result = await service.publish("tok-ok", "00000000-0000-0000-0000-000000000000");
    expect(result.status).toBe("forbidden");
  });

  it("returns ok with slug on successful publish", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { id: "abc", slug: "my-article", status: "published" },
      error: null,
    });
    const service = createSupabaseArticleService(url, key, nopAuthService as any);
    const result = await service.publish("tok-ok", "00000000-0000-0000-0000-000000000000");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.slug).toBe("my-article");
    }
  });
});

describe("comment-service error mapping", () => {
  it("maps OWNER_CLOSED to invalid code", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "OWNER_CLOSED" } });
    const service = createSupabaseCommentService(url, key, nopAuthService as any);
    const result = await service.create("tok-ok", { ownerType: "thread", ownerId: "00000000-0000-0000-0000-000000000000", body: "Hi" });
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.code).toBe("OWNER_CLOSED");
    }
  });

  it("returns ok on successful comment create", async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: "c1", depth: 1, status: "published" }, error: null });
    const service = createSupabaseCommentService(url, key, nopAuthService as any);
    const result = await service.create("tok-ok", { ownerType: "thread", ownerId: "00000000-0000-0000-0000-000000000000", body: "Hi" });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.depth).toBe(1);
    }
  });
});
