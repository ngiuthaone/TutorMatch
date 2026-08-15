import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";

const url = process.env.SUPABASE_TEST_URL, key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY, dbUrl = process.env.SUPABASE_TEST_DB_URL, serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Payment integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
if (!['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw new Error("Refusing non-local payment integration target.");
const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 2 });
const trusted = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const password = "Local-test-only-Password1!";

async function signup(role: "student" | "tutor") {
  const email = `payment-${randomUUID()}@example.test`;
  return signUpConfirmed({ anon, url: url!, publishableKey: key!, serviceRoleKey: serviceKey!, email, password, metadata: { name: "Payment QA", role } });
}

describe.sequential("Payment Provider V1 local proof", () => {
  beforeAll(async () => {
    await sql.unsafe(await readFile(fileURLToPath(new URL("../supabase/migrations/0008_payment_provider_v1.sql", import.meta.url)), "utf8"));
  });

  it("snapshots server pricing, gates approval, deduplicates attempts, and finalizes only after verified success", async () => {
    const tutor = await signup("tutor"), learner = await signup("student");
    await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Payment Tutor',300000,'VND')`;
    const startsAt = new Date(Date.now() + 3 * 3600e3).toISOString(), endsAt = new Date(Date.now() + 4.5 * 3600e3).toISOString();
    const session = await tutor.client.rpc("create_session", { payload: { startsAt, endsAt, maxParticipants: 1 } }); expect(session.error).toBeNull();
    const booking = await learner.client.rpc("create_booking", { session_id: session.data.id, participant_count: 1 }); expect(booking.error).toBeNull();
    const snapshot = await sql`select pricing_amount_vnd,pricing_currency,pricing_hourly_rate_vnd,pricing_duration_minutes,pricing_model from public.bookings where id=${booking.data.id}`;
    expect(snapshot[0]).toMatchObject({ pricing_amount_vnd: "450000", pricing_currency: "VND", pricing_hourly_rate_vnd: "300000", pricing_duration_minutes: 90, pricing_model: "hourly_v1" });
    await sql`update public.tutor_profiles set hourly_rate_vnd=500000 where user_id=${tutor.user.id}`;
    expect((await sql`select pricing_amount_vnd from public.bookings where id=${booking.data.id}`)[0].pricing_amount_vnd).toBe("450000");
    expect((await learner.client.rpc("start_payment_attempt", { p_booking_id: booking.data.id, p_idempotency_key: "payment-test-key-000001" })).error?.message).toContain("BOOKING_NOT_APPROVED");
    expect((await learner.client.rpc("approve_booking_for_payment", { p_booking_id: booking.data.id })).error).toBeTruthy();
    expect((await tutor.client.rpc("approve_booking_for_payment", { p_booking_id: booking.data.id })).error).toBeNull();
    const first = await learner.client.rpc("start_payment_attempt", { p_booking_id: booking.data.id, p_idempotency_key: "payment-test-key-000001" }); expect(first.error).toBeNull();
    const duplicate = await learner.client.rpc("start_payment_attempt", { p_booking_id: booking.data.id, p_idempotency_key: "payment-test-key-000001" }); expect(duplicate.data.attemptId).toBe(first.data.attemptId);
    expect((await learner.client.from("payments").select("id")).error).toBeTruthy();
    const observation = await trusted.rpc("record_vnpay_observation", { p_provider_event_key: "local-event-00000001", p_merchant_reference: first.data.merchantReference, p_outcome: "succeeded", p_provider_transaction_no: "local-txn-1", p_amount_vnd: 450000, p_payload: { fixture: true } });
    expect(observation.error).toBeNull();
    expect((await trusted.rpc("record_vnpay_observation", { p_provider_event_key: "local-event-00000001", p_merchant_reference: first.data.merchantReference, p_outcome: "succeeded", p_provider_transaction_no: "local-txn-1", p_amount_vnd: 450000, p_payload: { fixture: true } })).data.duplicate).toBe(true);
    expect((await trusted.rpc("finalize_paid_booking", { p_booking_id: booking.data.id })).data.finalized).toBe(true);
    expect((await learner.client.rpc("get_booking", { bid: booking.data.id })).data.status).toBe("confirmed");
  });

  it("creates one idempotent system-compensation obligation when finalization is impossible", async () => {
    const tutor = await signup("tutor"), learner = await signup("student");
    await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Comp Tutor',240000,'VND')`;
    const s = await tutor.client.rpc("create_session", { payload: { startsAt: new Date(Date.now()+3*3600e3).toISOString(), endsAt: new Date(Date.now()+4*3600e3).toISOString(), maxParticipants: 1 } });
    const b = await learner.client.rpc("create_booking", { session_id: s.data.id }); await tutor.client.rpc("approve_booking_for_payment", { p_booking_id: b.data.id });
    const a = await learner.client.rpc("start_payment_attempt", { p_booking_id: b.data.id, p_idempotency_key: "comp-test-key-000001" });
    const observation = await trusted.rpc("record_vnpay_observation", { p_provider_event_key: "local-event-00000002", p_merchant_reference: a.data.merchantReference, p_outcome: "succeeded", p_provider_transaction_no: "local-txn-2", p_amount_vnd: 240000, p_payload: { fixture: true } });
    expect(observation.error).toBeNull();
    await sql`update public.sessions set status='cancelled' where id=${s.data.id}`;
    expect((await trusted.rpc("finalize_paid_booking", { p_booking_id: b.data.id })).data.finalized).toBe(false);
    expect((await trusted.rpc("finalize_paid_booking", { p_booking_id: b.data.id })).data.finalized).toBe(false);
    expect((await sql`select count(*)::int as count from public.refunds r join public.payments p on p.id=r.payment_id where p.booking_id=${b.data.id} and r.kind='system_compensation'`)[0].count).toBe(1);
    expect((await sql`select status from public.payments p where p.booking_id=${b.data.id}`)[0].status).toBe("succeeded");
  });
});
