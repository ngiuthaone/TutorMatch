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
const password = "Local-test-only-Password1!";

async function signup(role: "student" | "tutor") {
  const email = `block-${randomUUID()}@example.test`;
  return signUpConfirmed({
    anon: createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
    url: url!,
    publishableKey: key!,
    serviceRoleKey: serviceKey!,
    email,
    password,
    metadata: { name: `Block ${role}`, role },
    trustedTutor: role === "tutor",
  });
}

type Fixture = Awaited<ReturnType<typeof signup>>;

async function createConfirmedBooking(tutor: Fixture, learner: Fixture) {
  const offeringId = await makeOffering(tutor.client, tutor.user.id, "workshop");
  const session = await tutor.client.rpc("create_session", { payload: { offeringId, startsAt: new Date(Date.now() + 86400e3).toISOString(), endsAt: new Date(Date.now() + 90000e3).toISOString(), maxParticipants: 2 } });
  if (session.error || !session.data) throw session.error ?? new Error("create_session failed");
  const booking = await learner.client.rpc("create_booking", { session_id: session.data.id, participant_count: 1 });
  if (booking.error || !booking.data) throw booking.error ?? new Error("create_booking failed");
  const confirm = await tutor.client.rpc("confirm_booking", { booking_id: booking.data.id, expected_version: booking.data.version });
  if (confirm.error) throw confirm.error;
  return { bookingId: booking.data.id, sessionId: session.data.id, conversationId: null as string | null };
}

async function getOrCreateConversationId(learner: Fixture, bookingId: string): Promise<string> {
  const conv = await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId });
  if (conv.error || !conv.data) throw conv.error ?? new Error("get_or_create_booking_conversation failed");
  return (conv.data as { id: string }).id;
}

async function sendAs(c: Fixture, conversationId: string, body: string, suffix: string) {
  return c.client.rpc("send_message", { cid: conversationId, p_client_message_id: `cmsg-${suffix}-${randomUUID()}`, p_body: body });
}

describe.sequential("messaging blocking (server-authoritative)", () => {
  let sql: ReturnType<typeof postgres>;
  beforeAll(async () => {
    sql = postgres(dbUrl!, { max: 4 });
    // Idempotent migration setup: if a previous test run or the orchestrator
    // already applied the full migration chain, this is a no-op.
    const already = await sql<{ count: string }[]>`select count(*)::text as count from information_schema.tables where table_schema = 'public' and table_name = 'conversations'`;
    if (Number(already[0]?.count ?? "0") > 0) return;
    for (const n of [
      "0001_create_profiles.sql",
      "0002_create_tutor_cvs.sql",
      "0003_create_marketplace_listings.sql",
      "0004_create_sessions_and_bookings.sql",
      "0005_create_booking_session_rpcs.sql",
      "0006_create_event_outbox.sql",
      "0007_emit_domain_events_from_booking_session_rpcs.sql",
      "20260815150540_tutor_authorization_hardening.sql",
      "20260819120000_shared_booking_engine.sql",
      "20260820100000_workshop_booking_v1_schema.sql",
      "20260820100001_workshop_booking_v1_rpcs.sql",
      "20260820100002_fix_booking_read_json_workshop.sql",
      "20260820120000_host_authorization_consistency.sql",
      "20260820130000_alpha_contract_cleanup.sql",
      "20260831130000_drop_7arg_create_booking_overload.sql",
      "20260831180000_fix_create_booking_flat_pricing_columns.sql",
      "20260904120000_messaging_alpha_v1.sql",
      "20260905000040_production_fixes.sql",
      "20260906000001_follows_schema.sql",
      "20260906000002_follow_rpcs.sql",
      "20260907000010_fix_follow_rpc_grants.sql",
      "20260907000010_session_published_self_notification.sql",
      "20260908000000_url_validation_hardening.sql",
      "20260908000001_public_capacity_hardening.sql",
      "20260908000002_split_rls_policies.sql",
      "20260908000003_system_actor_uuid.sql",
      "20260908000004_follow_by_user_id.sql",
        "20260909000000_messaging_alpha_v2.sql",
        "20260909000010_fix_message_notification_trigger.sql",
      ]) {
      const m = await readFile(fileURLToPath(new URL(`../supabase/migrations/${n}`, import.meta.url)), "utf8");
      await sql.unsafe(m);
    }
    await sql`drop function if exists public.create_booking(uuid, integer)`;
  });
  afterAll(async () => {
    if (sql) await sql.end();
  });

  it("A blocks B → B cannot message A", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner);
    const conv = await getOrCreateConversationId(learner, bookingId);
    // Baseline: learner can message tutor
    const ok = await sendAs(learner, conv, "Pre-block hello", "pre");
    expect(ok.error).toBeNull();
    // Learner blocks tutor
    const block = await learner.client.rpc("block_user", { p_target_user_id: tutor.user.id });
    expect(block.error).toBeNull();
    // Tutor (B) tries to message A (learner). Should be rejected with BLOCKED 42501.
    const blocked = await sendAs(tutor, conv, "After-block from tutor", "post");
    expect(blocked.error).not.toBeNull();
    expect(blocked.error!.code).toBe("42501");
    expect(blocked.error!.message).toContain("BLOCKED");
  });

  it("B blocks A → A cannot message B", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner);
    const conv = await getOrCreateConversationId(learner, bookingId);
    const ok = await sendAs(learner, conv, "Pre-block from learner", "pre");
    expect(ok.error).toBeNull();
    // Tutor (B) blocks learner (A)
    const block = await tutor.client.rpc("block_user", { p_target_user_id: learner.user.id });
    expect(block.error).toBeNull();
    // Learner (A) tries to message tutor (B). Should be rejected with BLOCKED 42501.
    const blocked = await sendAs(learner, conv, "After-block from learner", "post");
    expect(blocked.error).not.toBeNull();
    expect(blocked.error!.code).toBe("42501");
    expect(blocked.error!.message).toContain("BLOCKED");
  });

  it("A unblocks B → messaging works again", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner);
    const conv = await getOrCreateConversationId(learner, bookingId);
    // Block + verify blocked
    await learner.client.rpc("block_user", { p_target_user_id: tutor.user.id });
    const blocked = await sendAs(learner, conv, "Should be blocked", "block");
    expect(blocked.error).not.toBeNull();
    expect(blocked.error!.code).toBe("42501");
    // Unblock
    const unblock = await learner.client.rpc("unblock_user", { p_target_user_id: tutor.user.id });
    expect(unblock.error).toBeNull();
    // Now sending works
    const ok = await sendAs(learner, conv, "After unblock hello", "unblock");
    expect(ok.error).toBeNull();
  });

  it("existing conversation remains intact after a block (read stays; new sends rejected)", async () => {
    const tutor = await signup("tutor");
    const learner = await signup("student");
    const { bookingId } = await createConfirmedBooking(tutor, learner);
    const conv = await getOrCreateConversationId(learner, bookingId);
    // Two messages exchanged
    const m1 = await sendAs(learner, conv, "First message", "first");
    const m2 = await sendAs(tutor, conv, "Reply", "reply");
    expect(m1.error).toBeNull();
    expect(m2.error).toBeNull();
    // Learner blocks tutor
    await learner.client.rpc("block_user", { p_target_user_id: tutor.user.id });
    // Existing messages still readable by both sides
    const list = await tutor.client.rpc("list_conversation_messages", { cid: conv, p_limit: 200 });
    expect(list.error).toBeNull();
    const messages = (list.data as Array<{ id: string }>) ?? [];
    expect(messages.length).toBeGreaterThanOrEqual(2);
    // Symmetric block: BOTH sides are blocked from sending after either
    // blocks. This is the policy implied by the requirement: "If sender
    // has blocked recipient → reject" and "If recipient has blocked
    // sender → reject". The cleanest interpretation: any send between a
    // pair where a block row exists is rejected. The data is preserved
    // (read stays), but no new messages flow.
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
    const { bookingId } = await createConfirmedBooking(tutor, learner);
    const conv = await getOrCreateConversationId(learner, bookingId);
    // Try inserting directly into public.messages bypassing the RPC. RLS must
    // still hold the line: the blocer has user_id != auth.uid(), so the
    // messages_member_read policy will not let them see it, but the FOR
    // INSERT with_check requires sender_id = auth.uid() so a direct INSERT
    // via the publishable key as the blocked user is also denied.
    await learner.client.rpc("block_user", { p_target_user_id: tutor.user.id });
    // Service-role can INSERT (admin scenarios). The point is: an authenticated
    // client cannot bypass the RPC and write a message via the public surface.
    const tutorClient = tutor.client;
    const directInsert = await tutorClient.from("messages").insert({
      conversation_id: conv,
      sender_id: tutor.user.id,
      body: "Direct insert bypassing RPC",
      client_message_id: `cmsg-direct-${randomUUID()}`,
    });
    // RLS denies the insert because the conversation_members policy blocks
    // the blocker from reading/writing into the conversation once the other
    // party has blocked them. The error is generic 42501.
    expect(directInsert.error).not.toBeNull();
    expect(directInsert.error!.code).toBe("42501");
    // The RPC path also returns 42501 with the explicit BLOCKED message.
    const rpcSend = await sendAs(tutor, conv, "Via RPC", "rpc");
    expect(rpcSend.error).not.toBeNull();
    expect(rpcSend.error!.code).toBe("42501");
    expect(rpcSend.error!.message).toContain("BLOCKED");
  });
});
