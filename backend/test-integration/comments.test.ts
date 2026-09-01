"use strict";

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const dbUrl = process.env.SUPABASE_TEST_DB_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
if (!["localhost", "127.0.0.1", "host.docker.internal"].includes(new URL(url).hostname)) throw new Error("Refusing to run integration tests against a non-local Supabase target.");

const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 4 });
const password = "Local-test-only-Password1!";

async function signup(role: "student" | "tutor") {
  const email = `comments-test-${randomUUID()}@example.test`;
  return signUpConfirmed({
    anon: createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
    url: url!,
    publishableKey: key!,
    serviceRoleKey: serviceKey!,
    email,
    password,
    metadata: { name: `Comments Test ${role}`, role },
    trustedTutor: role === "tutor",
  });
}

describe.sequential("comment routes", () => {
  let studentSession: Awaited<ReturnType<typeof signup>>;

  beforeAll(async () => {
    studentSession = await signup("student");
  });

  afterAll(() => sql.end());

  it("GET /api/v1/comments does not require auth (public list)", async () => {
    const { createApp } = await import("../src/app.js");
    const { createSupabaseAuthService } = await import("../src/lib/supabase.js");
    const { createSupabaseCommentService } = await import("../src/services/comment-service.js");
    const { parseEnvironment } = await import("../src/config/env.js");
    const config = parseEnvironment(process.env);
    const authService = createSupabaseAuthService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const commentService = createSupabaseCommentService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, authService);
    const app = createApp({ config, authService, commentService });

    const res = await app.inject({ method: "GET", url: "/api/v1/comments?ownerType=article&ownerId=00000000-0000-0000-0000-000000000001" });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("POST /api/v1/comments returns 401 without auth", async () => {
    const { createApp } = await import("../src/app.js");
    const { createSupabaseAuthService } = await import("../src/lib/supabase.js");
    const { createSupabaseCommentService } = await import("../src/services/comment-service.js");
    const { parseEnvironment } = await import("../src/config/env.js");
    const config = parseEnvironment(process.env);
    const authService = createSupabaseAuthService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const commentService = createSupabaseCommentService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, authService);
    const app = createApp({ config, authService, commentService });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/comments",
      payload: { ownerType: "article", ownerId: "00000000-0000-0000-0000-000000000001", body: "Test comment" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("DELETE /api/v1/comments/:id returns 401 without auth", async () => {
    const { createApp } = await import("../src/app.js");
    const { createSupabaseAuthService } = await import("../src/lib/supabase.js");
    const { createSupabaseCommentService } = await import("../src/services/comment-service.js");
    const { parseEnvironment } = await import("../src/config/env.js");
    const config = parseEnvironment(process.env);
    const authService = createSupabaseAuthService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const commentService = createSupabaseCommentService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, authService);
    const app = createApp({ config, authService, commentService });

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/comments/00000000-0000-0000-0000-000000000001",
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("POST /api/v1/comments returns 401 with invalid UUID ownerId", async () => {
    const { createApp } = await import("../src/app.js");
    const { createSupabaseAuthService } = await import("../src/lib/supabase.js");
    const { createSupabaseCommentService } = await import("../src/services/comment-service.js");
    const { parseEnvironment } = await import("../src/config/env.js");
    const config = parseEnvironment(process.env);
    const authService = createSupabaseAuthService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const commentService = createSupabaseCommentService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, authService);
    const app = createApp({ config, authService, commentService });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/comments",
      headers: { authorization: `Bearer ${studentSession.session.access_token}` },
      payload: { ownerType: "article", ownerId: "invalid-uuid", body: "Test comment" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
