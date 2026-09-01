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
  const email = `messaging-test-${randomUUID()}@example.test`;
  return signUpConfirmed({
    anon: createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
    url: url!,
    publishableKey: key!,
    serviceRoleKey: serviceKey!,
    email,
    password,
    metadata: { name: `Messaging Test ${role}`, role },
    trustedTutor: role === "tutor",
  });
}

describe.sequential("messaging routes", () => {
  let studentSession: Awaited<ReturnType<typeof signup>>;

  beforeAll(async () => {
    studentSession = await signup("student");
  });

  afterAll(() => sql.end());

  it("GET /api/v1/messaging/conversations returns 401 without auth", async () => {
    const { createApp } = await import("../src/app.js");
    const { createSupabaseAuthService } = await import("../src/lib/supabase.js");
    const { createSupabaseMessagingService } = await import("../src/services/messaging-service.js");
    const { parseEnvironment } = await import("../src/config/env.js");
    const config = parseEnvironment(process.env);
    const authService = createSupabaseAuthService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const messagingService = createSupabaseMessagingService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const app = createApp({ config, authService, messagingService });

    const res = await app.inject({ method: "GET", url: "/api/v1/messaging/conversations" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/v1/messaging/conversations/:id returns 401 without auth", async () => {
    const { createApp } = await import("../src/app.js");
    const { createSupabaseAuthService } = await import("../src/lib/supabase.js");
    const { createSupabaseMessagingService } = await import("../src/services/messaging-service.js");
    const { parseEnvironment } = await import("../src/config/env.js");
    const config = parseEnvironment(process.env);
    const authService = createSupabaseAuthService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const messagingService = createSupabaseMessagingService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const app = createApp({ config, authService, messagingService });

    const res = await app.inject({ method: "GET", url: "/api/v1/messaging/conversations/00000000-0000-0000-0000-000000000001" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("POST /api/v1/messaging/conversations/:id/messages returns 401 without auth", async () => {
    const { createApp } = await import("../src/app.js");
    const { createSupabaseAuthService } = await import("../src/lib/supabase.js");
    const { createSupabaseMessagingService } = await import("../src/services/messaging-service.js");
    const { parseEnvironment } = await import("../src/config/env.js");
    const config = parseEnvironment(process.env);
    const authService = createSupabaseAuthService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const messagingService = createSupabaseMessagingService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const app = createApp({ config, authService, messagingService });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/messaging/conversations/00000000-0000-0000-0000-000000000001/messages",
      payload: { clientMessageId: "test-id-12345678", body: "Hello" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/v1/messaging/conversations returns 200 with valid auth", async () => {
    const { createApp } = await import("../src/app.js");
    const { createSupabaseAuthService } = await import("../src/lib/supabase.js");
    const { createSupabaseMessagingService } = await import("../src/services/messaging-service.js");
    const { parseEnvironment } = await import("../src/config/env.js");
    const config = parseEnvironment(process.env);
    const authService = createSupabaseAuthService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const messagingService = createSupabaseMessagingService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const app = createApp({ config, authService, messagingService });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/messaging/conversations",
      headers: { authorization: `Bearer ${studentSession.session.access_token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("conversations");
    await app.close();
  });
});
