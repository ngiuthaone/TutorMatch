import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const dbUrl = process.env.SUPABASE_TEST_DB_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
const target = new URL(url);
if (!["localhost", "127.0.0.1", "host.docker.internal"].includes(target.hostname)) throw new Error("Refusing to run integration tests against a non-local Supabase target.");

const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 4 });
const password = "Local-test-only-Password1!";
async function signup(role: "student" | "tutor") {
  const email = `cx-${randomUUID()}@example.test`;
  return signUpConfirmed({ anon, url: url!, publishableKey: key!, serviceRoleKey: serviceKey!, email, password, metadata: { name: "ConcurrencyX", role }, trustedTutor: role === "tutor" });
}
const FUTURE = { startsAt: new Date(Date.now() + 2 * 3600e3).toISOString(), endsAt: new Date(Date.now() + 3 * 3600e3).toISOString() };
async function createSession(tutor: { client: SupabaseClient }, o: Record<string, unknown> = {}) {
  return tutor.client.rpc("create_session", { payload: { ...FUTURE, ...o } });
}
async function reserved(sid: string) {
  const rows = await sql`select coalesce(sum(participant_count),0)::int as n from public.bookings where session_id=${sid} and status in ('requested','confirmed')`;
  return rows[0].n;
}
async function versionOf(sid: string) {
  const rows = await sql`select version from public.sessions where id=${sid}`;
  return rows[0].version;
}

describe.sequential("sessions + bookings extended concurrency invariants", () => {
  beforeAll(async () => {
    for (const n of ["0001_create_profiles.sql", "0004_create_sessions_and_bookings.sql", "0005_create_booking_session_rpcs.sql", "0006_create_event_outbox.sql", "0007_emit_domain_events_from_booking_session_rpcs.sql"]) {
      const m = await readFile(fileURLToPath(new URL(`../supabase/migrations/${n}`, import.meta.url)), "utf8");
      await sql.unsafe(m);
    }
  });

  it("A. multi-seat race: remaining=3, A requests 2, B requests 2 concurrently, exactly one wins", async () => {
    const tutor = await signup("tutor");
    const l1 = await signup("student");
    const l2 = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 5 });
    const filler = await signup("student");
    const fill = await filler.client.rpc("create_booking", { session_id: s.data.id, participant_count: 2 });
    expect(fill.error).toBeNull();
    expect(await reserved(s.data.id)).toBe(2);
    const results = await Promise.all([
      l1.client.rpc("create_booking", { session_id: s.data.id, participant_count: 2 }),
      l2.client.rpc("create_booking", { session_id: s.data.id, participant_count: 2 }),
    ]);
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    const failed = results.find((r) => r.error);
    expect(failed!.error!.message).toContain("INSUFFICIENT_CAPACITY");
    expect(await reserved(s.data.id)).toBe(4);
  });

  it("B. concurrent reschedules into the same last seat: exactly one accept wins, loser stays put", async () => {
    const tutor = await signup("tutor");
    const la = await signup("student");
    const lb = await signup("student");
    const lc = await signup("student");
    const s1 = await createSession(tutor, { maxParticipants: 2 });
    const s2 = await createSession(tutor, { maxParticipants: 2 });
    const target = await createSession(tutor, { maxParticipants: 3 });
    const holder = await lc.client.rpc("create_booking", { session_id: target.data.id, participant_count: 2 });
    const holderCf = await tutor.client.rpc("confirm_booking", { booking_id: holder.data.id, expected_version: holder.data.version });
    expect(holderCf.error).toBeNull();
    expect(await reserved(target.data.id)).toBe(2);
    const ba = await la.client.rpc("create_booking", { session_id: s1.data.id, participant_count: 1 });
    const baCf = await tutor.client.rpc("confirm_booking", { booking_id: ba.data.id, expected_version: ba.data.version });
    expect(baCf.error).toBeNull();
    const bb = await lb.client.rpc("create_booking", { session_id: s2.data.id, participant_count: 1 });
    const bbCf = await tutor.client.rpc("confirm_booking", { booking_id: bb.data.id, expected_version: bb.data.version });
    expect(bbCf.error).toBeNull();
    expect(await reserved(target.data.id)).toBe(2);
    const ra = await la.client.rpc("create_reschedule_request", { booking_id: ba.data.id, target_session_id: target.data.id, expected_version: baCf.data.version });
    const rb = await lb.client.rpc("create_reschedule_request", { booking_id: bb.data.id, target_session_id: target.data.id, expected_version: bbCf.data.version });
    expect(ra.error).toBeNull();
    expect(rb.error).toBeNull();
    const results = await Promise.all([
      tutor.client.rpc("accept_reschedule_request", { request_id: ra.data.id }),
      tutor.client.rpc("accept_reschedule_request", { request_id: rb.data.id }),
    ]);
    const ok = results.filter((r) => !r.error);
    const failed = results.find((r) => r.error);
    expect(ok).toHaveLength(1);
    expect(failed!.error!.message).toContain("INSUFFICIENT_CAPACITY");
    const movedRows = await sql`select id from public.bookings where session_id=${target.data.id}`;
    expect(movedRows).toHaveLength(2);
    const mover = (await sql`select id from public.bookings where session_id=${target.data.id} and id=${ba.data.id} limit 1`)[0];
    const loserId = mover ? bb.data.id : ba.data.id;
    const loserOriginal = mover ? s2.data.id : s1.data.id;
    const loserRow = (await sql`select session_id from public.bookings where id=${loserId}`)[0];
    expect(loserRow.session_id).toBe(loserOriginal);
    expect(await reserved(loserOriginal)).toBe(1);
    expect(await reserved(target.data.id)).toBe(3);
  });

  it("C. confirm vs cancel race: serializes to exactly one legal state, no double effect", async () => {
    for (let i = 0; i < 3; i++) {
      const tutor = await signup("tutor");
      const l = await signup("student");
      const s = await createSession(tutor, { maxParticipants: 2 });
      const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
      expect(b.error).toBeNull();
      const [confirm, cancel] = await Promise.all([
        tutor.client.rpc("confirm_booking", { booking_id: b.data.id, expected_version: b.data.version }),
        l.client.rpc("cancel_booking", { booking_id: b.data.id, expected_version: b.data.version, cause: "attendee" }),
      ]);
      const finalRow = (await sql`select status from public.bookings where id=${b.data.id}`)[0];
      expect(["confirmed", "cancelled"]).toContain(finalRow.status);
      const hist = await sql`select from_status,to_status from public.booking_history where booking_id=${b.data.id} order by at,id`;
      const chain = hist.map((h: { from_status: string | null; to_status: string }) => h.to_status);
      expect(chain).toEqual(["requested", finalRow.status]);
      if (finalRow.status === "confirmed") {
        expect(await reserved(s.data.id)).toBe(1);
        const cancelAfter = await l.client.rpc("cancel_booking", { booking_id: b.data.id, expected_version: b.data.version + 1, cause: "attendee" });
        expect(cancelAfter.error).toBeNull();
        expect(await reserved(s.data.id)).toBe(0);
      } else {
        expect(await reserved(s.data.id)).toBe(0);
        const confirmAfter = await tutor.client.rpc("confirm_booking", { booking_id: b.data.id, expected_version: b.data.version });
        expect(confirmAfter.error).toBeTruthy();
      }
    }
  });

  it("D. session cancel vs reschedule accept: never an active booking on a cancelled session", async () => {
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s1 = await createSession(tutor, { maxParticipants: 2 });
    const s2 = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s1.data.id, participant_count: 1 });
    const cf = await tutor.client.rpc("confirm_booking", { booking_id: b.data.id, expected_version: b.data.version });
    expect(cf.error).toBeNull();
    const r = await l.client.rpc("create_reschedule_request", { booking_id: b.data.id, target_session_id: s2.data.id, expected_version: cf.data.version });
    expect(r.error).toBeNull();
    const sv = await versionOf(s1.data.id);
    const [cancel, accept] = await Promise.all([
      tutor.client.rpc("cancel_session", { sid: s1.data.id, expected_version: sv, cause: "host" }),
      tutor.client.rpc("accept_reschedule_request", { request_id: r.data.id }),
    ]);
    const row = (await sql`select b.status as bstatus, b.session_id, s1.status as s1status, s2.status as s2status from public.bookings b join public.sessions s1 on s1.id=b.session_id join public.sessions s2 on s2.id=${s2.data.id} where b.id=${b.data.id}`)[0];
    if (row.bstatus === "cancelled") {
      expect(row.s1status).toBe("cancelled");
      expect(accept.error).toBeTruthy();
    } else if (row.session_id === s2.data.id) {
      expect(row.bstatus).toBe("confirmed");
      expect(row.s2status).toBe("scheduled");
      expect(accept.error).toBeNull();
      expect(cancel.error).toBeNull();
    }
    const activeOnCancelled = await sql`select count(*)::int as n from public.bookings b join public.sessions s on s.id=b.session_id where s.status='cancelled' and b.status in ('requested','confirmed')`;
    expect(activeOnCancelled[0].n).toBe(0);
  });

  it("E. session cancel vs confirm: never Session cancelled with active confirmed booking", async () => {
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    const sv = await versionOf(s.data.id);
    const [confirm, cancel] = await Promise.all([
      tutor.client.rpc("confirm_booking", { booking_id: b.data.id, expected_version: b.data.version }),
      tutor.client.rpc("cancel_session", { sid: s.data.id, expected_version: sv, cause: "host" }),
    ]);
    const row = (await sql`select b.status as bstatus, s.status as sstatus from public.bookings b join public.sessions s on s.id=b.session_id where b.id=${b.data.id}`)[0];
    expect(row.sstatus).toBe("cancelled");
    expect(row.bstatus).toBe("cancelled");
    expect(await reserved(s.data.id)).toBe(0);
  });

  it("F. duplicate / stale CAS commands fail safely with no double effect", async () => {
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    expect(b.error).toBeNull();
    const c1 = await tutor.client.rpc("confirm_booking", { booking_id: b.data.id, expected_version: b.data.version });
    expect(c1.error).toBeNull();
    const c2 = await tutor.client.rpc("confirm_booking", { booking_id: b.data.id, expected_version: b.data.version + 1 });
    expect(c2.error?.message).toContain("INVALID_TRANSITION");
    const histAfterConfirm = await sql`select to_status from public.booking_history where booking_id=${b.data.id} order by at,id`;
    expect(histAfterConfirm.map((h: { to_status: string }) => h.to_status)).toEqual(["requested", "confirmed"]);
    expect(await reserved(s.data.id)).toBe(1);
    const x1 = await l.client.rpc("cancel_booking", { booking_id: b.data.id, expected_version: b.data.version + 1, cause: "attendee" });
    expect(x1.error).toBeNull();
    const x2 = await l.client.rpc("cancel_booking", { booking_id: b.data.id, expected_version: b.data.version + 2, cause: "attendee" });
    expect(x2.error?.message).toContain("INVALID_TRANSITION");
    expect(await reserved(s.data.id)).toBe(0);
    expect((await sql`select count(*)::int as n from public.booking_history where booking_id=${b.data.id} and to_status='cancelled'`)[0].n).toBe(1);
  });

  it("F2. accept_reschedule_request twice fails the second time", async () => {
    const tutor = await signup("tutor");
    const l = await signup("student");
    const a = await createSession(tutor, { maxParticipants: 1 });
    const c = await createSession(tutor, { maxParticipants: 1 });
    const b = await l.client.rpc("create_booking", { session_id: a.data.id, participant_count: 1 });
    const r = await l.client.rpc("create_reschedule_request", { booking_id: b.data.id, target_session_id: c.data.id, expected_version: b.data.version });
    const ok = await tutor.client.rpc("accept_reschedule_request", { request_id: r.data.id });
    expect(ok.error).toBeNull();
    const again = await tutor.client.rpc("accept_reschedule_request", { request_id: r.data.id });
    expect(again.error?.message).toContain("INVALID_TRANSITION");
    const row = (await sql`select session_id from public.bookings where id=${b.data.id}`)[0];
    expect(row.session_id).toBe(c.data.id);
    expect(await reserved(a.data.id)).toBe(0);
    expect(await reserved(c.data.id)).toBe(1);
  });

  it("F3. cancel vs reschedule accept race: single legal outcome, no capacity leak", async () => {
    const tutor = await signup("tutor");
    const l = await signup("student");
    const a = await createSession(tutor, { maxParticipants: 2 });
    const c = await createSession(tutor, { maxParticipants: 2 });
    const b = await l.client.rpc("create_booking", { session_id: a.data.id, participant_count: 1 });
    const r = await l.client.rpc("create_reschedule_request", { booking_id: b.data.id, target_session_id: c.data.id, expected_version: b.data.version });
    const [cancel, accept] = await Promise.all([
      l.client.rpc("cancel_booking", { booking_id: b.data.id, expected_version: b.data.version, cause: "attendee" }),
      tutor.client.rpc("accept_reschedule_request", { request_id: r.data.id }),
    ]);
    const row = (await sql`select session_id,status from public.bookings where id=${b.data.id}`)[0];
    if (row.status === "cancelled") {
      expect(accept.error).toBeTruthy();
      expect(await reserved(a.data.id)).toBe(0);
      expect(await reserved(c.data.id)).toBe(0);
    } else {
      expect(row.session_id).toBe(c.data.id);
      expect(await reserved(a.data.id)).toBe(0);
      expect(await reserved(c.data.id)).toBe(1);
    }
  });

  it("G. seat reuse: confirmed booking releases capacity, another booking reuses the same seat", async () => {
    const tutor = await signup("tutor");
    const l1 = await signup("student");
    const l2 = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 1 });
    const b1 = await l1.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    const cf = await tutor.client.rpc("confirm_booking", { booking_id: b1.data.id, expected_version: b1.data.version });
    expect(await reserved(s.data.id)).toBe(1);
    const canc = await l1.client.rpc("cancel_booking", { booking_id: b1.data.id, expected_version: cf.data.version, cause: "attendee" });
    expect(canc.error).toBeNull();
    expect(await reserved(s.data.id)).toBe(0);
    const b2 = await l2.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    expect(b2.error).toBeNull();
    expect(await reserved(s.data.id)).toBe(1);
  });

  it("H. multi-participant booking is a single Booking with authoritative participant count", async () => {
    const tutor = await signup("tutor");
    const l1 = await signup("student");
    const l2 = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 5 });
    const b = await l1.client.rpc("create_booking", { session_id: s.data.id, participant_count: 2 });
    expect(b.error).toBeNull();
    const rows = await sql`select count(*)::int as n from public.bookings where id=${b.data.id}`;
    expect(rows[0].n).toBe(1);
    expect(await reserved(s.data.id)).toBe(2);
    const dup = await l1.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    expect(dup.error?.message).toContain("BOOKING_CONFLICT");
    const other = await l2.client.rpc("create_booking", { session_id: s.data.id, participant_count: 3 });
    expect(other.error).toBeNull();
    expect(await reserved(s.data.id)).toBe(5);
    const overflow = await signup("student");
    const over = await overflow.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    expect(over.error?.message).toContain("INSUFFICIENT_CAPACITY");
  });

  it("I. active-uniqueness ruling: active duplicate blocked, terminal rows coexist with later booking", async () => {
    const tutor = await signup("tutor");
    const l = await signup("student");
    const s = await createSession(tutor, { maxParticipants: 3 });
    const b1 = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    expect(b1.error).toBeNull();
    const dup = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    expect(dup.error?.message).toContain("BOOKING_CONFLICT");
    const canc = await l.client.rpc("cancel_booking", { booking_id: b1.data.id, expected_version: b1.data.version, cause: "attendee" });
    expect(canc.error).toBeNull();
    const b2 = await l.client.rpc("create_booking", { session_id: s.data.id, participant_count: 1 });
    expect(b2.error).toBeNull();
    const rows = await sql`select status from public.bookings where learner_id=${l.user.id} and session_id=${s.data.id} order by created_at`;
    expect(rows.map((r: { status: string }) => r.status)).toEqual(["cancelled", "requested"]);
  });
});
