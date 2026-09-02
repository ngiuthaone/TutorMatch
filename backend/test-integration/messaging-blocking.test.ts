// test-integration/messaging-blocking.test.ts
//
// Server-authoritative blocking enforcement for the messaging surface.
// Reuses shared fixtures from _fixtures/messaging.ts so the migration
// apply loop + signup/booking helpers are not duplicated.

import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  SUPABASE_DB_URL,
  applyMessagingMigrations,
  createConfirmedBooking,
  getOrCreateConversationId,
  sendAs,
  signup,
} from "./_fixtures/messaging.js";

let sql: ReturnType<typeof postgres>;

beforeAll(async () => {
  sql = postgres(SUPABASE_DB_URL!, { max: 4 });
  await applyMessagingMigrations(sql);
});
afterAll(async () => {
  if (sql) await sql.end();
});

describe.sequential("messaging blocking (server-authoritative)", () => {
  it("A blocks B → B cannot message A", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner, sql);
    const conv = await getOrCreateConversationId(learner, bookingId);
    const ok = await sendAs(learner, conv, "Pre-block hello", "pre");
    expect(ok.error).toBeNull();
    const block = await learner.client.rpc("block_user", { p_target_user_id: tutor.user.id });
    expect(block.error).toBeNull();
    const blocked = await sendAs(tutor, conv, "After-block from tutor", "post");
    expect(blocked.error).not.toBeNull();
    expect(blocked.error!.code).toBe("42501");
    expect(blocked.error!.message).toContain("BLOCKED");
  });

  it("B blocks A → A cannot message B", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner, sql);
    const conv = await getOrCreateConversationId(learner, bookingId);
    const ok = await sendAs(learner, conv, "Pre-block from learner", "pre");
    expect(ok.error).toBeNull();
    const block = await tutor.client.rpc("block_user", { p_target_user_id: learner.user.id });
    expect(block.error).toBeNull();
    const blocked = await sendAs(learner, conv, "After-block from learner", "post");
    expect(blocked.error).not.toBeNull();
    expect(blocked.error!.code).toBe("42501");
    expect(blocked.error!.message).toContain("BLOCKED");
  });

  it("A unblocks B → messaging works again", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner, sql);
    const conv = await getOrCreateConversationId(learner, bookingId);
    await learner.client.rpc("block_user", { p_target_user_id: tutor.user.id });
    const blocked = await sendAs(learner, conv, "Should be blocked", "block");
    expect(blocked.error).not.toBeNull();
    expect(blocked.error!.code).toBe("42501");
    const unblock = await learner.client.rpc("unblock_user", { p_target_user_id: tutor.user.id });
    expect(unblock.error).toBeNull();
    const ok = await sendAs(learner, conv, "After unblock hello", "unblock");
    expect(ok.error).toBeNull();
  });

  it("existing conversation remains intact after a block (read stays; new sends rejected)", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner, sql);
    const conv = await getOrCreateConversationId(learner, bookingId);
    const m1 = await sendAs(learner, conv, "First message", "first");
    const m2 = await sendAs(tutor, conv, "Reply", "reply");
    expect(m1.error).toBeNull();
    expect(m2.error).toBeNull();
    await learner.client.rpc("block_user", { p_target_user_id: tutor.user.id });
    const list = await tutor.client.rpc("list_conversation_messages", { cid: conv, p_limit: 200 });
    expect(list.error).toBeNull();
    const messages = (list.data as Array<{ id: string }>) ?? [];
    expect(messages.length).toBeGreaterThanOrEqual(2);
    const fromTutor = await sendAs(tutor, conv, "New send from tutor", "tutor-side");
    expect(fromTutor.error).not.toBeNull();
    expect(fromTutor.error!.code).toBe("42501");
    const fromLearner = await sendAs(learner, conv, "New send from learner", "learner-side");
    expect(fromLearner.error).not.toBeNull();
    expect(fromLearner.error!.code).toBe("42501");
  });

  it("block enforcement runs server-side: a direct API call cannot bypass it", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner, sql);
    const conv = await getOrCreateConversationId(learner, bookingId);
    await learner.client.rpc("block_user", { p_target_user_id: tutor.user.id });
    const tutorClient = tutor.client;
    const directInsert = await tutorClient.from("messages").insert({
      conversation_id: conv,
      sender_id: tutor.user.id,
      body: "Direct insert bypassing RPC",
      client_message_id: `cmsg-direct-${crypto.randomUUID()}`,
    });
    expect(directInsert.error).not.toBeNull();
    expect(directInsert.error!.code).toBe("42501");
    const rpcSend = await sendAs(tutor, conv, "Via RPC", "rpc");
    expect(rpcSend.error).not.toBeNull();
    expect(rpcSend.error!.code).toBe("42501");
    expect(rpcSend.error!.message).toContain("BLOCKED");
  });
});
