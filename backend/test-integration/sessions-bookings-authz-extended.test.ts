import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";
import { makeOffering } from "./_fixtures/offering.js";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const dbUrl = process.env.SUPABASE_TEST_DB_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
const target = new URL(url);
if (!["localhost", "127.0.0.1", "host.docker.internal"].includes(target.hostname)) throw new Error("Refusing to run integration tests against a non-local Supabase target.");

const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const publicAnon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 4 });
const password = "Local-test-only-Password1!";
async function signup(role: "student" | "tutor") {
  const email = `az-${randomUUID()}@example.test`;
  return signUpConfirmed({ anon, url: url!, publishableKey: key!, serviceRoleKey: serviceKey!, email, password, metadata: { name: "Authz", role }, trustedTutor: role === "tutor" });
}
const FUTURE = { startsAt: new Date(Date.now() + 2 * 3600e3).toISOString(), endsAt: new Date(Date.now() + 3 * 3600e3).toISOString() };
const PAST = { startsAt: new Date(Date.now() - 3 * 3600e3).toISOString(), endsAt: new Date(Date.now() - 2 * 3600e3).toISOString() };
async function createSession(tutor: { client: SupabaseClient }, o: Record<string, unknown> = {}) {
  const offeringId = await makeOffering(tutor.client, tutor.user.id, "workshop");
  return tutor.client.rpc("create_session", { payload: { offeringId, ...FUTURE, ...o } });
}

describe.sequential("sessions + bookings extended authorization", () => {
  beforeAll(async () => {
    for (const n of ["0001_create_profiles.sql", "0004_create_sessions_and_bookings.sql", "0005_create_booking_session_rpcs.sql", "0006_create_event_outbox.sql", "0007_emit_domain_events_from_booking_session_rpcs.sql"]) {
      const m = await readFile(fileURLToPath(new URL(`../supabase/migrations/${n}`, import.meta.url)), "utf8");
      await sql.unsafe(m);
    }
    await sql`drop function if exists public.create_booking(uuid, integer)`;
  });

  it("learner A cannot read private Booking of learner B", async () => {
    const tutor = await signup("tutor");
    const la = await signup("student");
    const lb = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 5 });
    const b = await la.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    expect((await lb.client.rpc("get_booking", { bid: b.data.id })).error).toBeTruthy();
    expect((await la.client.rpc("get_booking", { bid: b.data.id })).error).toBeNull();
  });

  it("learner cannot host-confirm a booking", async () => {
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    expect(b.error).toBeNull();
    const confirmByLearner = await l.client.rpc("confirm_booking", { booking_id: b.data.id, expected_version: b.data.version });
    expect(confirmByLearner.error).toBeTruthy();
  });

  it("host A cannot mutate host B's session", async () => {
    const ta = await signup("tutor");
    const tb = await signup("tutor");
    const s = await createSession(ta, { maxParticipants: 2 });
    for (const call of [
      tb.client.rpc("cancel_session", { sid: s.data.id, expected_version: 1, cause: "host" }),
      tb.client.rpc("reschedule_session", { sid: s.data.id, startsAt: FUTURE.startsAt, endsAt: FUTURE.endsAt, expected_version: 1 }),
      tb.client.rpc("change_session_capacity", { sid: s.data.id, new_max: 3, expected_version: 1 }),
      tb.client.rpc("complete_session", { sid: s.data.id, expected_version: 1 }),
    ]) {
      expect((await call).error).toBeTruthy();
    }
  });

  it("host cannot impersonate learner actor on cancel", async () => {
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    const hostCancelRequested = await tutor.client.rpc("cancel_booking", { booking_id: b.data.id, expected_version: b.data.version, cause: "host" });
    expect(hostCancelRequested.error?.message).toContain("INVALID_TRANSITION");
    const cf = await tutor.client.rpc("confirm_booking", { booking_id: b.data.id, expected_version: b.data.version });
    const learnerAsHostCause = await l.client.rpc("cancel_booking", { booking_id: b.data.id, expected_version: cf.data.version, cause: "host" });
    expect(learnerAsHostCause.error?.message).toContain("INVALID_TRANSITION");
    const hostCancelConfirmed = await tutor.client.rpc("cancel_booking", { booking_id: b.data.id, expected_version: cf.data.version, cause: "host" });
    expect(hostCancelConfirmed.error).toBeNull();
  });

  it("anon cannot access private booking data; can read public sessions only", async () => {
    const tutor = await signup("tutor");
    const s = await createSession(tutor, { maxParticipants: 2 });
    expect((await publicAnon.rpc("get_my_bookings")).error).toBeTruthy();
    expect((await publicAnon.rpc("get_booking", { bid: s.data.id })).error).toBeTruthy();
    const listed = await publicAnon.rpc("list_sessions");
    expect(listed.error).toBeNull();
    expect(JSON.stringify(listed.data)).not.toMatch(/host_id|learner_id|"email"|"phone"/i);
  });

  it("public session read contains no private host/learner fields", async () => {
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 5 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    expect(b.error).toBeNull();
    const got = await publicAnon.rpc("get_session", { sid: s.data.id });
    expect(got.error).toBeNull();
    expect(JSON.stringify(got.data)).not.toMatch(/host_id|learner_id|hostId|"email"|"phone"/i);
    expect(got.data).not.toHaveProperty("hostId");
    expect(got.data.hardReservedCapacity).toBe(1);
  });

  it("attendance authority: only host records, only after the session ends, once", async () => {
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { ...PAST, maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    const cf = await tutor.client.rpc("confirm_booking", { booking_id: b.data.id, expected_version: b.data.version });
    const byLearner = await l.client.rpc("record_attendance", { booking_id: b.data.id, outcome: "attended", expected_version: cf.data.version });
    expect(byLearner.error).toBeTruthy();
    const byHost = await tutor.client.rpc("record_attendance", { booking_id: b.data.id, outcome: "attended", expected_version: cf.data.version });
    expect(byHost.error).toBeNull();
    const again = await tutor.client.rpc("record_attendance", { booking_id: b.data.id, outcome: "attended", expected_version: cf.data.version + 1 });
    expect(again.error?.message).toContain("INVALID_TRANSITION");
    expect((await sql`select status from public.bookings where id=${b.data.id}`)[0].status).toBe("completed");
  });

  it("reschedule acceptance obeys actor authority", async () => {
    const tutor = await signup("tutor");
    const l = await signup("student");
    const third = await signup("student");
    const a = await createSession(tutor, { maxParticipants: 1 });
    const c = await createSession(tutor, { maxParticipants: 1 });
    const b = await l.client.rpc("create_booking", { session_id: a.data.id, participant_count: 1 });
    const r = await l.client.rpc("create_reschedule_request", { booking_id: b.data.id, target_session_id: c.data.id, expected_version: b.data.version });
    expect(r.error).toBeNull();
    const byThirdLearner = await third.client.rpc("accept_reschedule_request", { request_id: r.data.id });
    expect(byThirdLearner.error).toBeTruthy();
    const byWrongTutor = await signup("tutor");
    const byOtherHost = await byWrongTutor.client.rpc("accept_reschedule_request", { request_id: r.data.id });
    expect(byOtherHost.error).toBeTruthy();
    const byHost = await tutor.client.rpc("accept_reschedule_request", { request_id: r.data.id });
    expect(byHost.error).toBeNull();
  });

  it("host-requested reschedule is accepted only by the learner", async () => {
    const tutor = await signup("tutor");
    const l = await signup("student");
    const a = await createSession(tutor, { maxParticipants: 2 });
    const c = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: a.data.id, participant_count: 1 });
    const r = await tutor.client.rpc("create_reschedule_request", { booking_id: b.data.id, target_session_id: c.data.id, expected_version: b.data.version });
    expect(r.error).toBeNull();
    const byHost = await tutor.client.rpc("accept_reschedule_request", { request_id: r.data.id });
    expect(byHost.error).toBeTruthy();
    const byLearner = await l.client.rpc("accept_reschedule_request", { request_id: r.data.id });
    expect(byLearner.error).toBeNull();
  });
});

afterAll(() => sql.end());
