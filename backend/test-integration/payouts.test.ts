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
  const email = `payouts-test-${randomUUID()}@example.test`;
  return signUpConfirmed({
    anon: createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
    url: url!,
    publishableKey: key!,
    serviceRoleKey: serviceKey!,
    email,
    password,
    metadata: { name: `Payouts Test ${role}`, role },
    trustedTutor: role === "tutor",
  });
}

describe.sequential("payout routes", () => {
  let studentSession: Awaited<ReturnType<typeof signup>>;

  beforeAll(async () => {
    studentSession = await signup("student");
  });

  afterAll(() => sql.end());

  it("GET /api/v1/payouts returns 401 without auth", async () => {
    const { createApp } = await import("../src/app.js");
    const { createSupabaseAuthService } = await import("../src/lib/supabase.js");
    const { createSupabasePayoutService } = await import("../src/services/payout-service.js");
    const { parseEnvironment } = await import("../src/config/env.js");
    const config = parseEnvironment(process.env);
    const authService = createSupabaseAuthService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const payoutService = createSupabasePayoutService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const app = createApp({ config, authService, payoutService });

    const res = await app.inject({ method: "GET", url: "/api/v1/payouts" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/v1/payouts returns 200 with valid auth", async () => {
    const { createApp } = await import("../src/app.js");
    const { createSupabaseAuthService } = await import("../src/lib/supabase.js");
    const { createSupabasePayoutService } = await import("../src/services/payout-service.js");
    const { parseEnvironment } = await import("../src/config/env.js");
    const config = parseEnvironment(process.env);
    const authService = createSupabaseAuthService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const payoutService = createSupabasePayoutService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const app = createApp({ config, authService, payoutService });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/payouts",
      headers: { authorization: `Bearer ${studentSession.session.access_token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("statements");
    await app.close();
  });
});
