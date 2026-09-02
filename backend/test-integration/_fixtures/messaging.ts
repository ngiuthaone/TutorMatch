// test-integration/_fixtures/messaging.ts
//
// Shared fixtures + helpers for the messaging integration test suite.
// Adapted from tutorstartup's test setup pattern (MIT,
// fd6887b28ee39b51e20b4fbb545a43c18e1f35da). All helpers here are
// re-implementations for Tutoria's booking-anchored messaging model;
// no source code is copied.
//
// Why this exists: prior to this refactor, the inline helpers were
// duplicated across test-integration/messaging-rls-idempotency.test.ts
// and test-integration/messaging-blocking.test.ts, AND each test re-applied
// the full migration chain in beforeAll which caused intermittent
// "already exists" / param-name conflict failures. Centralizing here
// (a) eliminates duplication, (b) keeps the helper re-apply logic in
// one place, (c) makes it possible to share a connection across test
// files via vitest's --isolate=false.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { signUpConfirmed } from "../auth-helpers.js";
import { makeOffering } from "./offering.js";

export const SUPABASE_URL = process.env.SUPABASE_TEST_URL;
export const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
export const SUPABASE_DB_URL = process.env.SUPABASE_TEST_DB_URL;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
export const SUPABASE_JWT_SECRET = process.env.SUPABASE_TEST_JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_DB_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
}
if (!["localhost", "127.0.0.1", "host.docker.internal"].includes(new URL(SUPABASE_URL!).hostname)) {
  throw new Error("Refusing to run integration tests against a non-local Supabase target.");
}

export const DB_PASSWORD = "postgres"; // local Supabase default; override via env if needed

export type Role = "student" | "tutor";
export type Fixture = Awaited<ReturnType<typeof signup>>;

/** Sign up a new user with role, return the user + a JWT-authenticated client. */
export async function signup(role: Role) {
  const email = `messaging-${role}-${crypto.randomUUID()}@example.test`;
  return signUpConfirmed({
    anon: createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
    url: SUPABASE_URL!,
    publishableKey: SUPABASE_PUBLISHABLE_KEY!,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY!,
    email,
    password: "Local-test-only-Password1!",
    metadata: { name: `Messaging ${role}`, role },
    trustedTutor: role === "tutor",
  });
}

/** Create a confirmed booking (offering + session + booking + confirm) using
 *  direct SQL inserts to bypass the create_booking overload ambiguity
 *  that the test re-apply triggers. */
export async function createConfirmedBooking(
  tutor: Fixture,
  learner: Fixture,
  sql: ReturnType<typeof postgres>,
) {
  const offeringId = await makeOffering(tutor.client, tutor.user.id, "workshop", "hourly_v1", { hourlyRateVnd: 200000 });
  const session = await tutor.client.rpc("create_session", {
    payload: {
      offeringId,
      startsAt: new Date(Date.now() + 86400e3).toISOString(),
      endsAt: new Date(Date.now() + 90000e3).toISOString(),
      maxParticipants: 2,
    },
  });
  if (session.error || !session.data) throw session.error ?? new Error("create_session failed");
  const bookingId = await sql<{ id: string }[]>`
    insert into public.bookings (session_id, learner_id, participant_count, status, version)
    values (${session.data.id}, ${learner.user.id}, 1, 'confirmed', 1)
    returning id
  `.then((r) => r[0].id);
  if (!bookingId) throw new Error("bookings insert failed");
  return { bookingId, sessionId: session.data.id, conversationId: null as string | null };
}

/** Resolve or create a booking-anchored conversation via the SECURITY DEFINER RPC. */
export async function getOrCreateConversationId(learner: Fixture, bookingId: string): Promise<string> {
  const conv = await learner.client.rpc("get_or_create_booking_conversation", { p_booking_id: bookingId });
  if (conv.error || !conv.data) throw conv.error ?? new Error("get_or_create_booking_conversation failed");
  return (conv.data as { id: string }).id;
}

/** Send a message via the SECURITY DEFINER send_message RPC. Returns the
 *  full Supabase result so callers can assert on `.error`. */
export function sendAs(c: Fixture, conversationId: string, body: string, suffix: string) {
  return c.client.rpc("send_message", {
    cid: conversationId,
    p_client_message_id: `cmsg-${suffix}-${crypto.randomUUID()}`,
    p_body: body,
  });
}

/** Apply the messaging-relevant migration chain idempotently. Skips on
 *  subsequent runs if the conversations table already exists. Pre-drops
 *  functions that have changed parameter shape so REPLACE FUNCTION
 *  succeeds on re-apply. Pattern adapted from zingle's test setup
 *  (STUDY_ONLY, no license, re-implemented from public behavior). */
export async function applyMessagingMigrations(sql: ReturnType<typeof postgres>) {
  const already = await sql<{ count: string }[]>`
    select count(*)::text as count from information_schema.tables
     where table_schema = 'public' and table_name = 'conversations'
  `;
  if (Number(already[0]?.count ?? "0") > 0) return;
  const migrations = [
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
    "20260908000003_system_actor_uuid.sql",
    "20260908000004_follow_by_user_id.sql",
    "20260909000000_messaging_alpha_v2.sql",
    "20260909000010_fix_message_notification_trigger.sql",
    "20260910000005_message_attachments_bucket.sql",
    "20260910000001_create_message_with_attachments.sql",
  ];
  for (const n of migrations) {
    const m = await readFile(fileURLToPath(new URL(`../supabase/migrations/${n}`, import.meta.url)), "utf8");
    try {
      // Pre-drop functions that have changed parameter shape so REPLACE
      // FUNCTION succeeds on re-apply. Idempotent if absent.
      if (n === "20260820100001_workshop_booking_v1_rpcs.sql") {
        await sql.unsafe(`drop function if exists public.create_offering(uuid, text, text, bigint, bigint, text, text) cascade;`);
        await sql.unsafe(`drop function if exists public.create_offering(text, text, text, bigint, bigint, text, text) cascade;`);
      }
      if (n === "20260909000000_messaging_alpha_v2.sql") {
        await sql.unsafe(`drop function if exists public.notify_new_message() cascade;`);
      }
      await sql.unsafe(m);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("already exists") || msg.includes("does not exist, skipping")) continue;
      throw err;
    }
  }
  await sql`drop function if exists public.create_booking(uuid, integer, text);`;
  await sql`drop function if exists public.create_booking(uuid, integer);`;
}

/** Test "client" type alias — a Supabase client + a user. */
export type SupabaseTestClient = SupabaseClient<unknown, unknown, { Authorization: string }>;
