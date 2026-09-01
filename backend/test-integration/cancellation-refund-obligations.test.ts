import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";
import { CANCELLATION_REFUND_CUTOFF_HOURS } from "../src/domain/cancellation-refund-policy.js";
import { makeOffering } from "./_fixtures/offering.js";

const url = process.env.SUPABASE_TEST_URL, key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY, dbUrl = process.env.SUPABASE_TEST_DB_URL, serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Cancellation/refund integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Refusing non-local cancellation integration target.");
const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 4 });
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
  "0013_serialize_cancellation_races.sql",
  "20260815090000_booking_request_abuse_protection.sql",
  "20260815090001_enforce_booking_request_security.sql",
];

async function signup(role: "student" | "tutor") {
  const email = `cancel-${randomUUID()}@example.test`;
  return signUpConfirmed({ anon, url: url!, publishableKey: key!, serviceRoleKey: serviceKey!, email, password, metadata: { name: "Cancel QA", role }, trustedTutor: role === "tutor" });
}

async function createSession(tutor: { client: SupabaseClient }, startsAt: Date, endsAt: Date, maxParticipants = 4) {
  const offeringId = await makeOffering(tutor.client, tutor.user.id, "workshop");
  const r = await tutor.client.rpc("create_session", { payload: { offeringId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), maxParticipants } });
  if (r.error) throw r.error;
  return r.data as { id: string; version: number };
}

async function createBooking(learner: { client: SupabaseClient }, sessionId: string) {
  const r = await learner.client.rpc("create_booking", { session_id: sessionId, participant_count: 1 });
  if (r.error) throw r.error;
  return r.data as { id: string; version: number; status: string };
}

async function approveAndPay(tutor: { client: SupabaseClient }, learner: { client: SupabaseClient }, bookingId: string, rate: number) {
  const approved = await tutor.client.rpc("approve_booking_for_payment", { p_booking_id: bookingId });
  if (approved.error) throw approved.error;
  const attempt = await learner.client.rpc("start_payment_attempt", { p_booking_id: bookingId, p_idempotency_key: `ob-${randomUUID().replace(/-/g, "").slice(0, 24)}` });
  if (attempt.error) throw attempt.error;
  const observed = await trusted.rpc("record_vnpay_observation", {
    p_provider_event_key: `local-event-${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    p_merchant_reference: attempt.data.merchantReference,
    p_outcome: "succeeded",
    p_provider_transaction_no: `local-txn-${randomUUID()}`,
    p_amount_vnd: rate,
    p_payload: { fixture: true },
  });
  if (observed.error) throw observed.error;
  const finalized = await trusted.rpc("finalize_paid_booking", { p_booking_id: bookingId });
  if (finalized.error) throw finalized.error;
  if (!finalized.data.finalized) throw new Error("expected paid booking to finalize");
  return attempt.data as { paymentId: string; attemptId: string; merchantReference: string };
}

async function confirmedPaidBooking(rate = 300000, maxParticipants = 4) {
  const tutor = await signup("tutor"), learner = await signup("student");
  await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Cancel Tutor',${rate},'VND')`;
  const session = await createSession(tutor, new Date(Date.now() + 3 * 3600e3), new Date(Date.now() + 4 * 3600e3), maxParticipants);
  const booking = await createBooking(learner, session.id);
  const payment = await approveAndPay(tutor, learner, booking.id, rate);
  return { tutor, learner, session, booking, payment };
}

async function paidButUnfinalizedBooking(rate = 300000, maxParticipants = 4) {
  const tutor = await signup("tutor"), learner = await signup("student");
  await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Cancel Tutor',${rate},'VND')`;
  const session = await createSession(tutor, new Date(Date.now() + 3 * 3600e3), new Date(Date.now() + 4 * 3600e3), maxParticipants);
  const booking = await createBooking(learner, session.id);
  const approved = await tutor.client.rpc("approve_booking_for_payment", { p_booking_id: booking.id });
  if (approved.error) throw approved.error;
  const attempt = await learner.client.rpc("start_payment_attempt", { p_booking_id: booking.id, p_idempotency_key: `ob-${randomUUID().replace(/-/g, "").slice(0, 24)}` });
  if (attempt.error) throw attempt.error;
  const observed = await trusted.rpc("record_vnpay_observation", {
    p_provider_event_key: `local-event-${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    p_merchant_reference: attempt.data.merchantReference,
    p_outcome: "succeeded",
    p_provider_transaction_no: `local-txn-${randomUUID()}`,
    p_amount_vnd: rate,
    p_payload: { fixture: true },
  });
  if (observed.error) throw observed.error;
  return { tutor, learner, session, booking, payment: attempt.data as { paymentId: string; attemptId: string; merchantReference: string } };
}

async function setSessionTime(sid: string, startsAt: Date, endsAt: Date) {
  await sql`update public.sessions set starts_at=${startsAt}, ends_at=${endsAt} where id=${sid}`;
}

async function bookingRow(bid: string) {
  return (await sql`select * from public.bookings where id=${bid}`)[0];
}

async function bookingVersion(bid: string) {
  return (await sql`select version from public.bookings where id=${bid}`)[0].version as number;
}

async function sessionVersion(sid: string) {
  return (await sql`select version from public.sessions where id=${sid}`)[0].version as number;
}

async function obligations(bid: string) {
  return (await sql`select r.*, p.amount_vnd as payment_amount from public.refunds r join public.payments p on p.id=r.payment_id where p.booking_id=${bid} order by r.created_at`);
}

async function outboxRows(aggregateId: string) {
  return (await sql`select event_type, aggregate_type, aggregate_id, aggregate_version, payload from public.event_outbox where aggregate_id=${aggregateId} order by occurred_at, id`);
}

async function paymentEvents(paymentId: string) {
  return (await sql`select event_type, from_status, to_status, amount_vnd from public.payment_events where payment_id=${paymentId} order by occurred_at, id`);
}

describe.sequential("Cancellation refund obligations (Phase 2)", () => {
  beforeAll(async () => {
    for (const n of MIGRATIONS) {
      const m = await readFile(fileURLToPath(new URL(`../supabase/migrations/${n}`, import.meta.url)), "utf8");
      await sql.unsafe(m);
    }
    await sql`drop function if exists public.create_booking(uuid, integer)`;
  });

  it("keeps the SQL cutoff in sync with the pure TS policy oracle", async () => {
    expect(CANCELLATION_REFUND_CUTOFF_HOURS).toBe(24);
    const cutoff = await sql`select public.cancellation_refund_cutoff() as v`;
    const hours = Number(String(cutoff[0].v).split(":")[0]);
    expect(hours).toBe(24);
  });

  it("P1: learner cancels confirmed+paid at least 24h before start -> FULL standard obligation", async () => {
    const { tutor, learner, session, booking, payment } = await confirmedPaidBooking();
    await setSessionTime(session.id, new Date(Date.now() + 25 * 3600e3), new Date(Date.now() + 26 * 3600e3));
    const cancel = await learner.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: await bookingVersion(booking.id), cause: "attendee", reason: "learner changed plans" });
    expect(cancel.error).toBeNull();
    const row = await bookingRow(booking.id);
    expect(row.status).toBe("cancelled");
    expect(row.cancelled_by).toBe("attendee");
    expect(row.cancelled_reason).toBe("learner changed plans");
    expect(row.cancel_payment_in_flight_at).toBeNull();
    const refunds = await obligations(booking.id);
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ kind: "standard", status: "obligation" });
    expect(Number(refunds[0].payment_amount)).toBe(300000);
    expect(Number(refunds[0].amount_vnd)).toBe(Number(refunds[0].payment_amount));
    expect(refunds[0].idempotency_key).toBe(`cancel:attendee:${booking.id}`);
    expect(refunds[0].reason).toContain("P1");
    const events = await paymentEvents(payment.paymentId);
    expect(events.some((e) => e.event_type === "refund_obligation_created")).toBe(true);
    const outbox = await outboxRows(booking.id);
    expect(outbox.some((o) => o.event_type === "BOOKING_CANCELLED")).toBe(true);
    const paybox = await outboxRows(payment.paymentId);
    expect(paybox.some((o) => o.event_type === "REFUND_OBLIGATION_CREATED" && o.aggregate_type === "payment")).toBe(true);
  });

  it("P2: learner cancels confirmed+paid within 24h of start -> no obligation", async () => {
    const { tutor, learner, session, booking, payment } = await confirmedPaidBooking();
    await setSessionTime(session.id, new Date(Date.now() + 1 * 3600e3), new Date(Date.now() + 2 * 3600e3));
    const cancel = await learner.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: await bookingVersion(booking.id), cause: "attendee" });
    expect(cancel.error).toBeNull();
    expect((await bookingRow(booking.id)).status).toBe("cancelled");
    expect(await obligations(booking.id)).toHaveLength(0);
    expect((await paymentEvents(payment.paymentId)).some((e) => e.event_type === "refund_obligation_created")).toBe(false);
  });

  it("boundary: >=24h is refundable, <24h is not", async () => {
    const refundable = await confirmedPaidBooking(200000);
    await setSessionTime(refundable.session.id, new Date(Date.now() + 24 * 3600e3 + 10_000), new Date(Date.now() + 25 * 3600e3));
    expect((await refundable.learner.client.rpc("cancel_booking", { booking_id: refundable.booking.id, expected_version: await bookingVersion(refundable.booking.id), cause: "attendee" })).error).toBeNull();
    expect(await obligations(refundable.booking.id)).toHaveLength(1);

    const notRefundable = await confirmedPaidBooking(200000);
    await setSessionTime(notRefundable.session.id, new Date(Date.now() + 24 * 3600e3 - 10_000), new Date(Date.now() + 25 * 3600e3));
    expect((await notRefundable.learner.client.rpc("cancel_booking", { booking_id: notRefundable.booking.id, expected_version: await bookingVersion(notRefundable.booking.id), cause: "attendee" })).error).toBeNull();
    expect(await obligations(notRefundable.booking.id)).toHaveLength(0);
  });

  it("P3: learner cancels an unpaid requested booking -> cancelled, no obligation", async () => {
    const tutor = await signup("tutor"), learner = await signup("student");
    await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Cancel Tutor',300000,'VND')`;
    const session = await createSession(tutor, new Date(Date.now() + 3 * 3600e3), new Date(Date.now() + 4 * 3600e3));
    const booking = await createBooking(learner, session.id);
    const cancel = await learner.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: booking.version, cause: "attendee" });
    expect(cancel.error).toBeNull();
    expect((await bookingRow(booking.id)).status).toBe("cancelled");
    expect(await obligations(booking.id)).toHaveLength(0);
  });

  it("P5: host cancels confirmed+paid booking -> FULL standard obligation regardless of timing", async () => {
    const { tutor, learner, session, booking, payment } = await confirmedPaidBooking();
    await setSessionTime(session.id, new Date(Date.now() + 30 * 60e3), new Date(Date.now() + 90 * 60e3));
    const cancel = await tutor.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: await bookingVersion(booking.id), cause: "host", reason: "tutor availability" });
    expect(cancel.error).toBeNull();
    const row = await bookingRow(booking.id);
    expect(row.status).toBe("cancelled");
    expect(row.cancelled_by).toBe("host");
    const refunds = await obligations(booking.id);
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ kind: "standard", status: "obligation" });
    expect(refunds[0].idempotency_key).toBe(`cancel:host:${booking.id}`);
    expect(refunds[0].reason).toContain("P5");
    expect(Number(refunds[0].amount_vnd)).toBe(Number(refunds[0].payment_amount));
    expect((await paymentEvents(payment.paymentId)).some((e) => e.event_type === "refund_obligation_created")).toBe(true);
  });

  it("P6: whole-session cancel refunds every paid booking, not the unpaid one", async () => {
    const tutor = await signup("tutor");
    await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Cancel Tutor',250000,'VND')`;
    const session = await createSession(tutor, new Date(Date.now() + 3 * 3600e3), new Date(Date.now() + 4 * 3600e3), 4);
    const learner1 = await signup("student"), learner2 = await signup("student"), learner3 = await signup("student");
    const b1 = await createBooking(learner1, session.id);
    const b2 = await createBooking(learner2, session.id);
    const b3 = await createBooking(learner3, session.id);
    const pay1 = await approveAndPay(tutor, learner1, b1.id, 250000);
    await approveAndPay(tutor, learner2, b2.id, 250000);
    const cancel = await tutor.client.rpc("cancel_session", { sid: session.id, expected_version: session.version, cause: "host", reason: "session cancelled" });
    expect(cancel.error).toBeNull();
    expect((await sql`select status from public.sessions where id=${session.id}`)[0].status).toBe("cancelled");
    for (const b of [b1, b2, b3]) {
      expect((await bookingRow(b.id)).status).toBe("cancelled");
    }
    const r1 = await obligations(b1.id), r2 = await obligations(b2.id), r3 = await obligations(b3.id);
    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);
    expect(r3).toHaveLength(0);
    for (const [r, bid] of [[r1[0], b1.id], [r2[0], b2.id]] as const) {
      expect(r).toMatchObject({ kind: "standard", status: "obligation" });
      expect(Number(r.amount_vnd)).toBe(250000);
      expect(r.idempotency_key).toBe(`cancel:session:${bid}`);
    }
    const outbox = await outboxRows(session.id);
    expect(outbox.some((o) => o.event_type === "SESSION_CANCELLED")).toBe(true);
    const b1box = await outboxRows(b1.id);
    expect(b1box.some((o) => o.event_type === "BOOKING_CANCELLED")).toBe(true);
    const pay1box = await outboxRows(pay1.paymentId);
    expect(pay1box.some((o) => o.event_type === "REFUND_OBLIGATION_CREATED")).toBe(true);
  });

  it("P4: cancel while payment is in flight -> durable marker, no obligation; late success -> one idempotent system_compensation", async () => {
    const tutor = await signup("tutor"), learner = await signup("student");
    await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Cancel Tutor',180000,'VND')`;
    const session = await createSession(tutor, new Date(Date.now() + 3 * 3600e3), new Date(Date.now() + 4 * 3600e3));
    const booking = await createBooking(learner, session.id);
    const approved = await tutor.client.rpc("approve_booking_for_payment", { p_booking_id: booking.id });
    expect(approved.error).toBeNull();
    const attempt = await learner.client.rpc("start_payment_attempt", { p_booking_id: booking.id, p_idempotency_key: `pf-${randomUUID().replace(/-/g, "").slice(0, 24)}` });
    expect(attempt.error).toBeNull();
    const cancel = await learner.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: await bookingVersion(booking.id), cause: "attendee" });
    expect(cancel.error).toBeNull();
    const row = await bookingRow(booking.id);
    expect(row.status).toBe("cancelled");
    expect(row.cancel_payment_in_flight_at).not.toBeNull();
    expect(await obligations(booking.id)).toHaveLength(0);
    const observed = await trusted.rpc("record_vnpay_observation", { p_provider_event_key: `local-event-${randomUUID().replace(/-/g, "").slice(0, 16)}`, p_merchant_reference: attempt.data.merchantReference, p_outcome: "succeeded", p_provider_transaction_no: `local-txn-${randomUUID()}`, p_amount_vnd: 180000, p_payload: { fixture: true } });
    expect(observed.error).toBeNull();
    const first = await trusted.rpc("finalize_paid_booking", { p_booking_id: booking.id });
    expect(first.data.finalized).toBe(false);
    const second = await trusted.rpc("finalize_paid_booking", { p_booking_id: booking.id });
    expect(second.data.finalized).toBe(false);
    const refunds = await obligations(booking.id);
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ kind: "system_compensation", status: "obligation" });
    expect(Number(refunds[0].amount_vnd)).toBe(180000);
    expect(refunds[0].idempotency_key).toBe(`compensation:${attempt.data.paymentId}`);
    expect((await bookingRow(booking.id)).status).toBe("cancelled");
    expect((await sql`select status from public.payments where id=${attempt.data.paymentId}`)[0].status).toBe("succeeded");
  });

  it("P4 fail side: payment that fails after cancellation never creates an obligation", async () => {
    const tutor = await signup("tutor"), learner = await signup("student");
    await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Cancel Tutor',150000,'VND')`;
    const session = await createSession(tutor, new Date(Date.now() + 3 * 3600e3), new Date(Date.now() + 4 * 3600e3));
    const booking = await createBooking(learner, session.id);
    await tutor.client.rpc("approve_booking_for_payment", { p_booking_id: booking.id });
    const attempt = await learner.client.rpc("start_payment_attempt", { p_booking_id: booking.id, p_idempotency_key: `ff-${randomUUID().replace(/-/g, "").slice(0, 24)}` });
    const cancel = await learner.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: await bookingVersion(booking.id), cause: "attendee" });
    expect(cancel.error).toBeNull();
    expect((await bookingRow(booking.id)).cancel_payment_in_flight_at).not.toBeNull();
    await trusted.rpc("record_vnpay_observation", { p_provider_event_key: `local-event-${randomUUID().replace(/-/g, "").slice(0, 16)}`, p_merchant_reference: attempt.data.merchantReference, p_outcome: "failed", p_provider_transaction_no: `local-txn-${randomUUID()}`, p_amount_vnd: 150000, p_payload: { fixture: true } });
    expect((await trusted.rpc("finalize_paid_booking", { p_booking_id: booking.id })).data.finalized).toBe(false);
    expect(await obligations(booking.id)).toHaveLength(0);
    expect((await sql`select status from public.payments where id=${attempt.data.paymentId}`)[0].status).toBe("failed");
  });

  it("guard: cancelled AFTER success gets only the standard obligation, never a spurious compensation", async () => {
    const { tutor, learner, session, booking, payment } = await confirmedPaidBooking(220000);
    await setSessionTime(session.id, new Date(Date.now() + 25 * 3600e3), new Date(Date.now() + 26 * 3600e3));
    expect((await learner.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: await bookingVersion(booking.id), cause: "attendee" })).error).toBeNull();
    expect((await bookingRow(booking.id)).cancel_payment_in_flight_at).toBeNull();
    expect((await trusted.rpc("finalize_paid_booking", { p_booking_id: booking.id })).data.finalized).toBe(false);
    const refunds = await obligations(booking.id);
    expect(refunds).toHaveLength(1);
    expect(refunds[0].kind).toBe("standard");
    expect((await paymentEvents(payment.paymentId)).filter((e) => e.event_type === "refund_obligation_created")).toHaveLength(1);
  });

  it("finalize exactly once on the happy path; repeat is a no-op with no obligation", async () => {
    const { tutor, learner, session, booking, payment } = await confirmedPaidBooking();
    expect((await trusted.rpc("finalize_paid_booking", { p_booking_id: booking.id })).data.finalized).toBe(false);
    expect((await bookingRow(booking.id)).status).toBe("confirmed");
    expect(await obligations(booking.id)).toHaveLength(0);
  });

  it("P9: no-show recording stays financial-neutral and never sets the in-flight marker", async () => {
    const { tutor, learner, session, booking } = await confirmedPaidBooking(260000);
    await setSessionTime(session.id, new Date(Date.now() - 2 * 3600e3), new Date(Date.now() - 1 * 3600e3));
    const r = await tutor.client.rpc("record_attendance", { booking_id: booking.id, outcome: "learner_no_show", expected_version: await bookingVersion(booking.id), source: "host-flag" });
    expect(r.error).toBeNull();
    const row = await bookingRow(booking.id);
    expect(row.status).toBe("cancelled");
    expect(row.cancelled_reason).toBe("learner_no_show");
    expect(row.cancel_payment_in_flight_at).toBeNull();
    expect(await obligations(booking.id)).toHaveLength(0);
  });

  it("cancel_booking terminates the booking's pending reschedule request (RESCHEDULE_CANCELLED)", async () => {
    const tutor = await signup("tutor"), learner = await signup("student");
    await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Cancel Tutor',300000,'VND')`;
    const s1 = await createSession(tutor, new Date(Date.now() + 3 * 3600e3), new Date(Date.now() + 4 * 3600e3));
    const s2 = await createSession(tutor, new Date(Date.now() + 5 * 3600e3), new Date(Date.now() + 6 * 3600e3));
    const booking = await createBooking(learner, s1.id);
    await approveAndPay(tutor, learner, booking.id, 300000);
    const req = await learner.client.rpc("create_reschedule_request", { booking_id: booking.id, target_session_id: s2.id, expected_version: await bookingVersion(booking.id) });
    expect(req.error).toBeNull();
    expect((await sql`select status from public.reschedule_requests where id=${req.data.id}`)[0].status).toBe("requested");
    expect((await learner.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: await bookingVersion(booking.id), cause: "attendee" })).error).toBeNull();
    expect((await sql`select status, resolved_at from public.reschedule_requests where id=${req.data.id}`)[0].status).toBe("cancelled");
    const outbox = await outboxRows(booking.id);
    expect(outbox.some((o) => o.event_type === "RESCHEDULE_CANCELLED" && o.payload?.requestId === req.data.id)).toBe(true);
  });

  it("cancel_session cancels pending requests targeting the session without touching other bookings", async () => {
    const tutor = await signup("tutor"), learnerA = await signup("student"), learnerB = await signup("student");
    await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Cancel Tutor',300000,'VND')`;
    const s1 = await createSession(tutor, new Date(Date.now() + 3 * 3600e3), new Date(Date.now() + 4 * 3600e3));
    const s2 = await createSession(tutor, new Date(Date.now() + 5 * 3600e3), new Date(Date.now() + 6 * 3600e3));
    const bA = await createBooking(learnerA, s1.id);
    const bB = await createBooking(learnerB, s2.id);
    const reqA = await learnerA.client.rpc("create_reschedule_request", { booking_id: bA.id, target_session_id: s2.id, expected_version: await bookingVersion(bA.id) });
    const reqB = await learnerB.client.rpc("create_reschedule_request", { booking_id: bB.id, target_session_id: s1.id, expected_version: await bookingVersion(bB.id) });
    expect(reqA.error).toBeNull();
    expect(reqB.error).toBeNull();
    expect((await tutor.client.rpc("cancel_session", { sid: s1.id, expected_version: s1.version })).error).toBeNull();
    expect((await sql`select status from public.reschedule_requests where id=${reqA.data.id}`)[0].status).toBe("cancelled");
    expect((await sql`select status from public.reschedule_requests where id=${reqB.data.id}`)[0].status).toBe("cancelled");
    expect((await bookingRow(bA.id)).status).toBe("cancelled");
    expect((await bookingRow(bB.id)).status).toBe("requested");
    expect((await sql`select status from public.sessions where id=${s2.id}`)[0].status).toBe("scheduled");
    const bBox = await outboxRows(bB.id);
    expect(bBox.some((o) => o.event_type === "RESCHEDULE_CANCELLED" && o.payload?.requestId === reqB.data.id)).toBe(true);
    expect(bBox.some((o) => o.event_type === "BOOKING_CANCELLED")).toBe(false);
  });

  it("legality: attendee cannot cancel as host, host cannot cancel a requested booking, outsiders are rejected", async () => {
    const tutor = await signup("tutor"), learner = await signup("student"), outsider = await signup("student");
    await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Cancel Tutor',300000,'VND')`;
    const session = await createSession(tutor, new Date(Date.now() + 3 * 3600e3), new Date(Date.now() + 4 * 3600e3));
    const booking = await createBooking(learner, session.id);
    const wrongCause = await learner.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: booking.version, cause: "host" });
    expect(wrongCause.error?.message ?? "").toContain("INVALID_TRANSITION");
    const hostCancelRequested = await tutor.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: booking.version, cause: "host" });
    expect(hostCancelRequested.error?.message ?? "").toContain("INVALID_TRANSITION");
    const outsiderCancel = await outsider.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: booking.version, cause: "attendee" });
    expect(outsiderCancel.error?.message ?? "").toContain("insufficient_privilege");
    const outsiderSessionCancel = await outsider.client.rpc("cancel_session", { sid: session.id, expected_version: session.version });
    expect(outsiderSessionCancel.error?.message ?? "").toContain("insufficient_privilege");
    expect((await bookingRow(booking.id)).status).toBe("requested");
  });

  it("CAS: stale versions and terminal re-cancellation are rejected; idempotency holds", async () => {
    const { tutor, learner, session, booking, payment } = await confirmedPaidBooking(280000);
    await setSessionTime(session.id, new Date(Date.now() + 25 * 3600e3), new Date(Date.now() + 26 * 3600e3));
    const version = await bookingVersion(booking.id);
    expect((await learner.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: version, cause: "attendee" })).error).toBeNull();
    const again = await learner.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: version, cause: "attendee" });
    expect(again.error?.message ?? "").toContain("STALE_VERSION");
    const terminal = await learner.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: await bookingVersion(booking.id), cause: "attendee" });
    expect(terminal.error?.message ?? "").toContain("INVALID_TRANSITION");
    expect(await obligations(booking.id)).toHaveLength(1);

    const s = await createSession(tutor, new Date(Date.now() + 3 * 3600e3), new Date(Date.now() + 4 * 3600e3));
    const b = await createBooking(learner, s.id);
    expect((await tutor.client.rpc("cancel_session", { sid: s.id, expected_version: s.version })).error).toBeNull();
    expect((await tutor.client.rpc("cancel_session", { sid: s.id, expected_version: s.version })).error?.message ?? "").toContain("STALE_VERSION");
    expect((await tutor.client.rpc("cancel_session", { sid: s.id, expected_version: await sessionVersion(s.id) })).error?.message ?? "").toContain("INVALID_TRANSITION");
    expect((await sql`select count(*)::int as n from public.event_outbox where aggregate_id=${b.id} and event_type='BOOKING_CANCELLED'`)[0].n).toBe(1);
  });

  it("reject_booking on a payment-pending requested booking records the in-flight marker", async () => {
    const tutor = await signup("tutor"), learner = await signup("student");
    await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Cancel Tutor',300000,'VND')`;
    const session = await createSession(tutor, new Date(Date.now() + 3 * 3600e3), new Date(Date.now() + 4 * 3600e3));
    const booking = await createBooking(learner, session.id);
    await tutor.client.rpc("approve_booking_for_payment", { p_booking_id: booking.id });
    await learner.client.rpc("start_payment_attempt", { p_booking_id: booking.id, p_idempotency_key: `rj-${randomUUID().replace(/-/g, "").slice(0, 24)}` });
    expect((await tutor.client.rpc("reject_booking", { booking_id: booking.id, expected_version: await bookingVersion(booking.id) })).error).toBeNull();
    const row = await bookingRow(booking.id);
    expect(row.status).toBe("rejected");
    expect(row.cancel_payment_in_flight_at).not.toBeNull();
  });

  it("finalize_paid_booking fails cleanly for an unknown booking", async () => {
    const r = await trusted.rpc("finalize_paid_booking", { p_booking_id: randomUUID() });
    expect(r.error?.message ?? "").toContain("BOOKING_FINALIZATION_FAILED");
  });

  it("refund kind vocabulary is closed; 'partial' is rejected by the constraint", async () => {
    await expect(sql`insert into public.refunds(payment_id,kind,status,amount_vnd,idempotency_key,reason) values(${randomUUID()},'partial','obligation',1,'partial-key','x')`).rejects.toThrow();
  });

  it("concurrency: simultaneous learner cancel and host session cancel settle to exactly one obligation", async () => {
    const { tutor, learner, session, booking } = await confirmedPaidBooking(310000);
    await setSessionTime(session.id, new Date(Date.now() + 25 * 3600e3), new Date(Date.now() + 26 * 3600e3));
    const v = await bookingVersion(booking.id);
    const learnerCancel = async () => {
      try {
        return await learner.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: v, cause: "attendee" });
      } catch (e) {
        return { error: { message: String(e) } };
      }
    };
    const hostCancel = async () => {
      try {
        return await tutor.client.rpc("cancel_session", { sid: session.id, expected_version: session.version });
      } catch (e) {
        return { error: { message: String(e) } };
      }
    };
    const [a, b] = await Promise.all([learnerCancel(), hostCancel()]);
    const ok = [a, b].filter((r) => !r.error);
    const err = [a, b].filter((r) => r.error);
    expect(ok).toHaveLength(1);
    expect(err).toHaveLength(1);
    const refunds = await obligations(booking.id);
    expect(refunds).toHaveLength(1);
    expect(refunds[0].kind).toBe("standard");
    const sessionStatus = (await sql`select status from public.sessions where id=${session.id}`)[0].status;
    const bookingStatus = (await bookingRow(booking.id)).status;
    expect(["cancelled", "confirmed"]).toContain(bookingStatus);
    expect(["cancelled", "scheduled"]).toContain(sessionStatus);
    if (bookingStatus === "cancelled" && sessionStatus === "scheduled") expect(refunds[0].idempotency_key).toBe(`cancel:attendee:${booking.id}`);
  });

  it("ordering: learner cancellation wins before host session cancellation", async () => {
    const { tutor, learner, session, booking } = await confirmedPaidBooking(311000);
    await setSessionTime(session.id, new Date(Date.now() + 25 * 3600e3), new Date(Date.now() + 26 * 3600e3));
    const learnerResult = await learner.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: await bookingVersion(booking.id), cause: "attendee" });
    expect(learnerResult.error).toBeNull();
    const hostResult = await tutor.client.rpc("cancel_session", { sid: session.id, expected_version: await sessionVersion(session.id) });
    expect(hostResult.error?.message ?? "").toContain("INVALID_TRANSITION");
    expect((await bookingRow(booking.id)).status).toBe("cancelled");
    expect((await sql`select status from public.sessions where id=${session.id}`)[0].status).toBe("scheduled");
    expect(await obligations(booking.id)).toHaveLength(1);
  });

  it("ordering: host session cancellation wins before learner cancellation", async () => {
    const { tutor, learner, session, booking } = await confirmedPaidBooking(312000);
    const hostResult = await tutor.client.rpc("cancel_session", { sid: session.id, expected_version: await sessionVersion(session.id) });
    expect(hostResult.error).toBeNull();
    const learnerResult = await learner.client.rpc("cancel_booking", { booking_id: booking.id, expected_version: await bookingVersion(booking.id), cause: "attendee" });
    expect(learnerResult.error?.message ?? "").toContain("INVALID_TRANSITION");
    expect((await bookingRow(booking.id)).status).toBe("cancelled");
    expect((await sql`select status from public.sessions where id=${session.id}`)[0].status).toBe("cancelled");
    expect(await obligations(booking.id)).toHaveLength(1);
  });

  it("concurrency: duplicate finalize settles to a single confirmation and zero obligations", async () => {
    const { booking } = await paidButUnfinalizedBooking(320000);
    const duplicateFinalize = async () => {
      try {
        return await trusted.rpc("finalize_paid_booking", { p_booking_id: booking.id });
      } catch (e) {
        return { data: { finalized: false }, error: { message: String(e) } };
      }
    };
    const [a, b] = await Promise.all([duplicateFinalize(), duplicateFinalize()]);
    expect([a.data.finalized, b.data.finalized].filter(Boolean)).toHaveLength(1);
    expect((await bookingRow(booking.id)).status).toBe("confirmed");
    expect(await obligations(booking.id)).toHaveLength(0);
  });
});

afterAll(() => sql.end());
