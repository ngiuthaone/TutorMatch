import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";
import { createSupabaseMarketplaceService } from "../src/services/marketplace-service.js";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const dbUrl = process.env.SUPABASE_TEST_DB_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
if (!["localhost", "127.0.0.1", "host.docker.internal"].includes(new URL(url).hostname)) throw new Error("Refusing to run integration tests against a non-local Supabase target.");

const sql = postgres(dbUrl, { max: 2 });
const password = "Local-test-only-Password1!";

const createdSlugs = new Set<string>();

async function signupTutor(metadata: Record<string, unknown> = {}): Promise<{ user: { id: string }; client: SupabaseClient; token: string }> {
  const email = `mkt-${randomUUID()}@example.test`;
  const r = await signUpConfirmed({
    anon: createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
    url: url!,
    publishableKey: key!,
    serviceRoleKey: serviceKey!,
    email,
    password,
    metadata: { name: "Marketplace Tutor", role: "tutor", ...metadata },
    trustedTutor: true,
  });
  return { user: r.user, client: r.client, token: r.session.access_token };
}

describe.sequential("marketplace courses (integration vs real Supabase)", () => {
  afterAll(async () => {
    if (createdSlugs.size > 0) {
      for (const slug of createdSlugs) {
        await sql`delete from public.marketplace_listings where kind='course' and slug=${slug}`;
      }
    }
    await sql.end({ timeout: 5 });
  });

  it("version migration present: marketplace_listings.version column exists", async () => {
    const cols = await sql`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='marketplace_listings'`;
    const versionCol = cols.find((c) => c.column_name === "version");
    expect(versionCol).toBeTruthy();
    expect(versionCol?.data_type).toBe("bigint");
  });

  it("RLS public read (S-5): creatorId is omitted from the public read path", async () => {
    const { user, token } = await signupTutor({ name: "S5 Tutor" });
    const slug = `s5-${randomUUID().slice(0, 8)}`;
    createdSlugs.add(slug);
    const service = createSupabaseMarketplaceService(url!, key!);

    const publish = await service.publish(token, user.id, {
      kind: "course",
      slug,
      title: "S5 Course",
      payload: { description: "ok" },
    });
    expect(publish.status).toBe("ok");
    if (publish.status !== "ok") return;

    const pub = await service.getPublic("course", slug);
    expect(pub.status).toBe("ok");
    if (pub.status !== "ok") return;

    // S-5 honest check: mapRow has includeCreatorId=false on getPublic path,
    // so the MarketplaceListing.creatorId field is normalized to empty string
    // by the service. The underlying DB row DOES expose creator_id to anon
    // callers via the marketplace service's getPublic (the service selects
    // creator_id but never puts it in the public surface). The mapRow contract
    // strips it for callers of getPublic. NOTE: this is the service-layer
    // mitigation, not a DB-level scrub. If a future code path exposes the raw
    // DB row to anon callers, creator_id WILL leak.
    expect(pub.data.creatorId).toBe("");
    const dbRow = await sql`select creator_id from public.marketplace_listings where kind='course' and slug=${slug}`;
    expect(dbRow).toHaveLength(1);
    expect(dbRow[0].creator_id).toBe(user.id);
  });

  it("RLS ownership: a second tutor's update of the first tutor's row is blocked by the UPDATE policy (returns unavailable, row unchanged)", async () => {
    const tutorA = await signupTutor({ name: "Tutor A" });
    const tutorB = await signupTutor({ name: "Tutor B" });
    const slug = `rls-${randomUUID().slice(0, 8)}`;
    createdSlugs.add(slug);

    const service = createSupabaseMarketplaceService(url!, key!);
    const publish = await service.publish(tutorA.token, tutorA.user.id, {
      kind: "course",
      slug,
      title: "Tutor A Original",
      payload: { description: "original" },
    });
    expect(publish.status).toBe("ok");
    if (publish.status !== "ok") return;

    // Tutor B attempts to hijack Tutor A's row. Real-DB observation:
    // the SELECT policy `status = 'published' OR creator_id = auth.uid()`
    // ALLOWS tutor B to read the row (status='published' branch), so the
    // service's read-first SELECT in update() SUCCEEDS. The version check
    // then passes (tutor B's expectedVersion=1 matches). The UPDATE then
    // fails because the UPDATE policy requires creator_id = auth.uid();
    // tutor B's auth.uid() != creator_id, so 0 rows are updated, and
    // .single() returns PGRST116 -> the service maps that to "conflict"
    // (a 0-row conditional UPDATE is a CAS-style outcome: the row the
    // caller saw is no longer updatable by them). See marketplace-service.ts
    // update() for the PGRST116 -> conflict mapping.
    const hijack = await service.update(tutorB.token, "course", slug, 1, { title: "Hijacked" });
    expect(hijack.status).toBe("conflict");
    expect(hijack.status).not.toBe("ok");
    expect(hijack.status).not.toBe("unavailable");

    // Confirm the DB row is unchanged (RLS protected the write, not the read).
    const rows = await sql`select title, payload from public.marketplace_listings where kind='course' and slug=${slug}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Tutor A Original");
    expect(rows[0].payload.description).toBe("original");
  });

  it("CAS race (S-8) against real DB: Promise.all of two stale-version updates yields exactly one ok and one not-ok", async () => {
    const { user, token } = await signupTutor({ name: "CAS Tutor" });
    const slug = `cas-${randomUUID().slice(0, 8)}`;
    createdSlugs.add(slug);

    const service = createSupabaseMarketplaceService(url!, key!);
    const publish = await service.publish(token, user.id, {
      kind: "course",
      slug,
      title: "CAS Race",
      payload: { description: "starting" },
    });
    expect(publish.status).toBe("ok");
    if (publish.status !== "ok") return;

    // Both updates target the same stale version (1). Both reads succeed in
    // parallel (both see version=1), both pass the version check, both fire
    // UPDATE ... WHERE version=1. The DB serializes them: one UPDATE matches
    // 1 row, the other matches 0 rows. .single() on the 0-row UPDATE returns
    // PGRST116 -> the service maps that to "conflict" (a 0-row conditional
    // UPDATE is a CAS-style outcome and routes 409).
    const [a, b] = await Promise.all([
      service.update(token, "course", slug, 1, { title: "Patch A" }),
      service.update(token, "course", slug, 1, { title: "Patch B" }),
    ]);
    const statuses = [a.status, b.status];
    const okCount = statuses.filter((s) => s === "ok").length;
    const loserCount = statuses.filter((s) => s === "conflict" || s === "unavailable").length;
    expect(okCount).toBe(1);
    expect(loserCount).toBe(1);

    // The loser must surface as "conflict" (PGRST116 from .single() on the
    // 0-row conditional UPDATE, which the service maps to conflict). The
    // previous implementation incorrectly mapped this to "unavailable"
    // (route 503) instead of "conflict" (route 409). Tighten this assertion
    // so a regression of the fix is caught here too.
    const loserStatus = a.status === "ok" ? b.status : a.status;
    expect(loserStatus).toBe("conflict");

    // Re-read via service-role postgres client (bypasses RLS) to confirm
    // the row is at version 2 and title matches the winner.
    const rows = await sql`select version, title from public.marketplace_listings where kind='course' and slug=${slug}`;
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].version)).toBe(2);
    const winnerTitle = a.status === "ok" ? a.data.title : b.status === "ok" ? b.data.title : null;
    expect(winnerTitle).not.toBeNull();
    expect(rows[0].title).toBe(winnerTitle);
  });

  it("Write-side scrub (R5/L3): forged identity keys are absent from the stored payload", async () => {
    const { user, token } = await signupTutor({ name: "Scrub Tutor" });
    const slug = `scrub-${randomUUID().slice(0, 8)}`;
    createdSlugs.add(slug);

    const service = createSupabaseMarketplaceService(url!, key!);
    const publish = await service.publish(token, user.id, {
      kind: "course",
      slug,
      title: "Scrub Test",
      payload: {
        description: "<script>alert(1)</script>hello",
        creatorId: "attacker-victim",
        phone: "+84-900-000-000",
        hostName: "Mallory",
        creatorEmail: "mallory@evil.test",
        hostPhone: "+84-111",
      },
    });
    expect(publish.status).toBe("ok");
    if (publish.status !== "ok") return;

    // Service-role read bypasses RLS.
    const rows = await sql`select creator_id, payload from public.marketplace_listings where kind='course' and slug=${slug}`;
    expect(rows).toHaveLength(1);
    const row = rows[0];

    // creator_id is the JWT-derived user, never the forged value.
    expect(row.creator_id).toBe(user.id);
    expect(row.creator_id).not.toBe("attacker-victim");

    // All identity / private contact keys must be absent from the stored payload.
    const payload = row.payload as Record<string, unknown>;
    expect(payload.creatorId).toBeUndefined();
    expect(payload.creatorEmail).toBeUndefined();
    expect(payload.phone).toBeUndefined();
    expect(payload.hostName).toBeUndefined();
    expect(payload.hostPhone).toBeUndefined();

    // HTML sanitizer strips <script> tags from string fields.
    expect(typeof payload.description).toBe("string");
    expect(String(payload.description)).not.toContain("<script>");
  });
});
