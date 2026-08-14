import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_TEST_URL,
  key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY,
  dbUrl = process.env.SUPABASE_TEST_DB_URL;
if (!url || !key || !dbUrl)
  throw new Error("Integration tests require SUPABASE_TEST_URL, SUPABASE_TEST_PUBLISHABLE_KEY, and SUPABASE_TEST_DB_URL.");
if (!["localhost", "127.0.0.1", "host.docker.internal"].includes(new URL(url).hostname))
  throw new Error("Refusing to run integration tests against a non-local Supabase target.");

const anon = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const sql = postgres(dbUrl, { max: 4 });
const password = "Local-test-only-Password1!";

async function signup(role: "student" | "tutor") {
  const email = `sb-${randomUUID()}@example.test`;
  const { data, error } = await anon.auth.signUp({
    email,
    password,
    options: { data: { name: "Outbox Tester", role } },
  });
  if (error || !data.session || !data.user)
    throw new Error(`Local signup failed: ${error?.message || "email confirmation may be enabled"}`);
  return {
    user: data.user,
    client: createClient(url!, key!, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      auth: { persistSession: false },
    }),
  };
}

const FUTURE = {
  startsAt: new Date(Date.now() + 2 * 3600e3).toISOString(),
  endsAt: new Date(Date.now() + 3 * 3600e3).toISOString(),
};
const PAST = {
  startsAt: new Date(Date.now() - 3 * 3600e3).toISOString(),
  endsAt: new Date(Date.now() - 2 * 3600e3).toISOString(),
};

async function createSession(tutor: any, o: any = {}) {
  return tutor.client.rpc("create_session", { payload: { ...FUTURE, ...o } });
}
async function outbox(type?: string) {
  const rows = await sql`select * from public.event_outbox order by occurred_at, id`;
  return type ? rows.filter((x: any) => x.event_type === type) : rows;
}
async function resetOutbox() {
  await sql`delete from public.event_outbox`;
}

describe.sequential("transactional outbox: committed domain facts, atomicity, access, ordering, delivery", () => {
  beforeAll(async () => {
    for (const n of [
      "0001_create_profiles.sql",
      "0004_create_sessions_and_bookings.sql",
      "0005_create_booking_session_rpcs.sql",
      "0006_create_event_outbox.sql",
      "0007_emit_domain_events_from_booking_session_rpcs.sql",
    ]) {
      const m = await readFile(fileURLToPath(new URL(`../supabase/migrations/${n}`, import.meta.url)), "utf8");
      await sql.unsafe(m);
    }
  });

  // Event vocabulary.

  it("accepts only the established event vocabulary; reserved payment names are schema-reserved but never emitted", async () => {
    const ok = await sql`select public.insert_outbox_event('PAYMENT_SUCCEEDED','booking',gen_random_uuid(),1,'{}'::jsonb) as id`;
    expect(ok[0].id).toBeTruthy();
    await expect(
      sql`select public.insert_outbox_event('BOGUS_EVENT','booking',gen_random_uuid(),1,'{}'::jsonb)`,
    ).rejects.toThrow();
    await expect(
      sql`select public.insert_outbox_event('BOOKING_REQUESTED','widget',gen_random_uuid(),1,'{}'::jsonb)`,
    ).rejects.toThrow();
    await resetOutbox();
  });

  // Session mutations: emission only where a domain event exists.

  it("create_session / change_session_capacity / complete_session emit nothing", async () => {
    const tutor = await signup("tutor");
    const s = await createSession(tutor, { maxParticipants: 2 });
    expect(s.error).toBeNull();
    await tutor.client.rpc("change_session_capacity", { sid: s.data.id, new_max: 3, expected_version: s.data.version });
    const past = await createSession(tutor, { ...PAST, maxParticipants: 2 });
    await tutor.client.rpc("complete_session", { sid: past.data.id, expected_version: past.data.version });
    expect((await outbox()).length).toBe(0);
  });

  it("reschedule_session emits SESSION_RESCHEDULED with old/new bounds and bumped aggregate_version", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const newStart = new Date(Date.now() + 4 * 3600e3).toISOString();
    const newEnd = new Date(Date.now() + 5 * 3600e3).toISOString();
    const r = await tutor.client.rpc("reschedule_session", {
      sid: s.data.id,
      starts_at: newStart,
      ends_at: newEnd,
      expected_version: s.data.version,
    });
    expect(r.error).toBeNull();
    const rows = await outbox();
    expect(rows.length).toBe(1);
    expect(rows[0].event_type).toBe("SESSION_RESCHEDULED");
    expect(rows[0].aggregate_id).toBe(s.data.id);
    expect(Number(rows[0].aggregate_version)).toBe(s.data.version + 1);
    expect(rows[0].payload.sessionId).toBe(s.data.id);
    expect(new Date(rows[0].payload.oldStart).getTime()).toBeTruthy();
    expect(new Date(rows[0].payload.newStart).getTime()).toBe(new Date(newStart).getTime());
    expect(new Date(rows[0].payload.newEnd).getTime()).toBe(new Date(newEnd).getTime());
  });

  it("cancel_session emits SESSION_CANCELLED plus one BOOKING_CANCELLED per active booking", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l1 = await signup("student");
    const l2 = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 3 });
    const b1 = await l1.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    const b2 = await l2.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    await tutor.client.rpc("confirm_booking", { booking_id: b1.data.id, expected_version: b1.data.version });
    const r = await tutor.client.rpc("cancel_session", { sid: s.data.id, expected_version: s.data.version });
    expect(r.error).toBeNull();
    const rows = await sql`
      select * from public.event_outbox
      where event_type in ('SESSION_CANCELLED', 'BOOKING_CANCELLED')
      order by occurred_at, id`;
    expect(rows.length).toBe(3);
    const types = rows.map((x: any) => x.event_type).sort();
    expect(types).toEqual(["BOOKING_CANCELLED", "BOOKING_CANCELLED", "SESSION_CANCELLED"]);
    for (const row of rows) {
      if (row.event_type === "SESSION_CANCELLED") {
        expect(row.aggregate_id).toBe(s.data.id);
        expect(row.payload.cause).toBe("host");
        expect(row.payload.sessionId).toBe(s.data.id);
      } else {
        expect(["requested", "confirmed"]).toContain(row.payload.fromStatus);
        expect(row.payload.cancelledBy).toBe("host");
        expect(row.payload.cancelledBySessionId).toBe(s.data.id);
      }
    }
    const bookingEvents = rows.filter((x: any) => x.event_type === "BOOKING_CANCELLED");
    const ids = bookingEvents.map((x: any) => x.aggregate_id).sort();
    expect(ids).toEqual([b1.data.id, b2.data.id].sort());
  });

  // Booking mutations.

  it("create_booking emits BOOKING_REQUESTED with aggregate_version 1", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    expect(b.error).toBeNull();
    const rows = await outbox();
    expect(rows.length).toBe(1);
    expect(rows[0].event_type).toBe("BOOKING_REQUESTED");
    expect(rows[0].aggregate_id).toBe(b.data.id);
    expect(Number(rows[0].aggregate_version)).toBe(1);
    expect(rows[0].payload.sessionId).toBe(s.data.id);
    expect(rows[0].payload.participantCount).toBe(1);
  });

  it("confirm_booking emits BOOKING_CONFIRMED with bumped version and fromStatus requested", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    const r = await tutor.client.rpc("confirm_booking", { booking_id: b.data.id, expected_version: b.data.version });
    expect(r.error).toBeNull();
    const rows = await outbox("BOOKING_CONFIRMED");
    expect(rows.length).toBe(1);
    expect(rows[0].event_type).toBe("BOOKING_CONFIRMED");
    expect(Number(rows[0].aggregate_version)).toBe(b.data.version + 1);
    expect(rows[0].payload.bookingId).toBe(b.data.id);
    expect(rows[0].payload.sessionId).toBe(s.data.id);
    expect(rows[0].payload.fromStatus).toBe("requested");
  });

  it("reject_booking emits BOOKING_REJECTED", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    const r = await tutor.client.rpc("reject_booking", { booking_id: b.data.id, expected_version: b.data.version });
    expect(r.error).toBeNull();
    const rows = await outbox("BOOKING_REJECTED");
    expect(rows.length).toBe(1);
    expect(rows[0].event_type).toBe("BOOKING_REJECTED");
    expect(rows[0].payload.fromStatus).toBe("requested");
  });

  it("cancel_booking by attendee emits BOOKING_CANCELLED with cancelledBy attendee", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    const r = await l.client.rpc("cancel_booking", { booking_id: b.data.id, expected_version: b.data.version, cause: "attendee" });
    expect(r.error).toBeNull();
    const rows = await outbox("BOOKING_CANCELLED");
    expect(rows.length).toBe(1);
    expect(rows[0].event_type).toBe("BOOKING_CANCELLED");
    expect(rows[0].payload.cancelledBy).toBe("attendee");
    expect(rows[0].payload.fromStatus).toBe("requested");
  });

  it("cancel_booking by host on a confirmed booking emits BOOKING_CANCELLED with cancelledBy host", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    await tutor.client.rpc("confirm_booking", { booking_id: b.data.id, expected_version: b.data.version });
    const r = await tutor.client.rpc("cancel_booking", { booking_id: b.data.id, expected_version: b.data.version + 1, cause: "host" });
    expect(r.error).toBeNull();
    const rows = await outbox("BOOKING_CANCELLED");
    expect(rows.length).toBe(1);
    expect(rows[0].event_type).toBe("BOOKING_CANCELLED");
    expect(rows[0].payload.cancelledBy).toBe("host");
    expect(rows[0].payload.fromStatus).toBe("confirmed");
  });

  it("complete_booking emits BOOKING_COMPLETED after session end", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { ...PAST, maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    await tutor.client.rpc("confirm_booking", { booking_id: b.data.id, expected_version: b.data.version });
    const r = await l.client.rpc("complete_booking", { booking_id: b.data.id, expected_version: b.data.version + 1 });
    expect(r.error).toBeNull();
    const rows = await outbox("BOOKING_COMPLETED");
    expect(rows.length).toBe(1);
    expect(rows[0].event_type).toBe("BOOKING_COMPLETED");
    expect(rows[0].payload.fromStatus).toBe("confirmed");
  });

  it("record_attendance attended emits ATTENDANCE_REPORTED and completes the booking", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { ...PAST, maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    await tutor.client.rpc("confirm_booking", { booking_id: b.data.id, expected_version: b.data.version });
    const r = await tutor.client.rpc("record_attendance", {
      booking_id: b.data.id,
      outcome: "attended",
      expected_version: b.data.version + 1,
    });
    expect(r.error).toBeNull();
    const rows = await outbox("ATTENDANCE_REPORTED");
    expect(rows.length).toBe(1);
    expect(rows[0].event_type).toBe("ATTENDANCE_REPORTED");
    expect(rows[0].payload.outcome).toBe("attended");
    expect(rows[0].payload.reportedBy).toBe("host");
    expect(rows[0].payload.priorStatus).toBe("confirmed");
    expect(Number(rows[0].aggregate_version)).toBe(b.data.version + 2);
  });

  it("record_attendance learner_no_show emits ATTENDANCE_REPORTED and cancels the booking", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { ...PAST, maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    await tutor.client.rpc("confirm_booking", { booking_id: b.data.id, expected_version: b.data.version });
    const r = await tutor.client.rpc("record_attendance", {
      booking_id: b.data.id,
      outcome: "learner_no_show",
      expected_version: b.data.version + 1,
    });
    expect(r.error).toBeNull();
    const rows = await outbox("ATTENDANCE_REPORTED");
    expect(rows.length).toBe(1);
    expect(rows[0].event_type).toBe("ATTENDANCE_REPORTED");
    expect(rows[0].payload.outcome).toBe("learner_no_show");
  });

  // Reschedule lifecycle.

  it("create_reschedule_request emits RESCHEDULE_REQUESTED without bumping the booking version", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s1 = await createSession(tutor, { maxParticipants: 2 });
    const s2 = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s1.data.id, participant_count: 1 });
    const r = await l.client.rpc("create_reschedule_request", {
      booking_id: b.data.id,
      target_session_id: s2.data.id,
      expected_version: b.data.version,
    });
    expect(r.error).toBeNull();
    const rows = await outbox("RESCHEDULE_REQUESTED");
    expect(rows.length).toBe(1);
    expect(rows[0].event_type).toBe("RESCHEDULE_REQUESTED");
    expect(rows[0].aggregate_id).toBe(b.data.id);
    expect(Number(rows[0].aggregate_version)).toBe(b.data.version);
    expect(rows[0].payload.requestId).toBe(r.data.id);
    expect(rows[0].payload.fromSessionId).toBe(s1.data.id);
    expect(rows[0].payload.toSessionId).toBe(s2.data.id);
    expect(rows[0].payload.requestedBy).toBe("attendee");
  });

  it("accept_reschedule_request emits BOOKING_RESCHEDULED with the new session and bumped version", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s1 = await createSession(tutor, { maxParticipants: 2 });
    const s2 = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s1.data.id, participant_count: 1 });
    const req = await l.client.rpc("create_reschedule_request", {
      booking_id: b.data.id,
      target_session_id: s2.data.id,
      expected_version: b.data.version,
    });
    await resetOutbox();
    const r = await tutor.client.rpc("accept_reschedule_request", { request_id: req.data.id });
    expect(r.error).toBeNull();
    const rows = await outbox();
    expect(rows.length).toBe(1);
    expect(rows[0].event_type).toBe("BOOKING_RESCHEDULED");
    expect(Number(rows[0].aggregate_version)).toBe(b.data.version + 1);
    expect(rows[0].payload.sessionId).toBe(s2.data.id);
    expect(rows[0].payload.fromSessionId).toBe(s1.data.id);
    expect(rows[0].payload.toSessionId).toBe(s2.data.id);
    expect(rows[0].payload.requestId).toBe(req.data.id);
  });

  it("reject_reschedule_request emits RESCHEDULE_REJECTED", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s1 = await createSession(tutor, { maxParticipants: 2 });
    const s2 = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s1.data.id, participant_count: 1 });
    const req = await l.client.rpc("create_reschedule_request", {
      booking_id: b.data.id,
      target_session_id: s2.data.id,
      expected_version: b.data.version,
    });
    await resetOutbox();
    const r = await tutor.client.rpc("reject_reschedule_request", { request_id: req.data.id });
    expect(r.error).toBeNull();
    const rows = await outbox();
    expect(rows.length).toBe(1);
    expect(rows[0].event_type).toBe("RESCHEDULE_REJECTED");
    expect(rows[0].payload.actor).toBe("host");
  });

  it("cancel_reschedule_request emits RESCHEDULE_CANCELLED", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s1 = await createSession(tutor, { maxParticipants: 2 });
    const s2 = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s1.data.id, participant_count: 1 });
    const req = await l.client.rpc("create_reschedule_request", {
      booking_id: b.data.id,
      target_session_id: s2.data.id,
      expected_version: b.data.version,
    });
    await resetOutbox();
    const r = await l.client.rpc("cancel_reschedule_request", { request_id: req.data.id });
    expect(r.error).toBeNull();
    const rows = await outbox();
    expect(rows.length).toBe(1);
    expect(rows[0].event_type).toBe("RESCHEDULE_CANCELLED");
    expect(rows[0].payload.actor).toBe("attendee");
  });

  // Atomicity: a failed mutation must never leave an event.

  it("stale CAS retry emits no event and changes no state", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    const stale = await tutor.client.rpc("confirm_booking", { booking_id: b.data.id, expected_version: b.data.version + 1 });
    expect(stale.error?.message).toContain("STALE_VERSION");
    expect((await outbox("BOOKING_CONFIRMED")).length).toBe(0);
    expect((await sql`select status from public.bookings where id = ${b.data.id}`)[0].status).toBe("requested");
  });

  it("insufficient capacity emits no event", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l1 = await signup("student");
    const l2 = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 1 });
    const b1 = await l1.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    expect(b1.error).toBeNull();
    const b2 = await l2.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    expect(b2.error?.message).toContain("INSUFFICIENT_CAPACITY");
    expect((await outbox()).length).toBe(1);
  });

  it("invalid transition emits no event (double confirm, host-cancel of requested)", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l1 = await signup("student");
    const l2 = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 3 });
    const b1 = await l1.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    await tutor.client.rpc("confirm_booking", { booking_id: b1.data.id, expected_version: b1.data.version });
    const again = await tutor.client.rpc("confirm_booking", { booking_id: b1.data.id, expected_version: b1.data.version + 1 });
    expect(again.error?.message).toContain("INVALID_TRANSITION");
    const b2 = await l2.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    const hostCancel = await tutor.client.rpc("cancel_booking", {
      booking_id: b2.data.id,
      expected_version: b2.data.version,
      cause: "host",
    });
    expect(hostCancel.error?.message).toContain("INVALID_TRANSITION");
    expect((await outbox("BOOKING_CONFIRMED")).length).toBe(1);
    expect((await outbox("BOOKING_CANCELLED")).length).toBe(0);
  });

  it("unauthorized caller emits no event and changes no state", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const stranger = await signup("student");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    const rogue = await stranger.client.rpc("cancel_session", { sid: s.data.id, expected_version: s.data.version });
    expect(rogue.error).toBeTruthy();
    expect((await sql`select status from public.sessions where id = ${s.data.id}`)[0].status).toBe("scheduled");
    const rogueComplete = await stranger.client.rpc("complete_booking", { booking_id: b.data.id, expected_version: b.data.version });
    expect(rogueComplete.error).toBeTruthy();
    expect((await outbox()).length).toBe(1);
  });

  // Access control.

  it("denies direct outbox access to anon and authenticated", async () => {
    const l = await signup("student");
    expect((await anon.from("event_outbox").select()).error).toBeTruthy();
    expect((await l.client.from("event_outbox").select()).error).toBeTruthy();
    expect((await anon.from("event_outbox").insert({ event_type: "BOOKING_REQUESTED" })).error).toBeTruthy();
    expect((await l.client.from("event_outbox").insert({ event_type: "BOOKING_REQUESTED" })).error).toBeTruthy();
  });

  it("denies client roles the emission helper and worker primitives", async () => {
    const l = await signup("student");
    expect((await l.client.rpc("insert_outbox_event", {
      p_event_type: "BOOKING_REQUESTED",
      p_aggregate_type: "booking",
      p_aggregate_id: randomUUID(),
      p_aggregate_version: 1,
      p_payload: {},
    })).error).toBeTruthy();
    expect((await l.client.rpc("claim_pending_events", { p_worker_id: "w", p_max_count: 1, p_lease_seconds: 60 })).error).toBeTruthy();
    expect((await l.client.rpc("complete_event", { p_worker_id: "w", p_event_id: randomUUID() })).error).toBeTruthy();
    expect((await l.client.rpc("fail_event", { p_worker_id: "w", p_event_id: randomUUID() })).error).toBeTruthy();
  });

  // Per-aggregate ordering.

  it("orders events per aggregate by aggregate_version", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    await tutor.client.rpc("confirm_booking", { booking_id: b.data.id, expected_version: b.data.version });
    await l.client.rpc("cancel_booking", { booking_id: b.data.id, expected_version: b.data.version + 1, cause: "attendee" });
    const rows = await sql`
      select event_type, aggregate_version from public.event_outbox
      where aggregate_id = ${b.data.id}
      order by aggregate_version, occurred_at, id`;
    expect(rows.length).toBe(3);
    expect(rows.map((x: any) => x.event_type)).toEqual(["BOOKING_REQUESTED", "BOOKING_CONFIRMED", "BOOKING_CANCELLED"]);
    expect(rows.map((x: any) => Number(x.aggregate_version))).toEqual([1, 2, 3]);
  });

  // Delivery lifecycle primitives.

  it("claim_pending_events marks rows processing, stamps the claim, increments attempts, and returns them in order", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l1 = await signup("student");
    const l2 = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 3 });
    const b1 = await l1.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    const b2 = await l2.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    await tutor.client.rpc("confirm_booking", { booking_id: b1.data.id, expected_version: b1.data.version });
    const claimed = await sql`select public.claim_pending_events('worker-1', 100, 300) as ev`;
    expect(claimed.length).toBe(3);
    expect(claimed.map((x: any) => x.ev.attemptCount)).toEqual([1, 1, 1]);
    const db = await sql`select event_type, status, claimed_by, attempt_count, lease_until from public.event_outbox order by occurred_at, id`;
    for (const row of db) {
      expect(row.status).toBe("processing");
      expect(row.claimed_by).toBe("worker-1");
      expect(Number(row.attempt_count)).toBe(1);
      expect(row.lease_until).toBeTruthy();
    }
    const again = await sql`select public.claim_pending_events('worker-2', 100, 300) as ev`;
    expect(again.length).toBe(0);
  });

  it("complete_event terminalizes a claimed event as processed", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    const claimed = await sql`select public.claim_pending_events('worker-1', 10, 300) as ev`;
    expect(claimed.length).toBe(1);
    const done = await sql`select public.complete_event('worker-1', ${claimed[0].ev.id}) as out`;
    expect(done[0].out.status).toBe("processed");
    expect(done[0].out.processedAt).toBeTruthy();
    const db = await sql`select status, claimed_by, lease_until from public.event_outbox where id = ${claimed[0].ev.id}`;
    expect(db[0].status).toBe("processed");
    expect(db[0].claimed_by).toBeNull();
    expect(db[0].lease_until).toBeNull();
  });

  it("fail_event returns a claimed event to pending with backoff and keeps attempt count", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    const claimed = await sql`select public.claim_pending_events('worker-1', 10, 300) as ev`;
    expect(claimed.length).toBe(1);
    const failed = await sql`select public.fail_event('worker-1', ${claimed[0].ev.id}, 'boom', 60) as out`;
    expect(failed[0].out.status).toBe("pending");
    expect(failed[0].out.attemptCount).toBe(1);
    const db = await sql`select status, last_error, available_at from public.event_outbox where id = ${claimed[0].ev.id}`;
    expect(db[0].status).toBe("pending");
    expect(db[0].last_error).toBe("boom");
    expect(db[0].available_at.getTime()).toBeGreaterThan(Date.now());
    const now2 = await sql`select public.claim_pending_events('worker-1', 10, 300) as ev`;
    expect(now2.length).toBe(0);
  });

  it("an expired lease makes a processing row claimable again (at-least-once recovery)", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    await sql`select public.claim_pending_events('worker-1', 10, 300) as ev`;
    await sql`update public.event_outbox set lease_until = now() - interval '1 second'`;
    const re = await sql`select public.claim_pending_events('worker-2', 10, 300) as ev`;
    expect(re.length).toBe(1);
    expect(re[0].ev.attemptCount).toBe(2);
    expect(re[0].ev.eventType).toBe("BOOKING_REQUESTED");
  });

  it("complete_event by a non-claiming worker is rejected", async () => {
    await resetOutbox();
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    await sql`select public.claim_pending_events('worker-1', 10, 300) as ev`;
    await expect(sql`select public.complete_event('worker-other', ${b.data.id})`).rejects.toThrow();
  });

  it("rejects invalid worker inputs", async () => {
    await expect(sql`select public.claim_pending_events('', 10, 300)`).rejects.toThrow();
    await expect(sql`select public.claim_pending_events('w', 0, 300)`).rejects.toThrow();
    await expect(sql`select public.claim_pending_events('w', 10, 0)`).rejects.toThrow();
    await expect(sql`select public.fail_event('', ${randomUUID()}, 'x', 0)`).rejects.toThrow();
    await expect(sql`select public.fail_event('w', ${randomUUID()}, 'x', -1)`).rejects.toThrow();
  });
});
