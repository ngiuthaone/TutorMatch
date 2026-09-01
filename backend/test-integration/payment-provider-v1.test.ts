import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";
import { makeOffering } from "./_fixtures/offering.js";

const url = process.env.SUPABASE_TEST_URL, key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY, dbUrl = process.env.SUPABASE_TEST_DB_URL, serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Payment integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
if (!['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw new Error("Refusing non-local payment integration target.");
const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 2 });
const trusted = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const password = "Local-test-only-Password1!";

const MIGRATIONS = [
  "0001_create_profiles.sql",
  "0002_create_tutor_cvs.sql",
  "0004_create_sessions_and_bookings.sql",
  "0005_create_booking_session_rpcs.sql",
  "0006_create_event_outbox.sql",
  "0007_emit_domain_events_from_booking_session_rpcs.sql",
  "0008_payment_provider_v1.sql",
  "0009_vnpay_execution_reconciliation.sql",
  "0010_create_cancellation_refund_obligations.sql",
  "20260815090000_booking_request_abuse_protection.sql",
  "20260815090001_enforce_booking_request_security.sql",
];

async function signup(role: "student" | "tutor") {
  const email = `payment-${randomUUID()}@example.test`;
  return signUpConfirmed({ anon, url: url!, publishableKey: key!, serviceRoleKey: serviceKey!, email, password, metadata: { name: "Payment QA", role }, trustedTutor: role === "tutor" });
}

async function paidConfirmedBooking(rate = 300000) {
  const tutor = await signup("tutor"), learner = await signup("student");
  await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Payment Tutor',${rate},'VND')`;
  const offeringId = await makeOffering(tutor.client, tutor.user.id, "workshop", "hourly_v1", { hourlyRateVnd: rate });
  const session = await tutor.client.rpc("create_session", { payload: { offeringId, startsAt: new Date(Date.now() + 3 * 3600e3).toISOString(), endsAt: new Date(Date.now() + 4.5 * 3600e3).toISOString(), maxParticipants: 1 } });
  if (session.error) throw session.error;
  const booking = await learner.client.rpc("create_booking", { session_id: session.data.id, participant_count: 1 });
  if (booking.error) throw booking.error;
  await tutor.client.rpc("approve_booking_for_payment", { p_booking_id: booking.data.id });
  const attempt = await learner.client.rpc("start_payment_attempt", { p_booking_id: booking.data.id, p_idempotency_key: `pk-${randomUUID().slice(0, 20)}` });
  if (attempt.error) throw attempt.error;
  return { tutor, learner, session, booking, attempt, rate };
}

describe.sequential("Payment Provider V1 local proof", () => {
  beforeAll(async () => {
    for (const n of MIGRATIONS) {
      const m = await readFile(fileURLToPath(new URL(`../supabase/migrations/${n}`, import.meta.url)), "utf8");
      await sql.unsafe(m);
    }
  });

  it("snapshots server pricing, gates approval, deduplicates attempts, and finalizes only after verified success", async () => {
    const tutor = await signup("tutor"), learner = await signup("student");
    await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Payment Tutor',300000,'VND')`;
    const startsAt = new Date(Date.now() + 3 * 3600e3).toISOString(), endsAt = new Date(Date.now() + 4.5 * 3600e3).toISOString();
    const offeringId2 = await makeOffering(tutor.client, tutor.user.id, "workshop", "hourly_v1", { hourlyRateVnd: 300000 });
    const session = await tutor.client.rpc("create_session", { payload: { offeringId: offeringId2, startsAt, endsAt, maxParticipants: 1 } }); expect(session.error).toBeNull();
    const booking = await learner.client.rpc("create_booking", { session_id: session.data.id, participant_count: 1 }); expect(booking.error).toBeNull();
    const snapshot = await sql`select pricing_amount_vnd,pricing_currency,pricing_hourly_rate_vnd,pricing_duration_minutes,pricing_model from public.bookings where id=${booking.data.id}`;
    expect(snapshot[0]).toMatchObject({ pricing_amount_vnd: "450000", pricing_currency: "VND", pricing_hourly_rate_vnd: "300000", pricing_duration_minutes: 90, pricing_model: "hourly_v1" });
    await sql`update public.tutor_profiles set hourly_rate_vnd=500000 where user_id=${tutor.user.id}`;
    expect((await sql`select pricing_amount_vnd from public.bookings where id=${booking.data.id}`)[0].pricing_amount_vnd).toBe("450000");
    const attemptKey = `payment-test-key-${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    expect((await learner.client.rpc("start_payment_attempt", { p_booking_id: booking.data.id, p_idempotency_key: attemptKey })).error?.message).toContain("BOOKING_NOT_APPROVED");
    expect((await learner.client.rpc("approve_booking_for_payment", { p_booking_id: booking.data.id })).error).toBeTruthy();
    expect((await tutor.client.rpc("approve_booking_for_payment", { p_booking_id: booking.data.id })).error).toBeNull();
    const first = await learner.client.rpc("start_payment_attempt", { p_booking_id: booking.data.id, p_idempotency_key: attemptKey }); expect(first.error).toBeNull();
    const duplicate = await learner.client.rpc("start_payment_attempt", { p_booking_id: booking.data.id, p_idempotency_key: attemptKey }); expect(duplicate.data.attemptId).toBe(first.data.attemptId);
    expect((await learner.client.from("payments").select("id")).error).toBeTruthy();
    const providerEventKey = `local-event-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const observation = await trusted.rpc("record_vnpay_observation", { p_provider_event_key: providerEventKey, p_merchant_reference: first.data.merchantReference, p_outcome: "succeeded", p_provider_transaction_no: "local-txn-1", p_amount_vnd: 450000, p_payload: { fixture: true } });
    expect(observation.error).toBeNull();
    expect((await trusted.rpc("record_vnpay_observation", { p_provider_event_key: providerEventKey, p_merchant_reference: first.data.merchantReference, p_outcome: "succeeded", p_provider_transaction_no: "local-txn-1", p_amount_vnd: 450000, p_payload: { fixture: true } })).data.duplicate).toBe(true);
    expect((await trusted.rpc("finalize_paid_booking", { p_booking_id: booking.data.id })).data.finalized).toBe(true);
    expect((await learner.client.rpc("get_booking", { bid: booking.data.id })).data.status).toBe("confirmed");
  });

  it("finalizes a paid booking exactly once; duplicate finalize creates no spurious compensation", async () => {
    const { learner, booking, attempt, rate } = await paidConfirmedBooking();
    const observation = await trusted.rpc("record_vnpay_observation", { p_provider_event_key: `local-event-${randomUUID().replace(/-/g, "").slice(0, 16)}`, p_merchant_reference: attempt.data.merchantReference, p_outcome: "succeeded", p_provider_transaction_no: `local-txn-${randomUUID()}`, p_amount_vnd: rate * 90 / 60, p_payload: { fixture: true } });
    expect(observation.error).toBeNull();
    const first = await trusted.rpc("finalize_paid_booking", { p_booking_id: booking.data.id });
    expect(first.data.finalized).toBe(true);
    expect((await learner.client.rpc("get_booking", { bid: booking.data.id })).data.status).toBe("confirmed");
    const second = await trusted.rpc("finalize_paid_booking", { p_booking_id: booking.data.id });
    expect(second.data.finalized).toBe(false);
    const refunds = await sql`select count(*)::int as count from public.refunds r join public.payments p on p.id=r.payment_id where p.booking_id=${booking.data.id}`;
    expect(refunds[0].count).toBe(0);
  });

  it("creates one idempotent system-compensation obligation only when the payment was in flight at cancellation (P4)", async () => {
    const tutor = await signup("tutor"), learner = await signup("student");
    await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Comp Tutor',240000,'VND')`;
    const offeringId3 = await makeOffering(tutor.client, tutor.user.id, "workshop", "hourly_v1", { hourlyRateVnd: 240000 });
    const s = await tutor.client.rpc("create_session", { payload: { offeringId: offeringId3, startsAt: new Date(Date.now()+3*3600e3).toISOString(), endsAt: new Date(Date.now()+4*3600e3).toISOString(), maxParticipants: 1 } });
    const b = await learner.client.rpc("create_booking", { session_id: s.data.id }); await tutor.client.rpc("approve_booking_for_payment", { p_booking_id: b.data.id });
    const a = await learner.client.rpc("start_payment_attempt", { p_booking_id: b.data.id, p_idempotency_key: `comp-test-key-${randomUUID().replace(/-/g, "").slice(0, 20)}` });
    expect(a.error).toBeNull();
    const cancel = await tutor.client.rpc("cancel_session", { sid: s.data.id, expected_version: s.data.version });
    expect(cancel.error).toBeNull();
    expect((await sql`select cancel_payment_in_flight_at is not null as marker from public.bookings where id=${b.data.id}`)[0].marker).toBe(true);
    const observation = await trusted.rpc("record_vnpay_observation", { p_provider_event_key: `local-event-${randomUUID().replace(/-/g, "").slice(0, 16)}`, p_merchant_reference: a.data.merchantReference, p_outcome: "succeeded", p_provider_transaction_no: "local-txn-2", p_amount_vnd: 240000, p_payload: { fixture: true } });
    expect(observation.error).toBeNull();
    expect((await trusted.rpc("finalize_paid_booking", { p_booking_id: b.data.id })).data.finalized).toBe(false);
    expect((await trusted.rpc("finalize_paid_booking", { p_booking_id: b.data.id })).data.finalized).toBe(false);
    const refunds = await sql`select count(*)::int as count from public.refunds r join public.payments p on p.id=r.payment_id where p.booking_id=${b.data.id} and r.kind='system_compensation'`;
    expect(refunds[0].count).toBe(1);
    expect((await sql`select status from public.payments p where p.booking_id=${b.data.id}`)[0].status).toBe("succeeded");
    expect((await sql`select r.status from public.refunds r join public.payments p on p.id=r.payment_id where p.booking_id=${b.data.id}`)[0].status).toBe("obligation");
  });
});

afterAll(() => sql.end());
