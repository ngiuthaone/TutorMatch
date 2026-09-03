// LIVE Supabase RLS verification: communities / posts / threads / search.
//
// WRITE test against the LOCAL Docker Supabase stack ONLY. Never touches the
// linked remote project. All security assertions use real JWT-authenticated
// clients through PostgREST (anon/authenticated), never service_role. The
// service_role key is used only for provisioning (signup confirmation) and
// cleanup.
//
// Fixture roles (edge matrix):
//   owner  = creator of the (private) community
//   A      = active member
//   B      = non-member (never joined)
//   C      = banned member (status = 'banned')
//   D      = moderator (role 'moderator', active)
//
// Claims verified:
//   1. Private-community post/thread is NOT exposed to non-member B via the
//      public get RPCs, but IS visible to member A.
//   2. Banned member C cannot create a post/thread/reply; A and D can.
//   3. Moderator D can pin/lock/remove posts and threads; plain member A cannot.
//   4. search_all does not leak a private-community unique token to anonymous
//      or non-member B, but member A finds it.
//   5. Direct table select on posts/reference_threads/community_members is
//      denied at the privilege level (no GRANT to anon/authenticated).

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const dbUrl = process.env.SUPABASE_TEST_DB_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

if (!url || !key || !dbUrl || !serviceKey) {
  throw new Error("Integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
}
if (!["localhost", "127.0.0.1", "host.docker.internal"].includes(new URL(url).hostname)) {
  throw new Error("Refusing to run integration tests against a non-local Supabase target.");
}

// IMPORTANT: `anon` singleton is used ONLY for anonymous RPC calls for which we
// want a pristine no-session client. supabase-js retains an in-memory session on
// a shared client after signInWithPassword even with persistSession:false; a
// stale session would turn "anon" into the last signed-in user and produce false
// leak results. We therefore create a FRESH anonymous client on demand and never
// use it for signup/signin. See `freshAnon()`.
const sql = postgres(dbUrl, { max: 4 });
const password = "Local-test-only-Password1!";

function freshAnon() {
  return createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// Unique token that MUST only appear inside the private community content.
const LEAK_TOKEN = `rls-leak-token-${randomUUID()}`;

type Actor = {
  tag: string;
  email: string;
  user: { id: string };
  client: ReturnType<typeof createClient>;
};

async function signupActor(tag: string): Promise<Actor> {
  const email = `rls-com-${tag}-${randomUUID()}@example.test`;
  const fixture = await signUpConfirmed({
    anon: freshAnon(),
    url: url!,
    publishableKey: key!,
    serviceRoleKey: serviceKey!,
    email,
    password,
    metadata: { name: `RLS ${tag}`, role: "student" },
  });
  return { tag, email, user: fixture.user, client: fixture.client };
}

describe.sequential("LIVE community RLS matrix", () => {
  let owner: Actor;
  let a: Actor; // active member
  let b: Actor; // non-member
  let c: Actor; // banned
  let d: Actor; // moderator

  let communityId: string;
  let privatePostId: string;
  let privateThreadId: string;

  beforeAll(async () => {
    // SCHEMA RESTORATION (fixture-only, not an RLS-semantics change): the
    // original community-schema migration (20260908000010_communities_schema)
    // was deleted/renamed, leaving a minimal stub `communities` table missing
    // the columns the shipped triggers/RPCs reference (`post_count` in
    // sync_community_post_count, `thread_count` in sync_community_thread_count,
    // `member_count`/`archived_at` in read RPCs). Without these the community
    // surface is un-runnable. We restore them idempotently so security claims
    // can be exercised through the real RPC surface. This missing-column schema
    // defect is reported separately.
    await sql.unsafe(`
      alter table public.communities
        add column if not exists archived_at timestamptz,
        add column if not exists member_count integer not null default 0,
        add column if not exists post_count integer not null default 0,
        add column if not exists thread_count integer not null default 0;
    `);

    owner = await signupActor("owner");
    a = await signupActor("A");
    b = await signupActor("B");
    c = await signupActor("C");
    d = await signupActor("D");

    // Owner creates a PRIVATE community.
    const created = await owner.client.rpc("create_community", {
      p_slug: `priv-${randomUUID().slice(0, 8)}`,
      p_name: "Private Verification Community",
      p_description: "Closed community for live RLS verification",
      p_visibility: "private",
      p_join_policy: "open",
    });
    if (created.error) throw new Error(`create_community failed: ${created.error.message}`);
    communityId = created.data.id;

    // A joins (active member).
    const aJoin = await a.client.rpc("join_community", { p_id: communityId });
    if (aJoin.error) throw new Error(`A join failed: ${aJoin.error.message}`);

    // C joins, then owner bans C -> status 'banned'.
    const cJoin = await c.client.rpc("join_community", { p_id: communityId });
    if (cJoin.error) throw new Error(`C join failed: ${cJoin.error.message}`);
    const ban = await owner.client.rpc("ban_member", { p_community_id: communityId, p_user_id: c.user.id, p_reason: "bad actor" });
    if (ban.error) throw new Error(`ban C failed: ${ban.error.message}`);

    // D joins, then owner promotes D to moderator.
    const dJoin = await d.client.rpc("join_community", { p_id: communityId });
    if (dJoin.error) throw new Error(`D join failed: ${dJoin.error.message}`);
    const promote = await owner.client.rpc("promote_member", { p_community_id: communityId, p_user_id: d.user.id, p_role: "moderator" });
    if (promote.error) throw new Error(`promote D failed: ${promote.error.message}`);

    // Sanity-check fixture membership states via the intended read helper.
    const mB = await b.client.rpc("is_community_member", { p_community_id: communityId });
    const mC = await c.client.rpc("is_community_member", { p_community_id: communityId });
    const mD = await d.client.rpc("is_community_member", { p_community_id: communityId });
    if (mB.error || mC.error || mD.error) throw new Error("is_community_member helper errored");
    // Non-member B has no membership row -> status NULL -> is_banned is NULL
    // (falsy), is_member false.
    expect(mB.data?.is_member).toBe(false);
    expect(mB.data?.is_banned).toBeFalsy();
    // Banned C -> is_member false (status banned != active), is_banned true.
    expect(mC.data?.is_member).toBe(false);
    expect(mC.data?.is_banned).toBe(true);
    // Moderator D -> active moderator.
    expect(mD.data?.is_member).toBe(true);
    expect(mD.data?.is_moderator).toBe(true);

    // Owner creates a PRIVATE, community-scoped post and thread.
    const post = await owner.client.rpc("create_post", {
      p_body: `Private community post ${LEAK_TOKEN}`,
      p_tags: ["private"],
      p_community_id: communityId,
    });
    if (post.error) throw new Error(`create_post failed: ${post.error.message}`);
    privatePostId = post.data.id;

    const thread = await owner.client.rpc("create_reference_thread", {
      p_title: `Private community thread ${LEAK_TOKEN}`,
      p_body: "Thread body",
      p_anchor_type: "external_url",
      p_anchor_url: "https://example.com/rls",
      p_visibility: "community",
      p_community_id: communityId,
    });
    if (thread.error) throw new Error(`create_reference_thread failed: ${thread.error.message}`);
    privateThreadId = thread.data.id;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Claim 1 — Read isolation of private community content
  // ──────────────────────────────────────────────────────────────────────────
  it("C1: private post/thread NOT exposed to non-member B via get RPCs; visible to member A", async () => {
    // Non-member B: get_public_post must be filtered (null) for the private post.
    const bGet = await b.client.rpc("get_public_post", { p_id: privatePostId });
    expect(bGet.error).toBeNull();
    expect(bGet.data).toBeNull();

    // Non-member B: get_reference_thread must be filtered (null).
    const bTGet = await b.client.rpc("get_reference_thread", { p_id: privateThreadId });
    expect(bTGet.error).toBeNull();
    expect(bTGet.data).toBeNull();

    // Anonymous: get_public_post / get_reference_thread must be filtered too.
    const anonGet = await freshAnon().rpc("get_public_post", { p_id: privatePostId });
    expect(anonGet.data).toBeNull();
    const anonTGet = await freshAnon().rpc("get_reference_thread", { p_id: privateThreadId });
    expect(anonTGet.data).toBeNull();

    // Member A: must be able to read both.
    const aGet = await a.client.rpc("get_public_post", { p_id: privatePostId });
    expect(aGet.error).toBeNull();
    expect(aGet.data?.id).toBe(privatePostId);
    const aTGet = await a.client.rpc("get_reference_thread", { p_id: privateThreadId });
    expect(aTGet.error).toBeNull();
    expect(aTGet.data?.id).toBe(privateThreadId);
  });

  it("C1b: list_public_posts / list_reference_threads overload ambiguity (documented defect)", async () => {
    // The live schema has BOTH the legacy 5-arg and the security-fixed 6-arg
    // overloads of list_public_posts and list_reference_threads (the old ones
    // were never dropped when 20260908000013 redefined them with p_community_id).
    // PostgREST cannot disambiguate -> PGRST203. This is a real defect: the
    // stale overloads also LACK the community-visibility filter, so any caller
    // that resolves to them (e.g. directly via SQL) could read private content.
    const bList = await b.client.rpc("list_public_posts");
    expect(bList.error).toBeTruthy();
    expect(String(bList.error?.code)).toBe("PGRST203");
    const bTList = await b.client.rpc("list_reference_threads");
    expect(bTList.error).toBeTruthy();
    expect(String(bTList.error?.code)).toBe("PGRST203");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Claim 2 — Banned user cannot post/reply; member A and moderator D can
  // ──────────────────────────────────────────────────────────────────────────
  it("C2: banned member C is rejected creating post/thread/reply; A and D succeed", async () => {
    // Banned C: create_post in community must be rejected.
    const cPost = await c.client.rpc("create_post", { p_body: "spam", p_community_id: communityId });
    expect(cPost.error).toBeTruthy();
    expect(String(cPost.error?.message)).toMatch(/COMMUNITY_ACCESS_DENIED|42501/i);

    // Banned C: create_reference_thread in community must be rejected.
    const cThread = await c.client.rpc("create_reference_thread", {
      p_title: "spam thread",
      p_anchor_type: "external_url",
      p_anchor_url: "https://example.com/x",
      p_visibility: "community",
      p_community_id: communityId,
    });
    expect(cThread.error).toBeTruthy();
    expect(String(cThread.error?.message)).toMatch(/COMMUNITY_ACCESS_DENIED|42501/i);

    // Banned C: reply_to_thread on the private thread must be rejected.
    const cReply = await c.client.rpc("reply_to_thread", { p_thread_id: privateThreadId, p_body: "spam reply" });
    expect(cReply.error).toBeTruthy();
    expect(String(cReply.error?.message)).toMatch(/COMMUNITY_ACCESS_DENIED|42501/i);

    // Member A: create_post in community succeeds.
    const aPost = await a.client.rpc("create_post", { p_body: `member A post ${LEAK_TOKEN}`, p_community_id: communityId });
    expect(aPost.error).toBeNull();
    expect(aPost.data?.status).toBe("published");

    // Moderator D: reply to the private thread succeeds.
    const dReply = await d.client.rpc("reply_to_thread", { p_thread_id: privateThreadId, p_body: "moderator reply" });
    expect(dReply.error).toBeNull();
    expect(dReply.data?.status).toBe("published");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Claim 3 — Moderator can pin/lock/remove; plain member cannot
  // ──────────────────────────────────────────────────────────────────────────
  it("C3: moderator D pin/lock/remove succeed on post+thread; member A is rejected", async () => {
    // Moderator D succeeds.
    const pin = await d.client.rpc("pin_post", { p_post_id: privatePostId });
    expect(pin.error).toBeNull();
    expect(pin.data?.is_pinned).toBe(true);
    const lock = await d.client.rpc("lock_post", { p_post_id: privatePostId });
    expect(lock.error).toBeNull();
    expect(lock.data?.is_locked).toBe(true);
    expect((await d.client.rpc("unlock_post", { p_post_id: privatePostId })).error).toBeNull();

    const tPin = await d.client.rpc("pin_thread", { p_thread_id: privateThreadId });
    expect(tPin.error).toBeNull();
    expect(tPin.data?.is_pinned).toBe(true);
    const tLock = await d.client.rpc("lock_thread", { p_thread_id: privateThreadId });
    expect(tLock.error).toBeNull();
    expect(tLock.data?.status).toBe("closed");
    expect((await d.client.rpc("unlock_thread", { p_thread_id: privateThreadId })).error).toBeNull();

    // Plain member A is rejected for all moderation actions (authoritative gate
    // is the SECURITY DEFINER RPC's own role check, not the RLS policy).
    const aPin = await a.client.rpc("pin_post", { p_post_id: privatePostId });
    expect(aPin.error).toBeTruthy();
    expect(String(aPin.error?.message)).toMatch(/FORBIDDEN|42501/i);
    const aLock = await a.client.rpc("lock_post", { p_post_id: privatePostId });
    expect(aLock.error).toBeTruthy();
    expect(String(aLock.error?.message)).toMatch(/FORBIDDEN|42501/i);
    const aRemove = await a.client.rpc("remove_post", { p_post_id: privatePostId });
    expect(aRemove.error).toBeTruthy();
    expect(String(aRemove.error?.message)).toMatch(/FORBIDDEN|42501/i);
    const aTRemove = await a.client.rpc("remove_thread", { p_thread_id: privateThreadId });
    expect(aTRemove.error).toBeTruthy();
    expect(String(aTRemove.error?.message)).toMatch(/FORBIDDEN|42501/i);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Claim 4 — Search does NOT leak private content
  // ──────────────────────────────────────────────────────────────────────────
  it("C4: search_all hides the unique token from anonymous and non-member B; member A finds it", async () => {
    // True anonymous (fresh client that was never signed in -> auth.uid() null).
    const anonSearch = await freshAnon().rpc("search_all", { p_query: LEAK_TOKEN });
    expect(anonSearch.error).toBeNull();
    expect(JSON.stringify(anonSearch.data).includes(LEAK_TOKEN)).toBe(false);

    // Non-member B: token must NOT appear.
    const bSearch = await b.client.rpc("search_all", { p_query: LEAK_TOKEN });
    expect(bSearch.error).toBeNull();
    expect(JSON.stringify(bSearch.data).includes(LEAK_TOKEN)).toBe(false);

    // Member A: token MUST appear.
    const aSearch = await a.client.rpc("search_all", { p_query: LEAK_TOKEN });
    expect(aSearch.error).toBeNull();
    expect(JSON.stringify(aSearch.data).includes(LEAK_TOKEN)).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Claim 5 — Table-level RLS / privilege state
  // ──────────────────────────────────────────────────────────────────────────
  it("C5: direct table select on posts/reference_threads/community_members is denied", async () => {
    // There is no GRANT SELECT to anon/authenticated on these tables (only
    // TRUNCATE/REFERENCES/TRIGGER), so direct PostgREST table access is denied
    // at the privilege layer (42501 permission denied) — even though
    // security-definer RPCs (which bypass privileges) still work. This is the
    // "locked down at the table level" intent: users can only reach data via
    // the authorized RPC surface.
    // NOTE: community_members has a composite PK (community_id, user_id) and no
    // `id` column, so we select on community_id there.
    const cases: Array<{ table: string; col: string }> = [
      { table: "posts", col: "id" },
      { table: "reference_threads", col: "id" },
      { table: "community_members", col: "community_id" },
    ];
    for (const { table, col } of cases) {
      for (const who of [b.client, freshAnon()]) {
        const r = await who.from(table).select(col).limit(10);
        expect(r.error, `${table} should be denied for direct select`).toBeTruthy();
        expect(String(r.error?.code), `${table} direct select`).toBe("42501");
      }
    }
  });
});

afterAll(async () => {
  await sql`delete from public.posts where body like ${`%${LEAK_TOKEN}%`}`;
  await sql`delete from public.reference_threads where title like ${`%${LEAK_TOKEN}%`}`;
  await sql.end();
});
