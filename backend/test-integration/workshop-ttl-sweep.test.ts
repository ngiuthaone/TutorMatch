import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

const createdBookingIds = new Set<string>();
const createdSessionIds = new Set<string>();
const createdOfferingIds = new Set<string>();

async function account(role: "student" | "tutor") {
  return signUpConfirmed({ anon, url, publishableKey: key, serviceRoleKey: serviceKey, email: `ttl-sweep-${role}-${randomUUID()}@example.test`, password, metadata: { name: "TTL Sweep QA", role }, trustedTutor: role === "tutor" });
}

function futureWindow(hoursOffset = 2) {
  const startsAt = new Date(Date.now() + hoursOffset * 3600e3).toISOString();
  const endsAt = new Date(Date.now() + (hoursOffset + 1) * 3600e3).toISOString();
  return { startsAt, endsAt };
}

async function createWorkshopOffering(tutor: { client: any; user: { id: string } }) {
  const offering = await tutor.client.rpc("create_offering", {
    p_offering_type: "workshop",
    p_title: `Workshop TTL ${randomUUID().slice(0, 8)}`,
    p_pricing_model: "flat_per_participant_v1",
    p_price_per_participant_vnd: 500000,
    p_booking_mode: "instant",
  });
  if (offering.error) throw new Error(`create_offering failed: ${offering.error.message}`);
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
  createdOfferingIds.add(offering.data.id);
  return offering.data.id;
}

async function createWorkshopSession(tutor: { client: any }, offeringId: string, maxParticipants: number) {
  const time = futureWindow(2 + Math.random() * 10);
  const session = await tutor.client.rpc("create_session", {
    payload: { offeringId, ...time, maxParticipants },
  });
  if (session.error) throw new Error(`create_session failed: ${session.error.message}`);
  createdSessionIds.add(session.data.id);
  return session.data;
}

async function createWorkshopBooking(learner: { client: any }, sessionId: string, participantCount: number) {
  return learner.client.rpc("create_booking", { session_id: sessionId, participant_count: participantCount, p_idempotency_key: null });
}

async function bookingRow(bid: string) {
  const rows = await sql`select status, version::int as v, participant_count::int as pc, cancelled_by, cancelled_reason from public.bookings where id = ${bid}`;
  return rows[0];
}

async function sessionCapacity(sid: string) {
  const rows = await sql`select max_participants::int as max, (max_participants - coalesce((select sum(participant_count) from public.bookings where session_id = s.id and status in ('requested','confirmed')), 0))::int as spots from public.sessions s where id = ${sid}`;
  return rows[0];
}

async function reserved(sid: string) {
  const rows = await sql`select coalesce(sum(participant_count), 0)::int as n from public.bookings where session_id = ${sid} and status in ('requested', 'confirmed')`;
  return rows[0].n;
}

describe.sequential("workshop TTL sweep", () => {
  beforeAll(() => {
    if (!url || !key || !dbUrl || !serviceKey) throw new Error("Required env vars missing");
  });

  afterAll(async () => {
    for (const bid of createdBookingIds) {
      await sql`delete from public.booking_history where booking_id = ${bid}`;
      await sql`delete from public.payment_events where payment_id in (select id from public.payments where booking_id = ${bid})`;
      await sql`delete from public.payments where booking_id = ${bid}`;
      await sql`delete from public.bookings where id = ${bid}`;
    }
    for (const sid of createdSessionIds) {
      await sql`delete from public.sessions where id = ${sid}`;
    }
    for (const oid of createdOfferingIds) {
      await sql`delete from public.offering_hosts where offering_id = ${oid}`;
      await sql`delete from public.offerings where id = ${oid}`;
    }
    await sql.end({ timeout: 5 });
  });

  it("expire_stale_workshop_bookings cancels stale requested bookings with pending payment and releases capacity", async () => {
    const tutor = await account("tutor");
    const learner = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const session = await createWorkshopSession(tutor, offeringId, 2);

    const b = await createWorkshopBooking(learner, session.id, 1);
    expect(b.error).toBeNull();
    createdBookingIds.add(b.data.id);

    const key = `ttl-${randomUUID()}`;
    const p = await learner.client.rpc("start_payment_attempt", { p_booking_id: b.data.id, p_idempotency_key: key });
    expect(p.error).toBeNull();

    await sql`update public.bookings set created_at = now() - interval '31 minutes' where id = ${b.data.id}`;

    expect(await reserved(session.id)).toBe(1);

    const result = await trusted.rpc("expire_stale_workshop_bookings", { p_worker_id: "test-ttl-worker" });
    expect(result.error).toBeNull();
    expect(result.data.expired).toBe(1);

    const row = await bookingRow(b.data.id);
    expect(row.status).toBe("cancelled");
    expect(row.cancelled_by).toBe("system");
    expect(row.cancelled_reason).toBe("payment_ttl_expired");

    expect(await reserved(session.id)).toBe(0);

    const cap = await sessionCapacity(session.id);
    expect(cap.spots).toBe(cap.max);
  });

  it("expire_stale_workshop_bookings is idempotent: second call is a no-op", async () => {
    const tutor = await account("tutor");
    const learner = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const session = await createWorkshopSession(tutor, offeringId, 2);

    const b = await createWorkshopBooking(learner, session.id, 1);
    expect(b.error).toBeNull();
    createdBookingIds.add(b.data.id);

    const key = `ttl-idempotent-${randomUUID()}`;
    const p = await learner.client.rpc("start_payment_attempt", { p_booking_id: b.data.id, p_idempotency_key: key });
    expect(p.error).toBeNull();

    await sql`update public.bookings set created_at = now() - interval '31 minutes' where id = ${b.data.id}`;

    const first = await trusted.rpc("expire_stale_workshop_bookings", { p_worker_id: "test-ttl-idempotent-1" });
    expect(first.error).toBeNull();
    expect(first.data.expired).toBe(1);

    const second = await trusted.rpc("expire_stale_workshop_bookings", { p_worker_id: "test-ttl-idempotent-2" });
    expect(second.error).toBeNull();
    expect(second.data.expired).toBe(0);

    const row = await bookingRow(b.data.id);
    expect(row.status).toBe("cancelled");
    expect(await reserved(session.id)).toBe(0);
  });

  it("expire_stale_workshop_bookings skips bookings younger than 30 minutes", async () => {
    const tutor = await account("tutor");
    const learner = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const session = await createWorkshopSession(tutor, offeringId, 2);

    const b = await createWorkshopBooking(learner, session.id, 1);
    expect(b.error).toBeNull();
    createdBookingIds.add(b.data.id);

    const key = `ttl-fresh-${randomUUID()}`;
    const p = await learner.client.rpc("start_payment_attempt", { p_booking_id: b.data.id, p_idempotency_key: key });
    expect(p.error).toBeNull();

    const result = await trusted.rpc("expire_stale_workshop_bookings", { p_worker_id: "test-ttl-fresh" });
    expect(result.error).toBeNull();
    expect(result.data.expired).toBe(0);

    const row = await bookingRow(b.data.id);
    expect(row.status).toBe("requested");

    expect(await reserved(session.id)).toBe(1);
  });

  it("expire_stale_workshop_bookings skips confirmed bookings", async () => {
    const tutor = await account("tutor");
    const learner = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const session = await createWorkshopSession(tutor, offeringId, 2);

    const b = await createWorkshopBooking(learner, session.id, 1);
    expect(b.error).toBeNull();
    createdBookingIds.add(b.data.id);

    await sql`update public.bookings set status = 'confirmed' where id = ${b.data.id}`;
    await sql`update public.bookings set created_at = now() - interval '31 minutes' where id = ${b.data.id}`;

    const result = await trusted.rpc("expire_stale_workshop_bookings", { p_worker_id: "test-ttl-confirmed" });
    expect(result.error).toBeNull();
    expect(result.data.expired).toBe(0);

    const row = await bookingRow(b.data.id);
    expect(row.status).toBe("confirmed");
    expect(await reserved(session.id)).toBe(1);
  });

  it("expire_stale_workshop_bookings skips bookings without pending payment", async () => {
    const tutor = await account("tutor");
    const learner = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const session = await createWorkshopSession(tutor, offeringId, 2);

    const b = await createWorkshopBooking(learner, session.id, 1);
    expect(b.error).toBeNull();
    createdBookingIds.add(b.data.id);

    await sql`update public.bookings set created_at = now() - interval '31 minutes' where id = ${b.data.id}`;

    const result = await trusted.rpc("expire_stale_workshop_bookings", { p_worker_id: "test-ttl-no-payment" });
    expect(result.error).toBeNull();
    expect(result.data.expired).toBe(0);

    const row = await bookingRow(b.data.id);
    expect(row.status).toBe("requested");
    expect(await reserved(session.id)).toBe(1);
  });

  it("expire_stale_workshop_bookings releases capacity so a new learner can book", async () => {
    const tutor = await account("tutor");
    const learner1 = await account("student");
    const learner2 = await account("student");
    const offeringId = await createWorkshopOffering(tutor);
    const session = await createWorkshopSession(tutor, offeringId, 1);

    const b1 = await createWorkshopBooking(learner1, session.id, 1);
    expect(b1.error).toBeNull();
    createdBookingIds.add(b1.data.id);

    const key = `ttl-release-${randomUUID()}`;
    const p = await learner1.client.rpc("start_payment_attempt", { p_booking_id: b1.data.id, p_idempotency_key: key });
    expect(p.error).toBeNull();

    await sql`update public.bookings set created_at = now() - interval '31 minutes' where id = ${b1.data.id}`;

    await trusted.rpc("expire_stale_workshop_bookings", { p_worker_id: "test-ttl-release" });

    expect(await reserved(session.id)).toBe(0);

    const b2 = await createWorkshopBooking(learner2, session.id, 1);
    expect(b2.error).toBeNull();
    createdBookingIds.add(b2.data.id);

    expect(await reserved(session.id)).toBe(1);
  });
});
