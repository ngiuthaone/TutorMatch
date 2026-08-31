import { randomUUID } from "node:crypto";
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
const JWT_SECRET = process.env.SUPABASE_TEST_JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long";

const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const { createHmac } = await import("node:crypto");
function mintAuthToken(userId: string, email: string): string {
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url({ iss: "supabase-demo", sub: userId, role: "authenticated", email, exp: now + 3600 });
  const unsigned = `${header}.${payload}`;
  const signature = createHmac("sha256", JWT_SECRET).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

async function signup(metadata: Record<string, unknown> = {}): Promise<{ user: { id: string }; client: SupabaseClient; token: string }> {
  const email = `evtl-${randomUUID()}@example.test`;
  const r = await signUpConfirmed({ anon, url: url!, publishableKey: key!, serviceRoleKey: serviceKey!, email, password, metadata });
  return { user: r.user, client: r.client, token: r.session.access_token };
}

function discoverConfig(title: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title,
    subtitle: "A hands-on tasting workshop",
    description: "Learn to brew traditional Vietnamese coffee.",
    sessions: [{ title: "Session one", start: "2026-10-01T09:00:00Z" }],
    plan: ["Welcome", "Brewing", "Tasting"],
    galleryImage: "data:image/png;base64,AAAA",
    coverImage: "data:image/png;base64,BBBB",
    host: "Spoofed Client Host",
    hostRole: "Spoofed Role",
    phone: "0000000000",
    creatorEmail: "spoof@evil.test",
    ...over,
  };
}

describe.sequential("events public browse listing (additive migration)", () => {
  beforeAll(async () => {
    const listMigration = await readFile(fileURLToPath(new URL("../supabase/migrations/20260830100000_events_public_list.sql", import.meta.url)), "utf8");
    await sql.unsafe(listMigration);
    const stripMigration = await readFile(fileURLToPath(new URL("../supabase/migrations/20260901000000_event_public_read_strip_list.sql", import.meta.url)), "utf8");
    await sql.unsafe(stripMigration);
    // The function is created at runtime, so ask PostgREST to refresh its schema cache.
    await sql.unsafe("notify pgrst, 'reload schema';");
  });

  it("L1/L4: only published events are listed, newest first, with identity keys scrubbed", async () => {
    const { user, client } = await signup({ name: "List Host", role: "student" });
    const pubSlug = `list-pub-${randomUUID().slice(0, 8)}`;
    const draftSlug = `list-draft-${randomUUID().slice(0, 8)}`;

    await client.rpc("create_tutoria_event", { p_requested_slug: pubSlug, p_title: "Listed Coffee Event", p_config: discoverConfig("Listed Coffee Event", { phone: "0000000000", creatorEmail: "spoof@evil.test" }), p_publish: true });
    await client.rpc("create_tutoria_event", { p_requested_slug: draftSlug, p_title: "Draft Coffee Event", p_config: discoverConfig("Draft Coffee Event"), p_publish: false });

    const { data, error } = await anon.rpc("list_public_events");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    const items = (data as Array<Record<string, unknown>>) ?? [];
    const found = items.find((i: any) => i.slug === pubSlug);
    expect(found).toBeTruthy();
    // Drafts are never listed.
    expect(items.find((i: any) => i.slug === draftSlug)).toBeUndefined();

    // Newest published first.
    const listed = items.map((i: any) => i.published_at);
    const sorted = [...listed].sort((a, b) => String(b).localeCompare(String(a)));
    expect(listed).toEqual(sorted);

    // Public card fields present.
    expect(found?.title).toBe("Listed Coffee Event");
    // No identity / private contact leakage (L3).
    const json = JSON.stringify(items);
    expect(json).not.toContain(user.id);
    expect(json).not.toContain("spoof@evil.test");
    expect(json).not.toContain("0000000000");
  });

  it("service.listPublicEvents returns ok with public cards and no identity keys", async () => {
    const { token } = await signup({ name: "Svc Host", role: "student" });
    const service = createSupabaseEventPublicationService(url!, key!, createSupabaseAuthService(url!, key!));
    const slug = `svc-list-${randomUUID().slice(0, 8)}`;
    const publish = await service.publishEvent(
      token,
      { requestedSlug: slug, title: "Svc Listed Event", config: discoverConfig("Svc Listed Event", { creatorEmail: "svc@evil.test", phone: "9999999999" }), publish: true },
      { userId: "", email: null },
    );
    expect(publish.status).toBe("ok");
    if (publish.status !== "ok") return;

    const result = await service.listPublicEvents();
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const item = result.data.events.find((e) => e.slug === slug);
    expect(item).toBeTruthy();
    expect(item?.title).toBe("Svc Listed Event");
    const json = JSON.stringify(result.data.events);
    expect(json).not.toContain("svc@evil.test");
    expect(json).not.toContain("9999999999");
    expect(json).not.toContain("creatorEmail");
  });
});
