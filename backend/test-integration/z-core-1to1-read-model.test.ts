import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";

const url = process.env.SUPABASE_TEST_URL, key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY, dbUrl = process.env.SUPABASE_TEST_DB_URL, serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Core 1:1 integration tests require local Supabase environment and service role key.");
if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Refusing non-local integration target.");
const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const publicAnon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const trusted = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 2 });
const password = "Local-test-only-Password1!";

async function signup(role: "student" | "tutor") {
  const email = `read-model-${randomUUID()}@example.test`;
  const { user, session } = await signUpConfirmed({ anon, url: url!, publishableKey: key!, serviceRoleKey: serviceKey!, email, password, metadata: { name: "Read Model QA", role }, trustedTutor: role === "tutor" });
  return { user, client: createClient(url!, key!, { global: { headers: { Authorization: `Bearer ${session.access_token}` } }, auth: { persistSession: false } }) };
}

describe.sequential("core 1:1 API read-model RPCs", () => {
  beforeAll(async () => {
    const migration = await readFile(fileURLToPath(new URL("../supabase/migrations/20260814073312_core_1to1_api_read_models.sql", import.meta.url)), "utf8");
    await sql.unsafe(migration);
    const tutorIdentityMigration = await readFile(fileURLToPath(new URL("../supabase/migrations/20260814153000_booking_read_model_tutor_identity.sql", import.meta.url)), "utf8");
    await sql.unsafe(tutorIdentityMigration);
    const learnerIdentityMigration = await readFile(fileURLToPath(new URL("../supabase/migrations/20260815090002_tutor_booking_learner_identity.sql", import.meta.url)), "utf8");
    await sql.unsafe(learnerIdentityMigration);
    const phase4Migration = await readFile(fileURLToPath(new URL("../supabase/migrations/20260815124228_phase4_cancellation_api_contract.sql", import.meta.url)), "utf8");
    await sql.unsafe(phase4Migration);
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
    expect(learnerRead.data).toMatchObject({ status: "requested", paymentRequired: true, paymentReady: false, paymentInFlight: false, canLearnerCancel: true, canTutorCancel: false, tutor: { id: profile[0].id, displayName: "Read Model Tutor" } });
    expect(learnerRead.data).not.toHaveProperty("learnerId");
    expect(JSON.stringify(learnerRead.data)).not.toMatch(/email|phone|auth|user_id|private/i);
    const tutorList = await tutor.client.rpc("get_my_tutor_bookings");
    expect(tutorList.error).toBeNull();
    expect(tutorList.data[0].id).toBe(booking.data.id);
    expect(tutorList.data[0].learner).toEqual({ displayName: "Read Model QA" });
    const approved = await tutor.client.rpc("approve_booking_for_payment", { p_booking_id: booking.data.id });
    expect(approved.error).toBeNull();
    const ready = await learner.client.rpc("get_booking", { bid: booking.data.id });
    expect(ready.data).toMatchObject({ paymentReady: true, payment: null, paymentInFlight: false, canTutorAccept: false, canTutorCancel: false, tutor: { id: profile[0].id, displayName: "Read Model Tutor" } });
    const preview = await learner.client.rpc("get_booking_cancellation_preview", { bid: booking.data.id });
    expect(preview.error).toBeNull();
    expect(preview.data).toMatchObject({ allowed: true, refundMode: "NONE", policyCode: "ATTENDEE_CANCEL_UNPAID_NO_REFUND" });
    expect((await publicAnon.rpc("get_my_tutor_bookings")).error).toBeTruthy();
  });

  it("keeps preview advisory, re-evaluates the cutoff on cancel, and projects refund attention", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Phase 4 Tutor',300000,'VND')`;
    const session = await tutor.client.rpc("create_session", { payload: { startsAt: new Date(Date.now() + 26 * 3600e3).toISOString(), endsAt: new Date(Date.now() + 27 * 3600e3).toISOString(), maxParticipants: 1 } });
    const booking = await learner.client.rpc("create_booking", { session_id: session.data.id, participant_count: 1 });
    expect(booking.error).toBeNull();
    expect((await tutor.client.rpc("approve_booking_for_payment", { p_booking_id: booking.data.id })).error).toBeNull();
    const attempt = await learner.client.rpc("start_payment_attempt", { p_booking_id: booking.data.id, p_idempotency_key: `phase4-${randomUUID().replace(/-/g, "").slice(0, 20)}` });
    expect(attempt.error).toBeNull();
    expect((await trusted.rpc("record_vnpay_observation", {
      p_provider_event_key: `phase4-event-${randomUUID()}`,
      p_merchant_reference: attempt.data.merchantReference,
      p_outcome: "succeeded",
      p_provider_transaction_no: `phase4-txn-${randomUUID()}`,
      p_amount_vnd: 300000,
      p_payload: { fixture: true },
    })).error).toBeNull();
    expect((await trusted.rpc("finalize_paid_booking", { p_booking_id: booking.data.id })).error).toBeNull();
    await sql`update public.sessions set starts_at=${new Date(Date.now() + 26 * 3600e3)}, ends_at=${new Date(Date.now() + 27 * 3600e3)} where id=${session.data.id}`;
    const full = await learner.client.rpc("get_booking_cancellation_preview", { bid: booking.data.id });
    expect(full.data).toMatchObject({ allowed: true, refundMode: "FULL", refundAmountVnd: 300000 });
    await sql`update public.sessions set starts_at=${new Date(Date.now() + 23 * 3600e3)}, ends_at=${new Date(Date.now() + 24 * 3600e3)} where id=${session.data.id}`;
    const cancelled = await learner.client.rpc("cancel_booking", { booking_id: booking.data.id, expected_version: 2, cause: "attendee" });
    expect(cancelled.error).toBeNull();
    const read = await learner.client.rpc("get_booking", { bid: booking.data.id });
    expect(read.data).toMatchObject({ status: "cancelled", cancellation: { status: "cancelled", actor: "attendee" }, refund: { status: "none" }, canLearnerCancel: false });
    const payment = await sql`select id, amount_vnd from public.payments where booking_id=${booking.data.id}`;
    await sql`insert into public.refunds(payment_id,kind,status,amount_vnd,idempotency_key,reason) values(${payment[0].id},'standard','failed',${payment[0].amount_vnd},${`phase4-failed-${randomUUID()}`},'Phase 4 projection fixture')`;
    const failed = await learner.client.rpc("get_booking", { bid: booking.data.id });
    expect(failed.data).toMatchObject({ status: "cancelled", refund: { status: "needs_attention" }, canLearnerCancel: false });
  });
});
