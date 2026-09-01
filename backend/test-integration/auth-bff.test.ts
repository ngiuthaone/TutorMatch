"use strict";

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const dbUrl = process.env.SUPABASE_TEST_DB_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
if (!["localhost", "127.0.0.1", "host.docker.internal"].includes(new URL(url).hostname)) throw new Error("Refusing to run integration tests against a non-local Supabase target.");

const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 4 });
const password = "Local-test-only-Password1!";

describe.sequential("auth-bff routes", () => {
  afterAll(() => sql.end());

  it("POST /api/v1/auth/sign-in returns 401 for invalid credentials", async () => {
    const { createApp } = await import("../src/app.js");
    const { createSupabaseAuthService } = await import("../src/lib/supabase.js");
    const { parseEnvironment } = await import("../src/config/env.js");
    const config = parseEnvironment(process.env);
    const authService = createSupabaseAuthService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const app = createApp({ config, authService });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/sign-in",
      payload: { email: "nonexistent@example.test", password: "wrongpassword" },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("AUTH_FAILED");
    await app.close();
  });

  it("POST /api/v1/auth/sign-out clears cookie and returns 200", async () => {
    const { createApp } = await import("../src/app.js");
    const { createSupabaseAuthService } = await import("../src/lib/supabase.js");
    const { parseEnvironment } = await import("../src/config/env.js");
    const config = parseEnvironment(process.env);
    const authService = createSupabaseAuthService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const app = createApp({ config, authService });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/sign-out",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    const cookies = res.headers["set-cookie"] as string[] | undefined;
    expect(cookies).toBeDefined();
    const refreshCookie = cookies?.find((c) => c.startsWith("tutoria_refresh_token="));
    expect(refreshCookie).toContain("tutoria_refresh_token=;");
    await app.close();
  });

  it("POST /api/v1/auth/refresh returns 401 without cookie", async () => {
    const { createApp } = await import("../src/app.js");
    const { createSupabaseAuthService } = await import("../src/lib/supabase.js");
    const { parseEnvironment } = await import("../src/config/env.js");
    const config = parseEnvironment(process.env);
    const authService = createSupabaseAuthService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const app = createApp({ config, authService });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NO_TOKEN");
    await app.close();
  });

  it("POST /api/v1/auth/sign-in with valid user sets httpOnly cookie", async () => {
    const { createApp } = await import("../src/app.js");
    const { createSupabaseAuthService } = await import("../src/lib/supabase.js");
    const { parseEnvironment } = await import("../src/config/env.js");
    const config = parseEnvironment(process.env);
    const authService = createSupabaseAuthService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const app = createApp({ config, authService });

    const email = `auth-bff-test-${randomUUID()}@example.test`;
    const { error } = await anon.auth.signUp({ email, password, options: { data: { name: "Auth BFF Test", role: "student" } } });
    if (error) throw new Error(`Signup failed: ${error.message}`);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/sign-in",
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.user).toBeDefined();
    const cookies = res.headers["set-cookie"] as string[] | undefined;
    expect(cookies).toBeDefined();
    const refreshCookie = cookies?.find((c) => c.startsWith("tutoria_refresh_token="));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("tutoria_refresh_token=");
    await app.close();
  });
});
