import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";
import { futureWindow, makeOffering } from "./_fixtures/offering.js";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const dbUrl = process.env.SUPABASE_TEST_DB_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Booking abuse integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Refusing non-local booking abuse target.");

const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 8 });
const password = "Local-test-only-Password1!";

async function account(role: "student" | "tutor") {
  return signUpConfirmed({
    anon,
    url,
    publishableKey: key,
    serviceRoleKey: serviceKey,
    email: `abuse-${role}-${randomUUID()}@example.test`,
    password,
    metadata: { name: "Booking Abuse QA", role },
    trustedTutor: role === "tutor",
  });
}

async function sessions(tutor: { client: ReturnType<typeof createClient> }, count: number) {
  const ids: string[] = [];
  const offeringId = await makeOffering(tutor.client, tutor.user.id, "workshop");
  for (let i = 0; i < count; i += 1) {
    const { startsAt, endsAt } = futureWindow(2 + i * 0.5);
    const result = await tutor.client.rpc("create_session", { payload: { offeringId, startsAt, endsAt, maxParticipants: 2 } });
    if (result.error || !result.data?.id) throw result.error ?? new Error("Could not create abuse-protection session");
    ids.push(result.data.id);
  }
  return ids;
}

describe.sequential("booking request account quota", () => {
  it("allows ten attempts, rejects the eleventh, and does not restore quota after cancellation", async () => {
    const tutor = await account("tutor");
    const learner = await account("student");
    await sql`insert into public.tutor_profiles(user_id, display_name, hourly_rate_vnd, currency) values (${tutor.user.id}, 'Abuse QA Tutor', 300000, 'VND')`;
    const ids = await sessions(tutor, 11);
    const results = [];
    for (const sessionId of ids) results.push(await learner.client.rpc("create_booking", { session_id: sessionId, participant_count: 1 }));
    expect(results.slice(0, 10).every((result) => !result.error)).toBe(true);
    expect(results[10].error?.message).toContain("RATE_LIMITED");
    const cancelled = await learner.client.rpc("cancel_booking", { booking_id: results[0].data.id, expected_version: results[0].data.version });
    expect(cancelled.error).toBeNull();
    const afterCancel = await learner.client.rpc("create_booking", { session_id: ids[10], participant_count: 1 });
    expect(afterCancel.error?.message).toContain("RATE_LIMITED");
  });

  it("serializes concurrent attempts so the account cannot exceed ten accepted creates", async () => {
    const tutor = await account("tutor");
    const learner = await account("student");
    await sql`insert into public.tutor_profiles(user_id, display_name, hourly_rate_vnd, currency) values (${tutor.user.id}, 'Abuse QA Tutor', 300000, 'VND')`;
    const ids = await sessions(tutor, 20);
    const results = await Promise.all(ids.map((sessionId) => learner.client.rpc("create_booking", { session_id: sessionId, participant_count: 1 })));
    expect(results.filter((result) => !result.error)).toHaveLength(10);
    expect(results.filter((result) => result.error?.message.includes("RATE_LIMITED"))).toHaveLength(10);
    const row = await sql`select count(*)::int as count from public.booking_create_attempts where learner_id = ${learner.user.id}`;
    expect(row[0].count).toBe(10);
  });
});
afterAll(async () => { await sql.end(); });
