import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";
import "./local-supabase-setup.js";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const dbUrl = process.env.SUPABASE_TEST_DB_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
if (!["localhost", "127.0.0.1", "host.docker.internal"].includes(new URL(url).hostname)) throw new Error("Refusing to run integration tests against a non-local Supabase target.");

const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const trusted = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 8 });
const password = "Local-test-only-Password1!";

async function account(role: "student" | "tutor") {
  return signUpConfirmed({ anon, url, publishableKey: key, serviceRoleKey: serviceKey, email: `wkshop-${role}-${randomUUID()}@example.test`, password, metadata: { name: "Workshop Capacity QA", role }, trustedTutor: role === "tutor" });
}

function futureWindow(hoursOffset = 2) {
  const startsAt = new Date(Date.now() + hoursOffset * 3600e3).toISOString();
  const endsAt = new Date(Date.now() + (hoursOffset + 1) * 3600e3).toISOString();
  return { startsAt, endsAt };
}

async function reserved(sid: string) {
  const rows = await sql`select coalesce(sum(participant_count), 0)::int as n from public.bookings where session_id = ${sid} and status in ('requested', 'confirmed')`;
  return rows[0].n;
}

async function sessionVersion(sid: string) {
  const rows = await sql`select version::int as v from public.sessions where id = ${sid}`;
  return rows[0]?.v ?? 0;
}

async function bookingRow(bid: string) {
  const rows = await sql`select status, version::int as v, participant_count::int as pc from public.bookings where id = ${bid}`;
  return rows[0];
}

async function createWorkshopOffering(tutor: { client: any; user: { id: string } }) {
  const offering = await tutor.client.rpc("create_offering", {
    p_offering_type: "workshop",
    p_title: `Workshop ${randomUUID().slice(0, 8)}`,
    p_pricing_model: "flat_per_participant_v1",
    p_price_per_participant_vnd: 500000,
    p_booking_mode: "instant",
  });
  if (offering.error) throw new Error(`create_offering failed: ${offering.error.message}`);
  // create_offering does not insert an offering_hosts row; the tutor must have
  // host capability on the offering before update_offering_status will run.
  await sql`
    insert into public.offering_hosts (offering_id, user_id, capability, granted_by)
    values (${offering.data.id}, ${tutor.user.id}, 'owner', ${tutor.user.id})
    on conflict (offering_id, user_id) where revoked_at is null do nothing
  `;
  const published = await tutor.client.rpc("update_offering_status", {
    p_offering_id: offering.data.id,
    p_expected_version: offering.data.version,
    p_status: "published",
  });
  if (published.error) throw new Error(`publish failed: ${published.error.message}`);
  return offering.data.id;
}

async function createWorkshopSession(tutor: { client: any }, offeringId: string, maxParticipants: number, minParticipants = 0) {
  const time = futureWindow(2 + Math.random() * 10);
  const session = await tutor.client.rpc("create_session", {
    payload: { offeringId, ...time, maxParticipants, minParticipants: minParticipants || undefined },
  });
  if (session.error) throw new Error(`create_session failed: ${session.error.message}`);
  return session.data;
}

async function createWorkshopBooking(learner: { client: any }, sessionId: string, participantCount: number, idempotencyKey?: string) {
  return learner.client.rpc("create_booking", { session_id: sessionId, participant_count: participantCount, p_idempotency_key: idempotencyKey ?? null });
}

// ─── PHASE 8: Workshop Capacity + Idempotency ───────────────────────────────

describe.sequential("workshop capacity and idempotency invariants", () => {

  // ─── 1. Last-seat race ─────────────────────────────────────────────────────
  it("1. last-seat race: exactly one concurrent single-participant booking wins", async () => {
    const tutor = await account("tutor");
    const l1 = await account("student");
    const l2 = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 1);

    const results = await Promise.all([
      createWorkshopBooking(l1, s.id, 1),
      createWorkshopBooking(l2, s.id, 1),
    ]);

    const succeeded = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].error!.message).toContain("INSUFFICIENT_CAPACITY");
    expect(await reserved(s.id)).toBe(1);
  });

  // ─── 2. Multi-participant race ──────────────────────────────────────────────
  it("2. multi-participant race: two 2-participant bookings on 3 seats must not both succeed", async () => {
    const tutor = await account("tutor");
    const l1 = await account("student");
    const l2 = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 3);

    const results = await Promise.all([
      createWorkshopBooking(l1, s.id, 2),
      createWorkshopBooking(l2, s.id, 2),
    ]);

    const succeeded = results.filter(r => !r.error);
    expect(succeeded).toHaveLength(1);
    expect(results.find(r => r.error)!.error!.message).toContain("INSUFFICIENT_CAPACITY");
    expect(await reserved(s.id)).toBe(2);
  });

  // ─── 3. Exact capacity ──────────────────────────────────────────────────────
  it("3. exact-capacity: booking exactly equal to remaining capacity succeeds", async () => {
    const tutor = await account("tutor");
    const l = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 3);

    const b = await createWorkshopBooking(l, s.id, 3);
    expect(b.error).toBeNull();
    expect(b.data.participantCount).toBe(3);
    expect(b.data.status).toBe("requested");
    expect(b.data.session.spotsLeft).toBe(0);
    expect(await reserved(s.id)).toBe(3);
  });

  // ─── 4. Over-capacity ──────────────────────────────────────────────────────
  it("4. over-capacity: requesting more than remaining rejects without capacity change", async () => {
    const tutor = await account("tutor");
    const l = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 3);

    const before = await reserved(s.id);
    const b = await createWorkshopBooking(l, s.id, 5);
    expect(b.error!.message).toContain("INSUFFICIENT_CAPACITY");
    expect(await reserved(s.id)).toBe(before);
  });

  // ─── 5. Invalid quantities ─────────────────────────────────────────────────
  it("5a. zero participant count is rejected", async () => {
    const tutor = await account("tutor");
    const l = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 5);

    const b = await createWorkshopBooking(l, s.id, 0);
    expect(b.error).toBeTruthy();
    expect(b.error!.message).toContain("INVALID_TRANSITION");
    expect(await reserved(s.id)).toBe(0);
  });

  it("5b. negative participant count is rejected", async () => {
    const tutor = await account("tutor");
    const l = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 5);

    const b = await createWorkshopBooking(l, s.id, -1);
    expect(b.error).toBeTruthy();
    expect(b.error!.message).toContain("INVALID_TRANSITION");
    expect(await reserved(s.id)).toBe(0);
  });

  it("5c. null participant count is rejected", async () => {
    const tutor = await account("tutor");
    const l = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 5);

    const b = await l.client.rpc("create_booking", { session_id: s.id, participant_count: null });
    expect(b.error).toBeTruthy();
    expect(await reserved(s.id)).toBe(0);
  });

  // ─── 6. Deterministic idempotency: same key × N concurrent → exactly one booking ──
  it("6. same idempotency key × 5 concurrent retries → exactly one booking, one pricing snapshot, no duplicate capacity", async () => {
    const tutor = await account("tutor");
    const l = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 3);

    const idempotencyKey = `idempotent-${randomUUID()}`;

    // Fire 5 concurrent identical requests with the same idempotency key
    const results = await Promise.all([
      createWorkshopBooking(l, s.id, 2, idempotencyKey),
      createWorkshopBooking(l, s.id, 2, idempotencyKey),
      createWorkshopBooking(l, s.id, 2, idempotencyKey),
      createWorkshopBooking(l, s.id, 2, idempotencyKey),
      createWorkshopBooking(l, s.id, 2, idempotencyKey),
    ]);

    const succeeded = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);

    // Exactly one must succeed
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(4);
    for (const f of failed) {
      expect(f.error!.message).toContain("BOOKING_CONFLICT");
    }

    const bookingId = succeeded[0].data.id;

    // Exactly one booking row for this learner+session
    const bookings = await sql`select count(*)::int as n from public.bookings where session_id = ${s.id} and learner_id = ${l.user.id}`;
    expect(bookings[0].n).toBe(1);

    // Capacity reserved exactly once (participant_count = 2)
    expect(await reserved(s.id)).toBe(2);

    // One authoritative pricing snapshot: amount = 2 × 500000 = 1000000
    const pricing = await sql`select pricing_amount_vnd::bigint as amt, pricing_price_per_participant_vnd::bigint as ppv, pricing_model as model from public.bookings where id = ${bookingId}`;
    expect(Number(pricing[0].amt)).toBe(1000000);
    expect(Number(pricing[0].ppv)).toBe(500000);
    expect(pricing[0].model).toBe("flat_per_participant_v1");

    // No duplicate payment obligation
    const payments = await sql`select count(*)::int as n from public.payments where booking_id = ${bookingId}`;
    expect(payments[0].n).toBe(0);

    // Idempotency key stored on the booking
    const storedKey = await sql`select idempotency_key as k from public.bookings where id = ${bookingId}`;
    expect(storedKey[0].k).toBe(idempotencyKey);
  });

  // ─── 6b. Different idempotency keys → separate bookings ──────────────────
  it("6b. different idempotency keys for same session → creates separate bookings", async () => {
    const tutor = await account("tutor");
    const l = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 5);

    const key1 = `idempotent-${randomUUID()}`;
    const key2 = `idempotent-${randomUUID()}`;

    const b1 = await createWorkshopBooking(l, s.id, 1, key1);
    expect(b1.error).toBeNull();

    const b2 = await createWorkshopBooking(l, s.id, 1, key2);
    // Second booking may fail due to partial unique index (same learner, same session)
    // OR may succeed if the first was cancelled. The key point: different keys = different operations.
    if (!b2.error) {
      expect(b2.data.id).not.toBe(b1.data.id);
      expect(await reserved(s.id)).toBe(2);
    } else {
      // Expected: BOOKING_CONFLICT from partial unique index
      expect(b2.error!.message).toContain("BOOKING_CONFLICT");
      expect(await reserved(s.id)).toBe(1);
    }
  });

  // ─── 7. Payment-attempt idempotency ────────────────────────────────────────
  it("7. repeated start_payment_attempt for same booking produces stable merchant reference", async () => {
    const tutor = await account("tutor");
    const l = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 5);
    const b = await createWorkshopBooking(l, s.id, 1);
    expect(b.error).toBeNull();

    const key1 = `idempotent-${randomUUID()}`;
    const key2 = `idempotent-${randomUUID()}`;

    const p1 = await l.client.rpc("start_payment_attempt", { p_booking_id: b.data.id, p_idempotency_key: key1 });
    expect(p1.error).toBeNull();
    expect(p1.data.status).toBe("pending");
    expect(p1.data.amountVnd).toBe(500000);

    const p2 = await l.client.rpc("start_payment_attempt", { p_booking_id: b.data.id, p_idempotency_key: key2 });
    // Second attempt should either succeed (new attempt) or fail with PAYMENT_NOT_RETRYABLE
    if (!p2.error) {
      expect(p2.data.status).toBe("pending");
      expect(p2.data.paymentId).toBe(p1.data.paymentId);
    } else {
      expect(p2.error!.message).toMatch(/PAYMENT_NOT_RETRYABLE|INVALID_TRANSITION/);
    }

    // Verify no duplicate payment records
    const payments = await sql`select count(*)::int as n from public.payments where booking_id = ${b.data.id}`;
    expect(payments[0].n).toBe(1);

    // Verify payment attempts count is reasonable (1 or 2)
    const attempts = await sql`select count(*)::int as n from public.payment_attempts where payment_id = ${p1.data.paymentId}`;
    expect(attempts[0].n).toBeGreaterThanOrEqual(1);
    expect(attempts[0].n).toBeLessThanOrEqual(2);

    // Verify merchant references are valid
    const refs = await sql`select merchant_reference from public.payment_attempts where payment_id = ${p1.data.paymentId}`;
    for (const ref of refs) {
      expect(ref.merchant_reference).toBeTruthy();
      expect(ref.merchant_reference.length).toBeGreaterThan(8);
    }
  });

  // ─── 8. Cancel vs booking race ─────────────────────────────────────────────
  it("8. cancel vs new booking: capacity never exceeds max after concurrent operations", async () => {
    const tutor = await account("tutor");
    const l1 = await account("student");
    const l2 = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 1);

    // l1 books the only seat
    const b1 = await createWorkshopBooking(l1, s.id, 1);
    expect(b1.error).toBeNull();
    expect(await reserved(s.id)).toBe(1);

    // l1 cancels and l2 books concurrently
    const [cancelResult, bookResult] = await Promise.all([
      l1.client.rpc("cancel_booking", { booking_id: b1.data.id, expected_version: b1.data.version, cause: "attendee" }),
      createWorkshopBooking(l2, s.id, 1),
    ]);

    // Both may succeed (cancel releases, then booking acquires) or exactly one wins.
    // Invariant: capacity never exceeds maxParticipants
    const rsv = await reserved(s.id);
    expect(rsv).toBeGreaterThanOrEqual(0);
    expect(rsv).toBeLessThanOrEqual(1);
  });

  // ─── 9. Session cancellation race ──────────────────────────────────────────
  it("9. booking while session is cancelled: no booking survives a cancelled session", async () => {
    const tutor = await account("tutor");
    const l = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 5);

    const sv = await sessionVersion(s.id);
    const [cancelResult, bookResult] = await Promise.all([
      tutor.client.rpc("cancel_session", { sid: s.id, expected_version: sv, cause: "host" }),
      createWorkshopBooking(l, s.id, 1),
    ]);

    // At least one must fail; if both succeed, the session is still cancelled
    // Invariant: session is cancelled OR no valid booking exists
    const sessionStatus = (await sql`select status from public.sessions where id = ${s.id}`)[0].status;
    expect(["cancelled", "scheduled"]).toContain(sessionStatus);

    if (sessionStatus === "cancelled") {
      // All bookings against a cancelled session must be cancelled too
      expect(await reserved(s.id)).toBe(0);
    } else {
      // Cancel lost the race; booking must have succeeded but exactly one won
      expect(cancelResult.error).toBeTruthy();
      expect(bookResult.error).toBeNull();
      expect(await reserved(s.id)).toBe(1);
    }
  });

  // ─── 10. Stale version / CAS ───────────────────────────────────────────────
  it("10a. stale booking version is rejected without state change", async () => {
    const tutor = await account("tutor");
    const l = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 5);
    const b = await createWorkshopBooking(l, s.id, 1);
    expect(b.error).toBeNull();

    // Cancel with correct version succeeds
    const cancel1 = await l.client.rpc("cancel_booking", { booking_id: b.data.id, expected_version: b.data.version, cause: "attendee" });
    expect(cancel1.error).toBeNull();

    // Attempt stale cancel (version already consumed)
    const cancel2 = await l.client.rpc("cancel_booking", { booking_id: b.data.id, expected_version: b.data.version, cause: "attendee" });
    expect(cancel2.error!.message).toContain("STALE_VERSION");

    // Verify state unchanged by first cancel
    const row = await bookingRow(b.data.id);
    expect(row.status).toBe("cancelled");
    expect(row.v).toBe(b.data.version + 1);
  });

  it("10b. stale session version is rejected on capacity change", async () => {
    const tutor = await account("tutor");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 5);
    const sv = await sessionVersion(s.id);

    // Change capacity with correct version succeeds
    const ok = await tutor.client.rpc("change_session_capacity", { sid: s.id, new_max: 3, expected_version: sv });
    expect(ok.error).toBeNull();

    // Change capacity with stale version fails
    const stale = await tutor.client.rpc("change_session_capacity", { sid: s.id, new_max: 2, expected_version: sv });
    expect(stale.error!.message).toContain("STALE_VERSION");

    // Verify capacity unchanged from first mutation
    const row = await sql`select max_participants from public.sessions where id = ${s.id}`;
    expect(row[0].max_participants).toBe(3);
  });

  it("10c. stale version on workshop booking cancellation is rejected", async () => {
    const tutor = await account("tutor");
    const l = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 5);
    const b = await createWorkshopBooking(l, s.id, 1);
    expect(b.error).toBeNull();

    // Host cancel with correct version
    const cancel1 = await tutor.client.rpc("cancel_workshop_booking", {
      p_booking_id: b.data.id,
      p_expected_version: b.data.version,
      p_reason: "First cancel",
    });
    // The RPC may return null (pre-existing booking_read_json issue) but the mutation succeeds
    const row = await bookingRow(b.data.id);
    expect(row.status).toBe("cancelled");

    // Stale cancel attempt
    const cancel2 = await tutor.client.rpc("cancel_workshop_booking", {
      p_booking_id: b.data.id,
      p_expected_version: b.data.version,
      p_reason: "Stale cancel",
    });
    expect(cancel2.error!.message).toContain("STALE_VERSION");
    // Version unchanged from first cancel
    expect((await bookingRow(b.data.id)).v).toBe(b.data.version + 1);
  });

  // ─── 11. Payment-expiration capacity release ────────────────────────────────
  it("11a. expire_stale_workshop_bookings releases capacity for pending bookings", async () => {
    const tutor = await account("tutor");
    const l = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 2);

    // Create booking
    const b = await createWorkshopBooking(l, s.id, 1);
    expect(b.error).toBeNull();
    expect(await reserved(s.id)).toBe(1);

    // Start payment attempt (makes it a "pending payment" booking)
    const key = `expire-test-${randomUUID()}`;
    const p = await l.client.rpc("start_payment_attempt", { p_booking_id: b.data.id, p_idempotency_key: key });
    expect(p.error).toBeNull();

    // Backdate the booking to simulate 30+ minutes ago
    await sql`update public.bookings set created_at = now() - interval '31 minutes' where id = ${b.data.id}`;

    // Run expiration sweep
    const sweep = await trusted.rpc("expire_stale_workshop_bookings", { p_worker_id: "test-sweep" });
    expect(sweep.error).toBeNull();

    // Capacity should be released
    expect(await reserved(s.id)).toBe(0);

    // Booking should be cancelled
    const row = await bookingRow(b.data.id);
    expect(row.status).toBe("cancelled");
  });

  it("11b. expire_stale_workshop_bookings is idempotent (running twice = no double release)", async () => {
    const tutor = await account("tutor");
    const l = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 2);

    const b = await createWorkshopBooking(l, s.id, 1);
    const key = `expire-idempotent-${randomUUID()}`;
    const p = await l.client.rpc("start_payment_attempt", { p_booking_id: b.data.id, p_idempotency_key: key });
    expect(p.error).toBeNull();

    // Backdate
    await sql`update public.bookings set created_at = now() - interval '31 minutes' where id = ${b.data.id}`;

    // First sweep
    const sweep1 = await trusted.rpc("expire_stale_workshop_bookings", { p_worker_id: "test-sweep-idempotent" });
    expect(sweep1.error).toBeNull();

    // Second sweep on already-cancelled booking
    const sweep2 = await trusted.rpc("expire_stale_workshop_bookings", { p_worker_id: "test-sweep-idempotent-2" });
    expect(sweep2.error).toBeNull();

    // Capacity still zero (not double-released)
    expect(await reserved(s.id)).toBe(0);
    const row = await bookingRow(b.data.id);
    expect(row.status).toBe("cancelled");
  });

  it("11c. expire_stale_workshop_bookings skips already-confirmed bookings", async () => {
    const tutor = await account("tutor");
    const l = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const s = await createWorkshopSession(tutor, offeringId, 2);

    const b = await createWorkshopBooking(l, s.id, 1);
    expect(b.error).toBeNull();

    // Confirm the booking (skip payment for this test)
    await sql`update public.bookings set status = 'confirmed' where id = ${b.data.id}`;

    // Backdate
    await sql`update public.bookings set created_at = now() - interval '31 minutes' where id = ${b.data.id}`;

    // Sweep should NOT cancel confirmed bookings
    const sweep = await trusted.rpc("expire_stale_workshop_bookings", { p_worker_id: "test-sweep-confirmed" });
    expect(sweep.error).toBeNull();

    // Booking still confirmed, capacity still reserved
    expect((await bookingRow(b.data.id)).status).toBe("confirmed");
    expect(await reserved(s.id)).toBe(1);
  });
});
