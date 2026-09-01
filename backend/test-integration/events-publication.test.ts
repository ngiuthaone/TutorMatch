import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";
import { createSupabaseAuthService } from "../src/lib/supabase.js";
import { createSupabaseEventPublicationService } from "../src/services/event-publication-service.js";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const dbUrl = process.env.SUPABASE_TEST_DB_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
if (!["localhost", "127.0.0.1", "host.docker.internal"].includes(new URL(url).hostname)) throw new Error("Refusing to run integration tests against a non-local Supabase target.");

const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 2 });
const password = "Local-test-only-Password1!";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Mirrors the pinned local JWT secret in backend/supabase/config.toml.
const JWT_SECRET = process.env.SUPABASE_TEST_JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long";

const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** Mint a valid authenticated JWT for a given user (used to drive RPCs where a natural session cannot be produced, e.g. unconfirmed users). */
function mintAuthToken(userId: string, email: string): string {
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url({ iss: "supabase-demo", sub: userId, role: "authenticated", email, exp: now + 3600 });
  const unsigned = `${header}.${payload}`;
  const signature = createHmac("sha256", JWT_SECRET).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

async function signup(metadata: Record<string, unknown> = {}): Promise<{ user: { id: string }; client: SupabaseClient; token: string }> {
  const email = `evt-${randomUUID()}@example.test`;
  const r = await signUpConfirmed({ anon, url: url!, publishableKey: key!, serviceRoleKey: serviceKey!, email, password, metadata });
  return { user: r.user, client: r.client, token: r.session.access_token };
}

function discoverConfig(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "Intro to Vietnamese Coffee",
    subtitle: "A hands-on tasting workshop",
    description: "Learn to brew traditional Vietnamese coffee.",
    sessions: [{ title: "Session one", start: "2026-10-01T09:00:00Z" }],
    plan: ["Welcome", "Brewing", "Tasting"],
    galleryImage: "data:image/png;base64,AAAA",
    coverImage: "data:image/png;base64,BBBB",
    hostName: "Spoofed Client Host",
    hostRole: "Spoofed Role",
    ...over,
  };
}

/** Column-level snapshot of aggregate counts (schema-independent; avoids table-GRANT assumptions). */
async function systemCounts() {
  const c = async (table: string) => (await sql`select count(*)::int as c from public.${sql(table)}`)[0].c;
  return {
    sessions: await c("sessions"),
    bookings: await c("bookings"),
    payments: await c("payments"),
    refunds: await c("refunds"),
    attendanceFacts: await c("attendance_facts"),
    reschedules: await c("reschedule_requests"),
  };
}

describe.sequential("local events publication (additive migration)", () => {
  beforeAll(async () => {
    // Idempotent (create or replace) re-apply of the additive slices on the
    // already-migrated local DB, following the repo integration convention.
    const publication = await readFile(fileURLToPath(new URL("../supabase/migrations/20260829100000_events_publication.sql", import.meta.url)), "utf8");
    await sql.unsafe(publication);
    const stripIdentity = await readFile(fileURLToPath(new URL("../supabase/migrations/20260901000000_event_public_read_strip_list.sql", import.meta.url)), "utf8");
    await sql.unsafe(stripIdentity);
  });

  it("A3 + P1 + P2: verified user publishes; rows committed + config retained; readable after round trip", async () => {
    const { user, client } = await signup({ name: "Event Host One", role: "student" });
    const slug = `coffee-${randomUUID().slice(0, 8)}`;
    const { data, error } = await client.rpc("create_tutoria_event", {
      p_requested_slug: slug,
      p_title: "Intro to Vietnamese Coffee",
      p_config: discoverConfig(),
      p_publish: true,
    });
    expect(error).toBeNull();
    expect(data.publication_status).toBe("published");
    expect(data.slug).toBe(slug);
    expect(Number(data.version)).toBe(2);

    // Direct postgres client (service role has no SELECT on offerings by design).
    const rows = await sql`select id,slug,title,creator_id,publication_status,version,config from public.offerings where kind='event' and slug=${slug}`;
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.creator_id).toBe(user.id);
    expect(row.publication_status).toBe("published");
    expect(Number(row.version)).toBe(2);
    expect(row.config.title).toBe("Intro to Vietnamese Coffee");
    expect(row.config.subtitle).toBe("A hands-on tasting workshop");
    expect(row.config.sessions).toHaveLength(1);
    expect(row.config.plan).toEqual(["Welcome", "Brewing", "Tasting"]);
    expect(row.config.galleryImage).toBe("data:image/png;base64,AAAA");

    // Round trip: separate anonymous read by slug returns the same published event.
    const pub = (await anon.rpc("get_public_event_by_slug", { p_slug: slug })).data;
    expect(pub).not.toBeNull();
    expect(pub.slug).toBe(slug);
    expect(pub.title).toBe("Intro to Vietnamese Coffee");
    expect(pub.config.sessions).toHaveLength(1);
  });

  it("A4: unconfirmed user is rejected by the verified gate and no row is persisted", async () => {
    const email = `evt-unconf-${randomUUID()}@example.test`;
    const { data: sdu } = await anon.auth.signUp({ email, password, options: { data: { name: "Unconfirmed", role: "student" } } });
    if (!sdu.user) throw new Error("Expected local signup to return a user");

    const token = mintAuthToken(sdu.user.id, email);
    const asUnconfirmed = createClient(url, key!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const slug = `blocked-${randomUUID().slice(0, 8)}`;
    const { error } = await asUnconfirmed.rpc("create_tutoria_event", {
      p_requested_slug: slug,
      p_title: "Blocked Event",
      p_config: discoverConfig(),
      p_publish: true,
    });
    expect(error).toBeTruthy();
    expect(String(error?.message ?? "")).toMatch(/EMAIL_VERIFICATION_REQUIRED/i);

    const rows = await sql`select id from public.offerings where kind='event' and slug=${slug}`;
    expect(rows).toHaveLength(0);
  });

  it("P4/S1: duplicate slug suffixs deterministically; single row; stored slug satisfies DB CHECK", async () => {
    const { user, client } = await signup({ name: "Event Host Two", role: "student" });
    const base = `dup-${randomUUID().slice(0, 8)}`;
    const title = "Duplicate Title";
    const config = discoverConfig();
    const first = (await client.rpc("create_tutoria_event", { p_requested_slug: base, p_title: title, p_config: config, p_publish: false })).data;
    const second = (await client.rpc("create_tutoria_event", { p_requested_slug: base, p_title: title, p_config: config, p_publish: false })).data;
    expect(first.slug).toBe(base);
    expect(second.slug).toBe(`${base}-2`);
    expect(second.slug).not.toBe(first.slug);
    expect(second.slug).toMatch(SLUG_RE);

    const rows = await sql`select slug from public.offerings where kind='event' and creator_id=${user.id} order by slug`;
    const slugs = rows.map((r) => r.slug);
    expect(slugs).toContain(base);
    expect(slugs).toContain(`${base}-2`);
    for (const s of slugs) expect(s).toMatch(SLUG_RE);
  });

  it("S1/S3: client slug is a request; backend normalizes (uppercase->lowercase) and returns the stored slug", async () => {
    const { token } = await signup({ name: "Event Host Slug", role: "student" });
    const svc = createSupabaseEventPublicationService(url!, key!, createSupabaseAuthService(url!, key!));
    const requested = `My_Workshop_${randomUUID().slice(0, 6)}`;
    const expected = requested.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const { status, data } = await svc.publishEvent(
      token,
      { requestedSlug: requested, title: "Normalize Me", config: discoverConfig(), publish: false },
      { userId: "", email: null },
    );
    expect(status).toBe("ok");
    if (status !== "ok") return;
    expect(data.slug).toMatch(SLUG_RE);
    expect(data.slug).toBe(expected);

    const rows = await sql`select slug from public.offerings where kind='event' and slug=${data.slug}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe(data.slug);
  });

  it("P5/R7: fresh-event publish CAS leaves version 2 and an owner capability row", async () => {
    const { user, client } = await signup({ name: "Event Host CAS", role: "student" });
    const slug = `cas-${randomUUID().slice(0, 8)}`;
    const { data } = await client.rpc("create_tutoria_event", {
      p_requested_slug: slug,
      p_title: "CAS Event",
      p_config: discoverConfig(),
      p_publish: true,
    });
    expect(Number(data.version)).toBe(2);
    expect(data.publication_status).toBe("published");

    const owner = await sql`select offering_id,user_id,capability from public.offering_hosts where offering_id=${data.id} and user_id=${user.id}`;
    expect(owner).toHaveLength(1);
    expect(owner[0].capability).toBe("host");

    const rows = await sql`select publication_status,version,published_at from public.offerings where id=${data.id}`;
    expect(rows[0].publication_status).toBe("published");
    expect(Number(rows[0].version)).toBe(2);
    expect(rows[0].published_at).not.toBeNull();
  });

  it("R1/R2/R3/R4 + V1-V3: visibility maps to publish/draft; public read honors published-only", async () => {
    const host = await signup({ name: "Host Pub", role: "student" });

    // V1 Public -> published + readable
    const pubSlug = `pub-${randomUUID().slice(0, 8)}`;
    const pub = (await host.client.rpc("create_tutoria_event", { p_requested_slug: pubSlug, p_title: "Public Event", p_config: discoverConfig(), p_publish: true })).data;
    expect(pub.publication_status).toBe("published");
    expect((await anon.rpc("get_public_event_by_slug", { p_slug: pubSlug })).data).not.toBeNull();

    // V2 Unlisted -> draft + not readable
    const unlistSlug = `unlist-${randomUUID().slice(0, 8)}`;
    const unlist = (await host.client.rpc("create_tutoria_event", { p_requested_slug: unlistSlug, p_title: "Unlisted Event", p_config: discoverConfig(), p_publish: false })).data;
    expect(unlist.publication_status).toBe("draft");
    expect((await anon.rpc("get_public_event_by_slug", { p_slug: unlistSlug })).data).toBeNull();

    // V3 Community only -> draft + not readable
    const commSlug = `comm-${randomUUID().slice(0, 8)}`;
    const comm = (await host.client.rpc("create_tutoria_event", { p_requested_slug: commSlug, p_title: "Community Event", p_config: discoverConfig(), p_publish: false })).data;
    expect(comm.publication_status).toBe("draft");
    expect((await anon.rpc("get_public_event_by_slug", { p_slug: commSlug })).data).toBeNull();

    // R3 unknown slug -> null
    expect((await anon.rpc("get_public_event_by_slug", { p_slug: `nope-${randomUUID().slice(0, 8)}` })).data).toBeNull();

    // R4 owner cannot read own draft publicly
    expect((await anon.rpc("get_public_event_by_slug", { p_slug: unlistSlug })).data).toBeNull();
  });

  it("R5/H1/H4: service path strips auth UUID/email/phone/client creatorId; creatorId spoof ignored", async () => {
    const { user, token } = await signup({ name: "Host Clean", role: "student" });
    const service = createSupabaseEventPublicationService(url!, key!, createSupabaseAuthService(url!, key!));
    const slug = `clean-${randomUUID().slice(0, 8)}`;
    const spoofedUuid = randomUUID();
    const publish = await service.publishEvent(
      token,
      { requestedSlug: slug, title: "Clean Event", config: discoverConfig({ creatorId: spoofedUuid, creatorEmail: "spoof@evil.test", hostEmail: "spoof@evil.test", hostName: "Spoofed", phone: "0000000000", creator: spoofedUuid }), publish: true },
      { userId: user.id, email: "spoof@evil.test" },
    );
    expect(publish.status).toBe("ok");
    if (publish.status !== "ok") return;
    expect(publish.data.slug).toBe(slug);

    // H1/H4: creator_id is the caller, not the spoofed value; the service strips identity + private keys before storing.
    const rows = await sql`select creator_id,config from public.offerings where kind='event' and slug=${slug}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].creator_id).toBe(user.id);
    const cfg = rows[0].config;
    expect(cfg.creatorId).toBeUndefined();
    expect(cfg.creatorEmail).toBeUndefined();
    expect(cfg.hostEmail).toBeUndefined();
    expect(cfg.creator).toBeUndefined();
    expect(cfg.phone).toBeUndefined();
    expect(cfg.hostName).toBeUndefined();
    // Server-derived host identity is present (H2), not the client spoof.
    expect(cfg.host).toBe("Host Clean");
    expect(cfg.creatorName).toBe("Host Clean");
    expect(cfg.hostRole).toBe("Tutoria host and educator");

    // R5: the public read (through the service boundary) exposes no auth UUID, phone, or identity keys.
    const read = await service.getPublicEventBySlug(slug);
    expect(read.status).toBe("ok");
    const body = read.status === "ok" ? read.data : {};
    const json = JSON.stringify(body);
    expect(json).not.toContain(user.id);
    expect(json).not.toContain(spoofedUuid);
    expect(json).not.toContain("spoof@evil.test");
    expect(json).not.toContain("0000000000");
    expect(body.id).toBeUndefined();
    expect(body.creatorId).toBeUndefined();
    expect(body.phone).toBeUndefined();
    expect(body.hostName).toBeUndefined();
    expect(body.hostEmail).toBeUndefined();
  });

  it("R5 (defense-in-depth): get_public_event_by_slug strips phone/contact/host keys even when stored in config", async () => {
    const { client } = await signup({ name: "Host Defensive", role: "student" });
    const slug = `defensive-${randomUUID().slice(0, 8)}`;
    // Publish through the DB RPC directly (bypassing the service sanitizer) so the
    // private contact/host keys actually land in offerings.config. This simulates a
    // future writer / direct RPC call storing them and proves the DB read is the
    // defense-in-depth strip (R5).
    const { data, error } = await client.rpc("create_tutoria_event", {
      p_requested_slug: slug,
      p_title: "Defensive Event",
      p_config: discoverConfig({
        phone: "0900000001",
        phoneNumber: "0900000002",
        contactPhone: "0900000003",
        hostPhone: "0900000004",
        hostName: "Spoofed Host",
        hostNameOverride: "Spoofed Override",
      }),
      p_publish: true,
    });
    expect(error).toBeNull();
    expect(data.publication_status).toBe("published");

    // Prove the sensitive keys are actually stored so the DB-side assertion is meaningful.
    const stored = await sql`select config from public.offerings where kind='event' and slug=${slug}`;
    expect(stored).toHaveLength(1);
    const storedCfg = stored[0].config;
    expect(storedCfg.phone).toBe("0900000001");
    expect(storedCfg.phoneNumber).toBe("0900000002");
    expect(storedCfg.contactPhone).toBe("0900000003");
    expect(storedCfg.hostPhone).toBe("0900000004");
    expect(storedCfg.hostName).toBe("Spoofed Host");
    expect(storedCfg.hostNameOverride).toBe("Spoofed Override");

    // R5: the public read must not leak any stored phone/contact/host keys.
    const pub = (await anon.rpc("get_public_event_by_slug", { p_slug: slug })).data;
    expect(pub).not.toBeNull();
    const cfg = pub.config;
    expect(cfg.phone).toBeUndefined();
    expect(cfg.phoneNumber).toBeUndefined();
    expect(cfg.contactPhone).toBeUndefined();
    expect(cfg.hostPhone).toBeUndefined();
    expect(cfg.hostName).toBeUndefined();
    expect(cfg.hostNameOverride).toBeUndefined();
    const json = JSON.stringify(pub);
    expect(json).not.toContain("0900000001");
    expect(json).not.toContain("0900000002");
    expect(json).not.toContain("0900000003");
    expect(json).not.toContain("0900000004");
  });

  it("OS1-OS3: publish creates no sessions/bookings/attendance/capacity/payment rows", async () => {
    const before = await systemCounts();
    const { client } = await signup({ name: "Host OS", role: "student" });
    const slug = `os-${randomUUID().slice(0, 8)}`;
    const { data } = await client.rpc("create_tutoria_event", {
      p_requested_slug: slug,
      p_title: "OS Event",
      p_config: discoverConfig(),
      p_publish: true,
    });
    expect(data.publication_status).toBe("published");
    const after = await systemCounts();
    expect(after.sessions).toBe(before.sessions);
    expect(after.bookings).toBe(before.bookings);
    expect(after.payments).toBe(before.payments);
    expect(after.refunds).toBe(before.refunds);
    expect(after.attendanceFacts).toBe(before.attendanceFacts);
    expect(after.reschedules).toBe(before.reschedules);
  });
});
