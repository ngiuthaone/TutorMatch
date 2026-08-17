import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const dbUrl = process.env.SUPABASE_TEST_DB_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Tutor authorization tests require local Supabase configuration.");
if (!["localhost", "127.0.0.1", "host.docker.internal"].includes(new URL(url).hostname)) throw new Error("Refusing non-local authorization target.");

const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 2 });
const password = "Local-test-only-Password1!";

async function signup(metadata: Record<string, unknown>, trustedTutor = false) {
  return signUpConfirmed({
    anon,
    url: url!,
    publishableKey: key!,
    serviceRoleKey: serviceKey!,
    email: `authz-${randomUUID()}@example.test`,
    password,
    metadata,
    trustedTutor,
  });
}

describe.sequential("Tutor authorization hardening", () => {
  beforeAll(async () => {
    const migration = await readFile(fileURLToPath(new URL("../supabase/migrations/20260815150540_tutor_authorization_hardening.sql", import.meta.url)), "utf8");
    await sql.unsafe(migration);
  });

  it("does not grant Tutor authority from signup or edited user metadata", async () => {
    const learner = await signup({ name: "Malicious Signup", role: "tutor" });
    const profile = await learner.client.from("profiles").select("role").eq("id", learner.user.id).single();
    expect(profile.data?.role).toBe("student");
    expect((await learner.client.rpc("get_my_tutor_cv")).error).toBeTruthy();
    expect((await learner.client.rpc("enable_tutor", { target_user_id: learner.user.id })).error).toBeTruthy();

    await learner.client.auth.setSession(learner.session);
    const edited = await learner.client.auth.updateUser({ data: { role: "tutor", isTutor: true } });
    expect(edited.error).toBeNull();
    const afterEdit = await learner.client.from("profiles").select("role").eq("id", learner.user.id).single();
    expect(afterEdit.data?.role).toBe("student");
    expect((await learner.client.rpc("get_my_tutor_cv")).error).toBeTruthy();
  });

  it("enables a Tutor only through the trusted path and preserves Tutor learner capability", async () => {
    const tutorA = await signup({ name: "Trusted Tutor A", role: "tutor" }, true);
    const tutorB = await signup({ name: "Trusted Tutor B" }, true);
    const learner = await signup({ name: "Ordinary Learner", role: "student" });
    expect((await tutorA.client.rpc("get_my_tutor_cv")).error).toBeNull();

    const startsAt = new Date(Date.now() + 2 * 3600e3).toISOString();
    const endsAt = new Date(Date.now() + 3 * 3600e3).toISOString();
    await sql`insert into public.tutor_profiles(user_id, display_name, hourly_rate_vnd, currency) values (${tutorB.user.id}, 'Trusted Tutor B', 300000, 'VND')`;
    const session = await tutorB.client.rpc("create_session", { payload: { startsAt, endsAt, maxParticipants: 2 } });
    expect(session.error).toBeNull();
    const booking = await tutorA.client.rpc("create_booking", { session_id: session.data.id, participant_count: 1 });
    expect(booking.error).toBeNull();
    expect((await learner.client.rpc("create_session", { payload: { startsAt, endsAt, maxParticipants: 2 } })).error).toBeTruthy();
    expect((await learner.client.rpc("approve_booking_for_payment", { p_booking_id: booking.data.id })).error).toBeTruthy();
  });
});
