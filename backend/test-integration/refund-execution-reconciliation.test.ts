import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";
import { createSupabasePaymentService } from "../src/services/payment-service.js";
import { makeOffering } from "./_fixtures/offering.js";

const url = process.env.SUPABASE_TEST_URL, key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY, dbUrl = process.env.SUPABASE_TEST_DB_URL, serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Refund execution/reconciliation integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Refusing non-local refund integration target.");
const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 4 });
const trusted = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const password = "Local-test-only-Password1!";

const vnpay = { tmnCode: "TUTORIA01", hashSecret: "local-secret", paymentUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html", returnUrl: "https://app.test/payments/return", ipnUrl: "https://api.test/payments/ipn" };

let providerResponse: Record<string, unknown> = { vnp_ResponseCode: "00", vnp_TransactionStatus: "00" };
let providerFailure: Error | null = null;
let providerHangs = false;
const mockFetch: typeof fetch = async (_url, init) => {
  if (providerHangs) return await new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("provider request aborted")), { once: true }));
  if (providerFailure) throw providerFailure;
  return new Response(JSON.stringify(providerResponse), { status: 200 });
};

async function signup(role: "student" | "tutor") {
  const email = `refund-${randomUUID()}@example.test`;
  return signUpConfirmed({ anon, url: url!, publishableKey: key!, serviceRoleKey: serviceKey!, email, password, metadata: { name: "Refund QA", role }, trustedTutor: role === "tutor" });
}

// Paid confirmed booking, then host cancels the whole session (P6) so a FULL
// 'standard' refund obligation exists, capacity is released, and the booking
// is cancelled.
async function paidSessionCancelled(rate = 300000) {
  const tutor = await signup("tutor"), learner = await signup("student");
  await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Refund Tutor',${rate},'VND')`;
  const offeringId = await makeOffering(tutor.client, tutor.user.id, "workshop", "hourly_v1", { hourlyRateVnd: rate });
  const session = await tutor.client.rpc("create_session", { payload: { offeringId, startsAt: new Date(Date.now() + 3 * 3600e3).toISOString(), endsAt: new Date(Date.now() + 4 * 3600e3).toISOString(), maxParticipants: 1 } });
  if (session.error) throw session.error;
  const booking = await learner.client.rpc("create_booking", { session_id: session.data.id, participant_count: 1 });
  if (booking.error) throw booking.error;
  await sql`update public.bookings b set pricing_amount_vnd = ${rate}, pricing_currency = 'VND', pricing_hourly_rate_vnd = ${rate}, pricing_duration_minutes = 60, pricing_model = 'hourly_v1', pricing_snapshotted_at = now() where b.id = ${booking.data.id} and b.pricing_amount_vnd is null`;
  const approved = await tutor.client.rpc("approve_booking_for_payment", { p_booking_id: booking.data.id });
  if (approved.error) throw approved.error;
  const attempt = await learner.client.rpc("start_payment_attempt", { p_booking_id: booking.data.id, p_idempotency_key: `rf-${randomUUID().replace(/-/g, "").slice(0, 24)}` });
  if (attempt.error) throw attempt.error;
  const observed = await trusted.rpc("record_vnpay_observation", { p_provider_event_key: `ev-${randomUUID().replace(/-/g, "").slice(0, 16)}`, p_merchant_reference: attempt.data.merchantReference, p_outcome: "succeeded", p_provider_transaction_no: `txn-${randomUUID()}`, p_amount_vnd: rate, p_payload: { fixture: true } });
  if (observed.error) throw observed.error;
  await trusted.rpc("finalize_paid_booking", { p_booking_id: booking.data.id });
  const cancel = await tutor.client.rpc("cancel_session", { sid: session.data.id, expected_version: session.data.version });
  if (cancel.error) throw cancel.error;
  const rows = await sql`select r.id as refund_id, p.id as payment_id, p.amount_vnd as payment_amount, b.id as booking_id, b.status as booking_status, s.id as session_id from public.refunds r join public.payments p on p.id = r.payment_id join public.bookings b on b.id = p.booking_id join public.sessions s on s.id = b.session_id where r.payment_id = p.id and b.session_id = ${session.data.id} order by r.created_at desc limit 1`;
  if (!rows.length) throw new Error("no refund obligation created by session cancellation");
  return { tutor, learner, session, booking, attempt, rate, refundId: rows[0].refund_id, paymentId: rows[0].payment_id, paymentAmount: Number(rows[0].payment_amount), bookingId: rows[0].booking_id, sessionId: rows[0].session_id, merchantReference: attempt.data.merchantReference as string };
}

async function forceExecutionClaimExpired(refundId: string) {
  await sql`update public.refunds set lease_until = now() - interval '1 second', available_at = null where id = ${refundId}`;
}

const makeService = () => createSupabasePaymentService(url, key, serviceKey, vnpay, "https://sandbox.test/transaction", mockFetch);

describe.sequential("Refund execution + reconciliation (Phase 3 DB semantics)", () => {
  beforeAll(async () => {
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
      "0011_refund_execution_reconciliation.sql",
      "0012_refund_recovery_worker.sql",
      "0013_serialize_cancellation_races.sql",
      "20260815090000_booking_request_abuse_protection.sql",
      "20260815090001_enforce_booking_request_security.sql",
    ];
    for (const n of MIGRATIONS) {
      const m = await readFile(fileURLToPath(new URL(`../supabase/migrations/${n}`, import.meta.url)), "utf8");
      await sql.unsafe(m);
    }
  });

  it("A/B: accepted request (00 + processing) -> pending, no credit; authoritative reconcile -> succeeded with credit", async () => {
    const ctx = await paidSessionCancelled();
    providerFailure = null; providerResponse = { vnp_ResponseCode: "00", vnp_TransactionStatus: "01" };
    const service = makeService();
    const claimed = await sql`select public.claim_pending_refund_executions('worker-exec', 50, 300) as result`;
    expect(claimed.some((row: any) => row.result.refundId === ctx.refundId)).toBe(true);
    const executed = await service.executeRefund(ctx.refundId);
    expect(executed.error).toBeNull();
    expect(executed.data.status).toBe("pending");
    const pending = await sql`select r.status, r.attempt_count, r.claimed_by, r.lease_until, p.refunded_amount_vnd from public.refunds r join public.payments p on p.id = r.payment_id where r.id = ${ctx.refundId}`;
    expect(pending[0].status).toBe("pending");
    expect(Number(pending[0].refunded_amount_vnd)).toBe(0);
    expect(pending[0].claimed_by).toBeNull();
    const pendingOutbox = await sql`select count(*)::int as c from public.event_outbox where event_type = 'REFUND_PENDING' and aggregate_id = ${ctx.paymentId}`;
    expect(pendingOutbox[0].c).toBe(1);
    providerResponse = { vnp_ResponseCode: "00", vnp_TransactionStatus: "00" };
    const reconciled = await service.reconcileRefund(ctx.refundId);
    expect(reconciled.error).toBeNull();
    const done = await sql`select r.status, p.refunded_amount_vnd, p.status as payment_status from public.refunds r join public.payments p on p.id = r.payment_id where r.id = ${ctx.refundId}`;
    expect(done[0].status).toBe("succeeded");
    expect(Number(done[0].refunded_amount_vnd)).toBe(ctx.paymentAmount);
    expect(done[0].payment_status).toBe("refunded");
    const succeededOutbox = await sql`select count(*)::int as c from public.event_outbox where event_type = 'REFUND_SUCCEEDED' and aggregate_id = ${ctx.paymentId}`;
    expect(succeededOutbox[0].c).toBe(1);
  });

  it("A: immediate authoritative settlement on execution -> succeeded + credit exactly once", async () => {
    const ctx = await paidSessionCancelled();
    providerResponse = { vnp_ResponseCode: "00", vnp_TransactionStatus: "00" };
    providerFailure = null;
    const executed = await makeService().executeRefund(ctx.refundId);
    expect(executed.error).toBeNull();
    const row = await sql`select r.status, p.refunded_amount_vnd from public.refunds r join public.payments p on p.id = r.payment_id where r.id = ${ctx.refundId}`;
    expect(row[0].status).toBe("succeeded");
    expect(Number(row[0].refunded_amount_vnd)).toBe(ctx.paymentAmount);
  });

  it("C/D: definitive provider failure -> failed, no credit, REFUND_FAILED", async () => {
    const ctx = await paidSessionCancelled();
    providerResponse = { vnp_ResponseCode: "00", vnp_TransactionStatus: "09" };
    providerFailure = null;
    const executed = await makeService().executeRefund(ctx.refundId);
    expect(executed.error).toBeNull();
    const row = await sql`select r.status, p.refunded_amount_vnd from public.refunds r join public.payments p on p.id = r.payment_id where r.id = ${ctx.refundId}`;
    expect(row[0].status).toBe("failed");
    expect(Number(row[0].refunded_amount_vnd)).toBe(0);
    expect((await sql`select count(*)::int as c from public.event_outbox where event_type = 'REFUND_FAILED' and aggregate_id = ${ctx.paymentId}`)[0].c).toBe(1);
  });

  it("E: transport unknown -> ambiguous, op ambiguous, never succeeded", async () => {
    const ctx = await paidSessionCancelled();
    providerFailure = new Error("network down");
    const executed = await makeService().executeRefund(ctx.refundId);
    expect(executed.error).toBeTruthy();
    const row = await sql`select r.status, o.status as op_status from public.refunds r join public.payment_provider_operations o on o.refund_id = r.id where r.id = ${ctx.refundId}`;
    expect(row[0].status).toBe("ambiguous");
    expect(row[0].op_status).toBe("ambiguous");
    expect((await sql`select count(*)::int as c from public.event_outbox where event_type = 'REFUND_AMBIGUOUS' and aggregate_id = ${ctx.paymentId}`)[0].c).toBe(1);
  });

  it("E: provider timeout -> ambiguous, op ambiguous, never succeeded", async () => {
    const ctx = await paidSessionCancelled();
    providerFailure = null;
    providerHangs = true;
    const service = createSupabasePaymentService(url, key, serviceKey, vnpay, "https://sandbox.test/transaction", mockFetch, { providerRequestTimeoutMs: 5 });
    const executed = await service.executeRefund(ctx.refundId);
    providerHangs = false;
    expect(executed.error).toBeTruthy();
    const row = await sql`select r.status, o.status as op_status from public.refunds r join public.payment_provider_operations o on o.refund_id = r.id where r.id = ${ctx.refundId}`;
    expect(row[0].status).toBe("ambiguous");
    expect(row[0].op_status).toBe("ambiguous");
    expect((await sql`select count(*)::int as c from public.event_outbox where event_type = 'REFUND_AMBIGUOUS' and aggregate_id = ${ctx.paymentId}`)[0].c).toBe(1);
  });

  it("J: duplicate authoritative result -> duplicate:true, no double credit", async () => {
    const ctx = await paidSessionCancelled();
    providerResponse = { vnp_ResponseCode: "00", vnp_TransactionStatus: "00" };
    providerFailure = null;
    const service = makeService();
    const first = await service.executeRefund(ctx.refundId);
    expect(first.data.status).toBe("succeeded");
    const op = await sql`select provider_request_id from public.payment_provider_operations where refund_id = ${ctx.refundId}`;
    const duplicate = await trusted.rpc("record_vnpay_refund_result", { p_refund_id: ctx.refundId, p_outcome: "succeeded", p_provider_request_id: op[0].provider_request_id, p_provider_transaction_no: "txn-dup", p_settlement_payload: { vnp_ResponseCode: "00", vnp_TransactionStatus: "00" } });
    expect(duplicate.error).toBeNull();
    expect(duplicate.data.duplicate).toBe(true);
    const row = await sql`select p.refunded_amount_vnd from public.payments p where p.id = ${ctx.paymentId}`;
    expect(Number(row[0].refunded_amount_vnd)).toBe(ctx.paymentAmount);
  });

  it("F/G: refund never exceeds remaining refundable; cumulative == amount -> payment refunded", async () => {
    const ctx = await paidSessionCancelled(200000);
    providerResponse = { vnp_ResponseCode: "00", vnp_TransactionStatus: "00" };
    providerFailure = null;
    await makeService().executeRefund(ctx.refundId);
    const secondRefund = await sql`insert into public.refunds(payment_id, kind, status, amount_vnd, idempotency_key, reason) values (${ctx.paymentId}, 'support', 'obligation', ${ctx.paymentAmount}, 'support:'||${ctx.paymentId}::text, 'test over-refund') returning id`;
    const overRefundOpId = `over-refund-op-${randomUUID()}`;
    await sql`insert into public.payment_provider_operations(operation_type, operation_key, payment_id, refund_id, merchant_reference, provider_request_id, status, request_payload, response_payload) values ('refund', ${`refund:${secondRefund[0].id}`}, ${ctx.paymentId}, ${secondRefund[0].id}, ${ctx.merchantReference}, ${overRefundOpId}, 'pending', '{}'::jsonb, '{}'::jsonb)`;
    const over = await trusted.rpc("record_vnpay_refund_result", { p_refund_id: secondRefund[0].id, p_outcome: "succeeded", p_provider_request_id: overRefundOpId, p_provider_transaction_no: "x", p_settlement_payload: { vnp_ResponseCode: "00", vnp_TransactionStatus: "00" } });
    expect(over.error?.message).toContain("REFUND_EXCEEDS_REMAINING");
    const row = await sql`select p.refunded_amount_vnd, p.status from public.payments p where p.id = ${ctx.paymentId}`;
    expect(Number(row[0].refunded_amount_vnd)).toBe(ctx.paymentAmount);
    expect(row[0].status).toBe("refunded");
  });

  it("K/L: settlement requires a real op and authoritative proof", async () => {
    const ctx = await paidSessionCancelled();
    providerResponse = { vnp_ResponseCode: "00", vnp_TransactionStatus: "01" };
    providerFailure = null;
    const service = makeService();
    await service.executeRefund(ctx.refundId);
    const op = await sql`select provider_request_id from public.payment_provider_operations where refund_id = ${ctx.refundId}`;
    const fabricated = await trusted.rpc("record_vnpay_refund_result", { p_refund_id: ctx.refundId, p_outcome: "succeeded", p_provider_request_id: "fabricated-op-id", p_settlement_payload: { vnp_ResponseCode: "00", vnp_TransactionStatus: "00" } });
    expect(fabricated.error?.message).toContain("UNKNOWN_OPERATION");
    const noProof = await trusted.rpc("record_vnpay_refund_result", { p_refund_id: ctx.refundId, p_outcome: "succeeded", p_provider_request_id: op[0].provider_request_id, p_settlement_payload: { vnp_ResponseCode: "00" } });
    expect(noProof.error?.message).toContain("INVALID_REFUND_RESULT");
  });

  it("R: two concurrent workers never claim the same refund in one lease window", async () => {
    const ctx = await paidSessionCancelled();
    const [a, b] = await Promise.all([
      sql`select public.claim_pending_refund_executions('worker-race-a', 50, 300) as result`,
      sql`select public.claim_pending_refund_executions('worker-race-b', 50, 300) as result`
    ]);
    const claimed = [...a, ...b].filter((row: any) => row.result.refundId === ctx.refundId);
    expect(claimed.length).toBe(1);
    const row = await sql`select claimed_by, attempt_count from public.refunds where id = ${ctx.refundId}`;
    expect(row[0].attempt_count).toBe(1);
  });

  it("S: lease expiry re-claims a crashed execution; op convergence moves it to pending, then reconcile succeeds", async () => {
    const ctx = await paidSessionCancelled();
    await sql`select public.claim_pending_refund_executions('worker-crash', 50, 300) as result`;
    const crashOpId = `refund-crash-${randomUUID()}`;
    await sql`insert into public.payment_provider_operations(operation_type, operation_key, payment_id, refund_id, merchant_reference, provider_request_id, status, request_payload, response_payload) values ('refund', ${`refund:${ctx.refundId}`}, ${ctx.paymentId}, ${ctx.refundId}, ${ctx.merchantReference}, ${crashOpId}, 'pending', '{}'::jsonb, '{}'::jsonb)`;
    await forceExecutionClaimExpired(ctx.refundId);
    const reclaimed = await sql`select public.claim_pending_refund_executions('worker-recovery', 50, 300) as result`;
    expect(reclaimed.some((row: any) => row.result.refundId === ctx.refundId)).toBe(true);
    providerResponse = { vnp_ResponseCode: "00", vnp_TransactionStatus: "01" };
    providerFailure = null;
    const service = makeService();
    const converged = await service.executeRefund(ctx.refundId);
    expect(converged.error).toBeNull();
    const pendingRow = await sql`select r.status, r.claimed_by from public.refunds r where r.id = ${ctx.refundId}`;
    expect(pendingRow[0].status).toBe("pending");
    expect(pendingRow[0].claimed_by).toBeNull();
    providerResponse = { vnp_ResponseCode: "00", vnp_TransactionStatus: "00" };
    const reconciled = await service.reconcileRefund(ctx.refundId);
    expect(reconciled.error).toBeNull();
    const row = await sql`select r.status, p.refunded_amount_vnd from public.refunds r join public.payments p on p.id = r.payment_id where r.id = ${ctx.refundId}`;
    expect(row[0].status).toBe("succeeded");
    expect(Number(row[0].refunded_amount_vnd)).toBe(ctx.paymentAmount);
  });

  it("S: bounded execution attempts -> durably failed, never silently dropped", async () => {
    const ctx = await paidSessionCancelled();
    for (let i = 0; i < 5; i += 1) {
      const claimed = await sql`select public.claim_pending_refund_executions('worker-exhaust-exec', 50, 300) as result`;
      expect(claimed.some((row: any) => row.result.refundId === ctx.refundId)).toBe(true);
      await forceExecutionClaimExpired(ctx.refundId);
    }
    await sql`select public.claim_pending_refund_executions('worker-exhaust-exec', 50, 300) as result`;
    const row = await sql`select status, last_error from public.refunds where id = ${ctx.refundId}`;
    expect(row[0].status).toBe("failed");
    expect(row[0].last_error).toBe("execution_retries_exhausted");
    expect((await sql`select count(*)::int as c from public.event_outbox where event_type = 'REFUND_FAILED' and aggregate_id = ${ctx.paymentId}`)[0].c).toBe(1);
  });

  it("S: bounded reconciliation attempts -> durably ambiguous, needs human review", async () => {
    const ctx = await paidSessionCancelled();
    providerResponse = { vnp_ResponseCode: "00", vnp_TransactionStatus: "01" };
    providerFailure = null;
    await makeService().executeRefund(ctx.refundId);
    for (let i = 0; i < 5; i += 1) {
      const claimed = await sql`select public.claim_pending_refund_reconciliations('worker-exhaust-rec', 50, 300) as result`;
      expect(claimed.some((row: any) => row.result.refundId === ctx.refundId)).toBe(true);
      await sql`update public.refunds set lease_until = now() - interval '1 second', available_at = null where id = ${ctx.refundId}`;
    }
    await sql`select public.claim_pending_refund_reconciliations('worker-exhaust-rec', 50, 300) as result`;
    const row = await sql`select status, last_error from public.refunds where id = ${ctx.refundId}`;
    expect(row[0].status).toBe("ambiguous");
    expect(row[0].last_error).toBe("reconciliation_retries_exhausted");
  });

  it("M/P: reconciliation retry reuses the persisted query operation identity", async () => {
    const ctx = await paidSessionCancelled();
    providerResponse = { vnp_ResponseCode: "00", vnp_TransactionStatus: "01" };
    providerFailure = null;
    await makeService().executeRefund(ctx.refundId);
    const first = await makeService().reconcileRefund(ctx.refundId);
    expect(first.error).toBeNull();
    const firstOp = await sql`select provider_request_id from public.payment_provider_operations where operation_key = ${`queryrefund:${ctx.refundId}`}`;
    expect(firstOp[0]?.provider_request_id).toBeTruthy();
    providerResponse = { vnp_ResponseCode: "00", vnp_TransactionStatus: "00" };
    const second = await makeService().reconcileRefund(ctx.refundId);
    expect(second.error).toBeNull();
    const row = await sql`select r.status, q.provider_request_id, q.status as query_status, p.refunded_amount_vnd from public.refunds r join public.payment_provider_operations q on q.operation_key = ${`queryrefund:${ctx.refundId}`} join public.payments p on p.id = r.payment_id where r.id = ${ctx.refundId}`;
    expect(row[0].status).toBe("succeeded");
    expect(row[0].query_status).toBe("succeeded");
    expect(row[0].provider_request_id).toBe(firstOp[0].provider_request_id);
    expect(Number(row[0].refunded_amount_vnd)).toBe(ctx.paymentAmount);
  });

  it("H: refund failure leaves the Booking cancelled and capacity released", async () => {
    const ctx = await paidSessionCancelled();
    providerResponse = { vnp_ResponseCode: "00", vnp_TransactionStatus: "09" };
    providerFailure = null;
    await makeService().executeRefund(ctx.refundId);
    const booking = await sql`select status, participant_count from public.bookings where id = ${ctx.bookingId}`;
    expect(booking[0].status).toBe("cancelled");
    const session = await sql`select status, max_participants, public.session_hard_reserved(id) as reserved from public.sessions where id = ${ctx.sessionId}`;
    expect(session[0].status).toBe("cancelled");
    expect(Number(session[0].reserved)).toBeLessThan(Number(session[0].max_participants));
  });

  it("T: PAYMENT_SUCCEEDED finalize retry sweep completes pending finalization", async () => {
    const tutor = await signup("tutor"), learner = await signup("student");
    await sql`insert into public.tutor_profiles(user_id,display_name,hourly_rate_vnd,currency) values(${tutor.user.id},'Retry Tutor',300000,'VND')`;
    const offeringId2 = await makeOffering(tutor.client, tutor.user.id, "workshop", "hourly_v1", { hourlyRateVnd: 300000 });
    const session = await tutor.client.rpc("create_session", { payload: { offeringId: offeringId2, startsAt: new Date(Date.now() + 3 * 3600e3).toISOString(), endsAt: new Date(Date.now() + 4 * 3600e3).toISOString(), maxParticipants: 1 } });
    const booking = await learner.client.rpc("create_booking", { session_id: session.data.id, participant_count: 1 });
    await sql`update public.bookings b set pricing_amount_vnd = 300000, pricing_currency = 'VND', pricing_hourly_rate_vnd = 300000, pricing_duration_minutes = 60, pricing_model = 'hourly_v1', pricing_snapshotted_at = now() where b.id = ${booking.data.id} and b.pricing_amount_vnd is null`;
    await tutor.client.rpc("approve_booking_for_payment", { p_booking_id: booking.data.id });
    const attempt = await learner.client.rpc("start_payment_attempt", { p_booking_id: booking.data.id, p_idempotency_key: `fr-${randomUUID().replace(/-/g, "").slice(0, 24)}` });
    await trusted.rpc("record_vnpay_observation", { p_provider_event_key: `ev-${randomUUID().replace(/-/g, "").slice(0, 16)}`, p_merchant_reference: attempt.data.merchantReference, p_outcome: "succeeded", p_provider_transaction_no: `txn-${randomUUID()}`, p_amount_vnd: 300000, p_payload: { fixture: true } });
    const sweep = await makeService().sweepPendingFinalizations("worker-finalize");
    expect(sweep.error).toBeNull();
    expect(sweep.data.finalized).toBeGreaterThanOrEqual(1);
    const bookingRow = await sql`select status from public.bookings where id = ${booking.data.id}`;
    expect(bookingRow[0].status).toBe("confirmed");
  });

  it("security: authenticated browser users cannot record or claim refund results", async () => {
    const learner = await signup("student");
    const record = await learner.client.rpc("record_vnpay_refund_result", { p_refund_id: randomUUID(), p_outcome: "succeeded", p_provider_request_id: "x", p_provider_transaction_no: null, p_settlement_payload: {} });
    expect(record.error).toBeTruthy();
    expect(record.error?.code).toBe("42501");
    const claim = await learner.client.rpc("claim_pending_refund_executions", { p_worker_id: "attacker", p_max_count: 50, p_lease_seconds: 300 });
    expect(claim.error).toBeTruthy();
    expect(claim.error?.code).toBe("42501");
    const finalize = await learner.client.rpc("claim_pending_payment_finalizations", { p_worker_id: "attacker", p_max_count: 50, p_lease_seconds: 300 });
    expect(finalize.error).toBeTruthy();
    expect(finalize.error?.code).toBe("42501");
  });
});
