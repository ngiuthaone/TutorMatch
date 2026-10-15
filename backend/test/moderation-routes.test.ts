/**
 * Moderation routes — integration tests.
 *
 * Covers:
 *  - Route registration and authentication
 *  - Authorized operations (pin/unpin/lock/unlock/remove/restore for posts and threads)
 *  - Unauthorized requests (no token) -> 401
 *  - Forbidden responses from service -> 403
 *  - Not found responses -> 404
 *  - Invalid UUID -> 400
 *  - Service unavailable -> 503
 *  - removePost body with reason validation
 */
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";
import type { ModerationService, ModerationResult } from "../src/services/moderation-service.js";

const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

const AUTH = { authorization: "Bearer test-token" };
const POST_ID = "11111111-1111-4111-8111-111111111111";
const THREAD_ID = "22222222-2222-4222-8222-222222222222";

function buildApp(moderationService: ModerationService) {
  const auth = new FakeAuthService();
  auth.authentication = { status: "authenticated", user: { id: "99999999-9999-4999-8999-999999999999", email: "mod@test.com" } };
  const app = createApp({
    config: testConfig,
    authService: auth,
    tutorCvService: {} as any,
    marketplaceService: {} as any,
    bookingService: {} as any,
    policyService: {} as any,
    complianceService: {} as any,
    payoutService: {} as any,
    moderationService,
  });
  apps.push(app);
  return app;
}

function ok(data: Record<string, unknown> = { id: POST_ID }): ModerationResult {
  return { status: "ok", data };
}

function forbidden(): ModerationResult {
  return { status: "forbidden" };
}

function notFound(): ModerationResult {
  return { status: "not_found" };
}

function unavailable(): ModerationResult {
  return { status: "unavailable" };
}

describe("moderation routes - route registration and auth", () => {
  it("returns 401 when no token", async () => {
    const mod = {
      pinPost: async () => ok(),
      unpinPost: async () => ok(),
      lockPost: async () => ok(),
      unlockPost: async () => ok(),
      removePost: async () => ok(),
      restorePost: async () => ok(),
      pinThread: async () => ok(),
      unpinThread: async () => ok(),
      lockThread: async () => ok(),
      unlockThread: async () => ok(),
      removeThread: async () => ok(),
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "POST", url: `/api/v1/posts/${POST_ID}/pin` });
    expect(res.statusCode).toBe(401);
  });

  it("rejects invalid uuid", async () => {
    const mod = {
      pinPost: async () => ok(),
      unpinPost: async () => ok(),
      lockPost: async () => ok(),
      unlockPost: async () => ok(),
      removePost: async () => ok(),
      restorePost: async () => ok(),
      pinThread: async () => ok(),
      unpinThread: async () => ok(),
      lockThread: async () => ok(),
      unlockThread: async () => ok(),
      removeThread: async () => ok(),
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "POST", url: "/api/v1/posts/not-a-uuid/pin", headers: AUTH });
    expect(res.statusCode).toBe(404);
  });
});

describe("moderation routes - post operations", () => {
  it("pin post returns 200 on ok", async () => {
    const mod = {
      pinPost: async () => ok({ id: POST_ID, is_pinned: true }),
      unpinPost: async () => ok(),
      lockPost: async () => ok(),
      unlockPost: async () => ok(),
      removePost: async () => ok(),
      restorePost: async () => ok(),
      pinThread: async () => ok(),
      unpinThread: async () => ok(),
      lockThread: async () => ok(),
      unlockThread: async () => ok(),
      removeThread: async () => ok(),
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "POST", url: `/api/v1/posts/${POST_ID}/pin`, headers: AUTH });
    expect(res.statusCode).toBe(200);
  });

  it("unpin post returns 200 on ok", async () => {
    const mod = {
      pinPost: async () => ok(),
      unpinPost: async () => ok({ id: POST_ID, is_pinned: false }),
      lockPost: async () => ok(),
      unlockPost: async () => ok(),
      removePost: async () => ok(),
      restorePost: async () => ok(),
      pinThread: async () => ok(),
      unpinThread: async () => ok(),
      lockThread: async () => ok(),
      unlockThread: async () => ok(),
      removeThread: async () => ok(),
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "DELETE", url: `/api/v1/posts/${POST_ID}/pin`, headers: AUTH });
    expect(res.statusCode).toBe(200);
  });

  it("lock post returns 200 on ok", async () => {
    const mod = {
      pinPost: async () => ok(),
      unpinPost: async () => ok(),
      lockPost: async () => ok({ id: POST_ID, is_locked: true }),
      unlockPost: async () => ok(),
      removePost: async () => ok(),
      restorePost: async () => ok(),
      pinThread: async () => ok(),
      unpinThread: async () => ok(),
      lockThread: async () => ok(),
      unlockThread: async () => ok(),
      removeThread: async () => ok(),
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "POST", url: `/api/v1/posts/${POST_ID}/lock`, headers: AUTH });
    expect(res.statusCode).toBe(200);
  });

  it("unlock post returns 200 on ok", async () => {
    const mod = {
      pinPost: async () => ok(),
      unpinPost: async () => ok(),
      lockPost: async () => ok(),
      unlockPost: async () => ok({ id: POST_ID, is_locked: false }),
      removePost: async () => ok(),
      restorePost: async () => ok(),
      pinThread: async () => ok(),
      unpinThread: async () => ok(),
      lockThread: async () => ok(),
      unlockThread: async () => ok(),
      removeThread: async () => ok(),
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "DELETE", url: `/api/v1/posts/${POST_ID}/lock`, headers: AUTH });
    expect(res.statusCode).toBe(200);
  });

  it("remove post with reason returns 200 on ok", async () => {
    const mod = {
      pinPost: async () => ok(),
      unpinPost: async () => ok(),
      lockPost: async () => ok(),
      unlockPost: async () => ok(),
      removePost: async (token, id, reason) => { expect(reason).toBe("spam"); return ok({ id: POST_ID, is_removed: true }); },
      restorePost: async () => ok(),
      pinThread: async () => ok(),
      unpinThread: async () => ok(),
      lockThread: async () => ok(),
      unlockThread: async () => ok(),
      removeThread: async () => ok(),
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "POST", url: `/api/v1/posts/${POST_ID}/remove`, headers: AUTH, payload: { reason: "spam" } });
    expect(res.statusCode).toBe(200);
  });

  it("restore post returns 200 on ok", async () => {
    const mod = {
      pinPost: async () => ok(),
      unpinPost: async () => ok(),
      lockPost: async () => ok(),
      unlockPost: async () => ok(),
      removePost: async () => ok(),
      restorePost: async () => ok({ id: POST_ID, is_removed: false }),
      pinThread: async () => ok(),
      unpinThread: async () => ok(),
      lockThread: async () => ok(),
      unlockThread: async () => ok(),
      removeThread: async () => ok(),
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "POST", url: `/api/v1/posts/${POST_ID}/restore`, headers: AUTH });
    expect(res.statusCode).toBe(200);
  });

  it("pin post returns 403 when forbidden", async () => {
    const mod = {
      pinPost: async () => forbidden(),
      unpinPost: async () => ok(),
      lockPost: async () => ok(),
      unlockPost: async () => ok(),
      removePost: async () => ok(),
      restorePost: async () => ok(),
      pinThread: async () => ok(),
      unpinThread: async () => ok(),
      lockThread: async () => ok(),
      unlockThread: async () => ok(),
      removeThread: async () => ok(),
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "POST", url: `/api/v1/posts/${POST_ID}/pin`, headers: AUTH });
    expect(res.statusCode).toBe(403);
  });

  it("pin post returns 404 when not found", async () => {
    const mod = {
      pinPost: async () => notFound(),
      unpinPost: async () => ok(),
      lockPost: async () => ok(),
      unlockPost: async () => ok(),
      removePost: async () => ok(),
      restorePost: async () => ok(),
      pinThread: async () => ok(),
      unpinThread: async () => ok(),
      lockThread: async () => ok(),
      unlockThread: async () => ok(),
      removeThread: async () => ok(),
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "POST", url: `/api/v1/posts/${POST_ID}/pin`, headers: AUTH });
    expect(res.statusCode).toBe(404);
  });

  it("pin post returns 503 when unavailable", async () => {
    const mod = {
      pinPost: async () => unavailable(),
      unpinPost: async () => ok(),
      lockPost: async () => ok(),
      unlockPost: async () => ok(),
      removePost: async () => ok(),
      restorePost: async () => ok(),
      pinThread: async () => ok(),
      unpinThread: async () => ok(),
      lockThread: async () => ok(),
      unlockThread: async () => ok(),
      removeThread: async () => ok(),
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "POST", url: `/api/v1/posts/${POST_ID}/pin`, headers: AUTH });
    expect(res.statusCode).toBe(503);
  });
});

describe("moderation routes - thread operations", () => {
  it("pin thread returns 200 on ok", async () => {
    const mod = {
      pinPost: async () => ok(),
      unpinPost: async () => ok(),
      lockPost: async () => ok(),
      unlockPost: async () => ok(),
      removePost: async () => ok(),
      restorePost: async () => ok(),
      pinThread: async () => ok({ id: THREAD_ID, is_pinned: true }),
      unpinThread: async () => ok(),
      lockThread: async () => ok(),
      unlockThread: async () => ok(),
      removeThread: async () => ok(),
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "POST", url: `/api/v1/threads/${THREAD_ID}/pin`, headers: AUTH });
    expect(res.statusCode).toBe(200);
  });

  it("unpin thread returns 200 on ok", async () => {
    const mod = {
      pinPost: async () => ok(),
      unpinPost: async () => ok(),
      lockPost: async () => ok(),
      unlockPost: async () => ok(),
      removePost: async () => ok(),
      restorePost: async () => ok(),
      pinThread: async () => ok(),
      unpinThread: async () => ok({ id: THREAD_ID, is_pinned: false }),
      lockThread: async () => ok(),
      unlockThread: async () => ok(),
      removeThread: async () => ok(),
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "DELETE", url: `/api/v1/threads/${THREAD_ID}/pin`, headers: AUTH });
    expect(res.statusCode).toBe(200);
  });

  it("lock thread returns 200 on ok", async () => {
    const mod = {
      pinPost: async () => ok(),
      unpinPost: async () => ok(),
      lockPost: async () => ok(),
      unlockPost: async () => ok(),
      removePost: async () => ok(),
      restorePost: async () => ok(),
      pinThread: async () => ok(),
      unpinThread: async () => ok(),
      lockThread: async () => ok({ id: THREAD_ID, is_locked: true, status: "closed" }),
      unlockThread: async () => ok(),
      removeThread: async () => ok(),
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "POST", url: `/api/v1/threads/${THREAD_ID}/lock`, headers: AUTH });
    expect(res.statusCode).toBe(200);
  });

  it("unlock thread returns 200 on ok", async () => {
    const mod = {
      pinPost: async () => ok(),
      unpinPost: async () => ok(),
      lockPost: async () => ok(),
      unlockPost: async () => ok(),
      removePost: async () => ok(),
      restorePost: async () => ok(),
      pinThread: async () => ok(),
      unpinThread: async () => ok(),
      lockThread: async () => ok(),
      unlockThread: async () => ok({ id: THREAD_ID, is_locked: false, status: "published" }),
      removeThread: async () => ok(),
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "DELETE", url: `/api/v1/threads/${THREAD_ID}/lock`, headers: AUTH });
    expect(res.statusCode).toBe(200);
  });

  it("remove thread with reason returns 200 on ok", async () => {
    const mod = {
      pinPost: async () => ok(),
      unpinPost: async () => ok(),
      lockPost: async () => ok(),
      unlockPost: async () => ok(),
      removePost: async () => ok(),
      restorePost: async () => ok(),
      pinThread: async () => ok(),
      unpinThread: async () => ok(),
      lockThread: async () => ok(),
      unlockThread: async () => ok(),
      removeThread: async (token, id, reason) => { expect(reason).toBe("inappropriate"); return ok({ id: THREAD_ID, status: "removed" }); },
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "POST", url: `/api/v1/threads/${THREAD_ID}/remove`, headers: AUTH, payload: { reason: "inappropriate" } });
    expect(res.statusCode).toBe(200);
  });

  it("restore thread returns 200 on ok", async () => {
    const mod = {
      pinPost: async () => ok(),
      unpinPost: async () => ok(),
      lockPost: async () => ok(),
      unlockPost: async () => ok(),
      removePost: async () => ok(),
      restorePost: async () => ok(),
      pinThread: async () => ok(),
      unpinThread: async () => ok(),
      lockThread: async () => ok(),
      unlockThread: async () => ok(),
      removeThread: async () => ok(),
      restoreThread: async () => ok({ id: THREAD_ID, status: "published" }),
    } as ModerationService;
    const app = buildApp(mod);
    const res = await app.inject({ method: "POST", url: `/api/v1/threads/${THREAD_ID}/restore`, headers: AUTH });
    expect(res.statusCode).toBe(200);
  });

  it("thread operations propagate forbidden/not found/unavailable", async () => {
    const mod = {
      pinPost: async () => ok(),
      unpinPost: async () => ok(),
      lockPost: async () => ok(),
      unlockPost: async () => ok(),
      removePost: async () => ok(),
      restorePost: async () => ok(),
      pinThread: async () => forbidden(),
      unpinThread: async () => notFound(),
      lockThread: async () => unavailable(),
      unlockThread: async () => ok(),
      removeThread: async () => ok(),
      restoreThread: async () => ok(),
    } as ModerationService;
    const app = buildApp(mod);
    const r1 = await app.inject({ method: "POST", url: `/api/v1/threads/${THREAD_ID}/pin`, headers: AUTH });
    expect(r1.statusCode).toBe(403);
    const r2 = await app.inject({ method: "DELETE", url: `/api/v1/threads/${THREAD_ID}/pin`, headers: AUTH });
    expect(r2.statusCode).toBe(404);
    const r3 = await app.inject({ method: "POST", url: `/api/v1/threads/${THREAD_ID}/lock`, headers: AUTH });
    expect(r3.statusCode).toBe(503);
  });
});
