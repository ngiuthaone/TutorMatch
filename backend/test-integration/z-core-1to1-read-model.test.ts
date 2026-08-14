import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_TEST_URL, key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY, dbUrl = process.env.SUPABASE_TEST_DB_URL;
if (!url || !key || !dbUrl) throw new Error("Core 1:1 integration tests require local Supabase environment.");
if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Refusing non-local integration target.");
const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const publicAnon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 2 });
const password = "Local-test-only-Password1!";

async function signup(role: "student" | "tutor") {
  const email = `read-model-${randomUUID()}@example.test`;
  const { data, error } = await anon.auth.signUp({ email, password, options: { data: { name: "Read Model QA", role } } });
  if (error || !data.session || !data.user) throw new Error(error?.message ?? "local signup failed");
  return { user: data.user, client: createClient(url!, key!, { global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }, auth: { persistSession: false } }) };
}

describe.sequential("core 1:1 API read-model RPCs", () => {
  beforeAll(async () => {
    const migration = await readFile(fileURLToPath(new URL("../supabase/migrations/20260814073312_core_1to1_api_read_models.sql", import.meta.url)), "utf8");
    await sql.unsafe(migration);
    const tutorIdentityMigration = await readFile(fileURLToPath(new URL("../supabase/migrations/20260814153000_booking_read_model_tutor_identity.sql", import.meta.url)), "utf8");
    await sql.unsafe(tutorIdentityMigration);
  });

  it("exposes bookable availability and product-level booking/payment capabilities", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const profile = await sql`insert into public.tutor_profiles(user_id,display_name,headline,bio,hourly_rate_vnd,currency,teaching_format,publication_status,published_at) values(${tutor.user.id},'Read Model Tutor','Available for 1:1 lessons','A sufficiently complete public profile for read model verification.',300000,'VND','online','published',now()) returning id`;
    const session = await tutor.client.rpc("create_session", { payload: { startsAt: new Date(Date.now() + 3 * 3600e3).toISOString(), endsAt: new Date(Date.now() + 4 * 3600e3).toISOString(), maxParticipants: 1 } });
    expect(session.error).toBeNull();
    const availability = await learner.client.rpc("list_bookable_sessions", { p_tutor_profile_id: profile[0].id });
    expect(availability.error).toBeNull();
    expect(availability.data).toHaveLength(1);
    expect(availability.data[0]).toMatchObject({ tutorProfileId: profile[0].id, spotsLeft: 1, hourlyRateVnd: 300000 });
    const booking = await learner.client.rpc("create_booking", { session_id: session.data.id, participant_count: 1 });
    expect(booking.error).toBeNull();
    const learnerRead = await learner.client.rpc("get_booking", { bid: booking.data.id });
    expect(learnerRead.error).toBeNull();
    expect(learnerRead.data).toMatchObject({ status: "requested", paymentRequired: true, paymentReady: false, canLearnerCancel: true, tutor: { id: profile[0].id, displayName: "Read Model Tutor" } });
    expect(learnerRead.data).not.toHaveProperty("learnerId");
    expect(JSON.stringify(learnerRead.data)).not.toMatch(/email|phone|auth|user_id|private/i);
    const tutorList = await tutor.client.rpc("get_my_tutor_bookings");
    expect(tutorList.error).toBeNull();
    expect(tutorList.data[0].id).toBe(booking.data.id);
    const approved = await tutor.client.rpc("approve_booking_for_payment", { p_booking_id: booking.data.id });
    expect(approved.error).toBeNull();
    const ready = await learner.client.rpc("get_booking", { bid: booking.data.id });
    expect(ready.data).toMatchObject({ paymentReady: true, payment: null, canTutorAccept: false, tutor: { id: profile[0].id, displayName: "Read Model Tutor" } });
    expect((await publicAnon.rpc("get_my_tutor_bookings")).error).toBeTruthy();
  });
});
