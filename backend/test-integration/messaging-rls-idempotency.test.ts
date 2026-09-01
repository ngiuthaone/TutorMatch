import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";
import { makeOffering } from "./_fixtures/offering.js";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const dbUrl = process.env.SUPABASE_TEST_DB_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
if (!["localhost", "127.0.0.1", "host.docker.internal"].includes(new URL(url).hostname)) throw new Error("Refusing to run integration tests against a non-local Supabase target.");
const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 4 });
const password = "Local-test-only-Password1!";

async function signup(role: "student" | "tutor") {
  const email = `msg-${randomUUID()}@example.test`;
  // Each signup gets its own anon client so the second signIn does not race
  // against the first (the shared anon client kept overwriting the cached
  // session and the second signIn returned no session).
  return signUpConfirmed({
    anon: createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
    url: url!,
    publishableKey: key!,
    serviceRoleKey: serviceKey!,
    email,
    password,
    metadata: { name: `Messaging ${role}`, role },
    trustedTutor: role === "tutor",
  });
}

const FUTURE = { startsAt: new Date(Date.now() + 2 * 3600e3).toISOString(), endsAt: new Date(Date.now() + 3 * 3600e3).toISOString() };

type Fixture = Awaited<ReturnType<typeof signup>>;

async function createConfirmedBooking(tutor: Fixture, learner: Fixture) {
  const offeringId = await makeOffering(tutor.client, tutor.user.id, "workshop", "hourly_v1", { hourlyRateVnd: 200000 });
  const session = await tutor.client.rpc("create_session", { payload: { offeringId, ...FUTURE, maxParticipants: 2 } });
  if (session.error || !session.data) throw session.error ?? new Error("create_session failed");
  const booking = await learner.client.rpc("create_booking", { session_id: session.data.id, participant_count: 1 });
  if (booking.error || !booking.data) throw booking.error ?? new Error("create_booking failed");
  const confirm = await tutor.client.rpc("confirm_booking", { booking_id: booking.data.id, expected_version: booking.data.version });
  if (confirm.error) throw confirm.error;
  return { bookingId: booking.data.id, sessionId: session.data.id };
}

describe.sequential("messaging Alpha (MSG-010 / DEC-015): RLS, idempotency, membership", () => {
  beforeAll(async () => {
    for (const n of [
      "0001_create_profiles.sql",
      "0002_create_tutor_cvs.sql",
      "0003_create_marketplace_listings.sql",
      "0004_create_sessions_and_bookings.sql",
      "0005_create_booking_session_rpcs.sql",
      "0006_create_event_outbox.sql",
      "0007_emit_domain_events_from_booking_session_rpcs.sql",
      "20260815150540_tutor_authorization_hardening.sql",
      "20260904120000_messaging_alpha_v1.sql",
    ]) {
      const m = await readFile(fileURLToPath(new URL(`../supabase/migrations/${n}`, import.meta.url)), "utf8");
      await sql.unsafe(m);
    }
    await sql`drop function if exists public.create_booking(uuid, integer)`;
  });

  it("denies direct table access to anon and authenticated", async () => {
    const learner = await signup("student");
    for (const t of ["conversations", "conversation_members", "messages"]) {
      const sel = await learner.client.from(t as "conversations").select().limit(1);
      expect(sel.error).toBeTruthy();
      const ins = await learner.client.from(t as "conversations").insert({});
      expect(ins.error).toBeTruthy();
    }
    const anonSel = await anon.from("conversations").select().limit(1);
    expect(anonSel.error).toBeTruthy();
  });

  it("creates a conversation tied to a booking and seeds membership for host + learner", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner);
    const created = await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId });
    expect(created.error).toBeNull();
    const conv = created.data as { id: string; participant: { role: string; displayName: string }; viewerRole: string; bookingContext: { bookingId: string } | null };
    expect(conv.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(conv.viewerRole).toBe("learner");
    expect(conv.participant.role).toBe("host");
    expect(conv.bookingContext?.bookingId).toBe(bookingId);
    const members = await sql<{ count: string }[]>`select count(*)::text as count from public.conversation_members where conversation_id = ${conv.id}`;
    expect(Number(members[0].count)).toBe(2);
  });

  it("returns the same conversation for the same booking on retry (idempotent open)", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner);
    const a = await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId });
    expect(a.error).toBeNull();
    const b = await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId });
    expect(b.error).toBeNull();
    expect((a.data as { id: string }).id).toBe((b.data as { id: string }).id);
  });

  it("isolates conversations between bookings: cross-account reads are denied", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const intruder = await signup("student");
    const { bookingId, sessionId } = await createConfirmedBooking(tutor, learner);
    const conv = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId })).data as { id: string };
    // intruder is neither host nor learner on this booking — RPC must refuse.
    const denied = await intruder.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId });
    expect(denied.error).toBeTruthy();
    // Listing must not surface conversations the intruder has no part of.
    const intruderList = await intruder.client.rpc("list_my_conversations");
    expect(JSON.stringify(intruderList.data)).not.toContain(conv.id);
    // And the intruder cannot read messages inside this conversation.
    const intruderRead = await intruder.client.rpc("list_conversation_messages", { cid: conv.id });
    expect(intruderRead.error).toBeTruthy();
    void sessionId;
  });

  it("host and learner can read each other's messages inside the conversation", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner);
    const conv = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId })).data as { id: string };
    await learner.client.rpc("send_message", { cid: conv.id, p_client_message_id: `learner-${randomUUID()}`, p_body: "Hi from learner" });
    await tutor.client.rpc("send_message", { cid: conv.id, p_client_message_id: `host-${randomUUID()}`, p_body: "Hi from host" });
    const learnerMessages = await learner.client.rpc("list_conversation_messages", { cid: conv.id });
    const tutorMessages = await tutor.client.rpc("list_conversation_messages", { cid: conv.id });
    const learnerList = learnerMessages.data as Array<{ body: string; mine: boolean }>;
    const tutorList = tutorMessages.data as Array<{ body: string; mine: boolean }>;
    expect(learnerList).toHaveLength(2);
    expect(tutorList).toHaveLength(2);
    expect(learnerList.find((m) => m.body === "Hi from host")?.mine).toBe(false);
    expect(tutorList.find((m) => m.body === "Hi from host")?.mine).toBe(true);
  });

  it("replays the same client_message_id and returns the existing row without a duplicate", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner);
    const conv = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId })).data as { id: string };
    const key = `dup-${randomUUID()}`;
    const first = await learner.client.rpc("send_message", { cid: conv.id, p_client_message_id: key, p_body: "Original body" });
    const second = await learner.client.rpc("send_message", { cid: conv.id, p_client_message_id: key, p_body: "Original body" });
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect((first.data as { id: string }).id).toBe((second.data as { id: string }).id);
    expect((second.data as { duplicate: boolean }).duplicate).toBe(true);
    const count = await sql<{ n: number }[]>`select count(*)::int as n from public.messages where conversation_id = ${conv.id}`;
    expect(count[0].n).toBe(1);
  });

  it("rejects the same client_message_id across different conversations (IDEMPOTENCY_CONFLICT)", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const a = await createConfirmedBooking(tutor, learner);
    const b = await createConfirmedBooking(tutor, learner);
    const convA = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: a.bookingId })).data as { id: string };
    const convB = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: b.bookingId })).data as { id: string };
    const key = `shared-${randomUUID()}`;
    const first = await learner.client.rpc("send_message", { cid: convA.id, p_client_message_id: key, p_body: "hello" });
    expect(first.error).toBeNull();
    const cross = await learner.client.rpc("send_message", { cid: convB.id, p_client_message_id: key, p_body: "hello" });
    expect(cross.error?.message).toContain("IDEMPOTENCY_CONFLICT");
  });

  it("rejects empty / oversized bodies and missing client_message_id", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner);
    const conv = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId })).data as { id: string };
    const empty = await learner.client.rpc("send_message", { cid: conv.id, p_client_message_id: `e-${randomUUID()}`, p_body: "   " });
    expect(empty.error?.message).toContain("INVALID_MESSAGE");
    const tooLong = "x".repeat(2001);
    const tooLongResult = await learner.client.rpc("send_message", { cid: conv.id, p_client_message_id: `t-${randomUUID()}`, p_body: tooLong });
    expect(tooLongResult.error?.message).toContain("INVALID_MESSAGE");
    const shortKey = await learner.client.rpc("send_message", { cid: conv.id, p_client_message_id: "abc", p_body: "x" });
    expect(shortKey.error?.message).toContain("INVALID_MESSAGE");
  });

  it("updates last_message_at + preview and exposes them to the other participant", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner);
    const conv = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId })).data as { id: string };
    await learner.client.rpc("send_message", { cid: conv.id, p_client_message_id: `p-${randomUUID()}`, p_body: "Please bring materials" });
    const tutorView = await tutor.client.rpc("get_conversation", { cid: conv.id });
    expect(tutorView.error).toBeNull();
    const view = tutorView.data as { lastMessagePreview: string; lastMessage: { body: string } | null; unreadCount: number };
    expect(view.lastMessagePreview).toContain("Please bring");
    expect(view.lastMessage?.body).toBe("Please bring materials");
    expect(view.unreadCount).toBe(1);
    await tutor.client.rpc("mark_conversation_read", { cid: conv.id });
    const after = await tutor.client.rpc("get_conversation", { cid: conv.id });
    expect((after.data as { unreadCount: number }).unreadCount).toBe(0);
  });

  it("non-participant cannot send into a conversation even with a valid token", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const intruder = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner);
    const conv = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId })).data as { id: string };
    const attempt = await intruder.client.rpc("send_message", { cid: conv.id, p_client_message_id: `bad-${randomUUID()}`, p_body: "should fail" });
    expect(attempt.error).toBeTruthy();
    const rows = await sql<{ n: number }[]>`select count(*)::int as n from public.messages where conversation_id = ${conv.id}`;
    expect(rows[0].n).toBe(0);
  });

  it("list_my_conversations does not leak conversations of other participants", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const stranger = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner);
    const conv = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId })).data as { id: string };
    const strangerList = await stranger.client.rpc("list_my_conversations");
    expect(JSON.stringify(strangerList.data)).not.toContain(conv.id);
    const learnerList = await learner.client.rpc("list_my_conversations");
    expect(JSON.stringify(learnerList.data)).toContain(conv.id);
  });
});
afterAll(() => sql.end());
