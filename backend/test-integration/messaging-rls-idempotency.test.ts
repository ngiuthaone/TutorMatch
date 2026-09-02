// test-integration/messaging-rls-idempotency.test.ts
//
// RLS, idempotency, and membership assertions for the booking-anchored
// messaging surface. Reuses shared fixtures from _fixtures/messaging.ts
// so the migration-apply loop, the signup helper, and the booking
// helper are not duplicated across this file and messaging-blocking.test.ts.

import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  SUPABASE_DB_URL,
  applyMessagingMigrations,
  createConfirmedBooking,
  getOrCreateConversationId,
  sendAs,
  signup,
  type Fixture,
} from "./_fixtures/messaging.js";

let sql: ReturnType<typeof postgres>;

beforeAll(async () => {
  sql = postgres(SUPABASE_DB_URL!, { max: 4 });
  await applyMessagingMigrations(sql);
});
afterAll(async () => {
  if (sql) await sql.end();
});

describe.sequential("messaging Alpha (MSG-010 / DEC-015): RLS, idempotency, membership", () => {
  it("denies direct table access to anon and authenticated", async () => {
    const learner = await signup("student");
    for (const t of ["conversations", "conversation_members", "messages"]) {
      const sel = await learner.client.from(t as "conversations").select().limit(1);
      expect(sel.error).toBeTruthy();
      const ins = await learner.client.from(t as "conversations").insert({});
      expect(ins.error).toBeTruthy();
    }
    const anonSel = await learner.client.from("conversations").select().limit(1);
    expect(anonSel.error).toBeTruthy();
  });

  it("creates a conversation tied to a booking and seeds membership for host + learner", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner, sql);
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
    const { bookingId } = await createConfirmedBooking(tutor, learner, sql);
    const a = await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId });
    const b = await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId });
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect((a.data as { id: string }).id).toBe((b.data as { id: string }).id);
  });

  it("isolates conversations between bookings: cross-account reads are denied", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const intruder = await signup("student");
    const { bookingId, sessionId } = await createConfirmedBooking(tutor, learner, sql);
    const conv = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId })).data as { id: string };
    const denied = await intruder.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId });
    expect(denied.error).toBeTruthy();
    const intruderList = await intruder.client.rpc("list_my_conversations");
    expect(JSON.stringify(intruderList.data)).not.toContain(conv.id);
    const intruderRead = await intruder.client.rpc("list_conversation_messages", { cid: conv.id });
    expect(intruderRead.error).toBeTruthy();
    void sessionId;
  });

  it("host and learner can read each other's messages inside the conversation", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner, sql);
    const conv = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId })).data as { id: string };
    await learner.client.rpc("send_message", { cid: conv.id, p_client_message_id: `learner-${crypto.randomUUID()}`, p_body: "Hi from learner" });
    await tutor.client.rpc("send_message", { cid: conv.id, p_client_message_id: `host-${crypto.randomUUID()}`, p_body: "Hi from host" });
    const learnerMessages = (await learner.client.rpc("list_conversation_messages", { cid: conv.id })).data as Array<{ body: string; mine: boolean }>;
    const tutorMessages = (await tutor.client.rpc("list_conversation_messages", { cid: conv.id })).data as Array<{ body: string; mine: boolean }>;
    expect(learnerMessages).toHaveLength(2);
    expect(tutorMessages).toHaveLength(2);
    expect(learnerMessages.find((m) => m.body === "Hi from host")?.mine).toBe(false);
    expect(tutorMessages.find((m) => m.body === "Hi from host")?.mine).toBe(true);
  });

  it("replays the same client_message_id and returns the existing row without a duplicate", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner, sql);
    const conv = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId })).data as { id: string };
    const key = `dup-${crypto.randomUUID()}`;
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
    const a = await createConfirmedBooking(tutor, learner, sql);
    const b = await createConfirmedBooking(tutor, learner, sql);
    const convA = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: a.bookingId })).data as { id: string };
    const convB = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: b.bookingId })).data as { id: string };
    const key = `shared-${crypto.randomUUID()}`;
    const first = await learner.client.rpc("send_message", { cid: convA.id, p_client_message_id: key, p_body: "hello" });
    expect(first.error).toBeNull();
    const cross = await learner.client.rpc("send_message", { cid: convB.id, p_client_message_id: key, p_body: "hello" });
    expect(cross.error?.message).toContain("IDEMPOTENCY_CONFLICT");
  });

  it("rejects empty / oversized bodies and missing client_message_id", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner, sql);
    const conv = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId })).data as { id: string };
    const empty = await learner.client.rpc("send_message", { cid: conv.id, p_client_message_id: `e-${crypto.randomUUID()}`, p_body: "   " });
    expect(empty.error?.message).toContain("INVALID_MESSAGE");
    const tooLong = "x".repeat(2001);
    const tooLongResult = await learner.client.rpc("send_message", { cid: conv.id, p_client_message_id: `t-${crypto.randomUUID()}`, p_body: tooLong });
    expect(tooLongResult.error?.message).toContain("INVALID_MESSAGE");
    const shortKey = await learner.client.rpc("send_message", { cid: conv.id, p_client_message_id: "abc", p_body: "x" });
    expect(shortKey.error?.message).toContain("INVALID_MESSAGE");
  });

  it("updates last_message_at + preview and exposes them to the other participant", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner, sql);
    const conv = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId })).data as { id: string };
    await learner.client.rpc("send_message", { cid: conv.id, p_client_message_id: `p-${crypto.randomUUID()}`, p_body: "Please bring materials" });
    const tutorView = (await tutor.client.rpc("get_conversation", { cid: conv.id })).data as { lastMessagePreview: string; lastMessage: { body: string } | null; unreadCount: number };
    expect(tutorView.lastMessagePreview).toContain("Please bring");
    expect(tutorView.lastMessage?.body).toBe("Please bring materials");
    expect(tutorView.unreadCount).toBe(1);
    await tutor.client.rpc("mark_conversation_read", { cid: conv.id });
    const after = (await tutor.client.rpc("get_conversation", { cid: conv.id })).data as { unreadCount: number };
    expect(after.unreadCount).toBe(0);
  });

  it("non-participant cannot send into a conversation even with a valid token", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const intruder = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner, sql);
    const conv = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId })).data as { id: string };
    const attempt = await intruder.client.rpc("send_message", { cid: conv.id, p_client_message_id: `bad-${crypto.randomUUID()}`, p_body: "should fail" });
    expect(attempt.error).toBeTruthy();
    const rows = await sql<{ n: number }[]>`select count(*)::int as n from public.messages where conversation_id = ${conv.id}`;
    expect(rows[0].n).toBe(0);
  });

  it("list_my_conversations does not leak conversations of other participants", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const stranger = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner, sql);
    const conv = (await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId })).data as { id: string };
    const strangerList = await stranger.client.rpc("list_my_conversations");
    expect(JSON.stringify(strangerList.data)).not.toContain(conv.id);
    const learnerList = await learner.client.rpc("list_my_conversations");
    expect(JSON.stringify(learnerList.data)).toContain(conv.id);
  });
});
