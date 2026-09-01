import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const dbUrl = process.env.SUPABASE_TEST_DB_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
const target = new URL(url);
if (!["localhost", "127.0.0.1", "host.docker.internal"].includes(target.hostname)) throw new Error("Refusing to run integration tests against a non-local Supabase target.");

const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 1 });
const password = "Local-test-only-Password1!";
async function signup(role?: string, name = "Integration User") {
  const email = `integration-${randomUUID()}@example.test`;
  return signUpConfirmed({ anon, url: url!, publishableKey: key!, serviceRoleKey: serviceKey!, email, password, metadata: { name, ...(role === undefined ? {} : { role }) } });
}

describe.sequential("local profiles RLS", () => {
  beforeAll(async () => {
    const migration = await readFile(fileURLToPath(new URL("../supabase/migrations/0001_create_profiles.sql", import.meta.url)), "utf8");
    const hardening = await readFile(fileURLToPath(new URL("../supabase/migrations/20260815150540_tutor_authorization_hardening.sql", import.meta.url)), "utf8");
    await sql.unsafe(migration); await sql.unsafe(migration); await sql.unsafe(hardening);
  });
  it("blocks anonymous reads", async () => { const { data, error } = await anon.from("profiles").select("id"); expect(error).toBeTruthy(); expect(data).toBeNull(); });
  it.each([["student", "student"], ["tutor", "student"], ["admin", "student"], ["unknown", "student"], [undefined, "student"]] as const)("maps signup role %s to %s", async (input, expected) => { const { user, client } = await signup(input); const { data } = await client.from("profiles").select("id,role").eq("id", user.id).single(); expect(data).toEqual({ id: user.id, role: expected }); });
  it("uses a capped fallback name", async () => { const { user, client } = await signup("student", " "); const { data } = await client.from("profiles").select("name").eq("id", user.id).single(); expect(data?.name).toBeTruthy(); expect(data!.name.length).toBeLessThanOrEqual(120); });
  it("allows only the owner row and denies all mutations", async () => {
    const a = await signup("student", "A"), b = await signup("student", "B");
    const { data } = await a.client.from("profiles").select("id"); expect(data).toEqual([{ id: a.user.id }]); expect(data?.some((row) => row.id === b.user.id)).toBe(false);
    const attempts = [a.client.from("profiles").insert({ id: randomUUID(), role: "student", name: "X" }), a.client.from("profiles").update({ role: "admin" }).eq("id", a.user.id), a.client.from("profiles").delete().eq("id", a.user.id)];
    for (const attempt of attempts) expect((await attempt).error).toBeTruthy();
  });
  it("cascades profile deletion with the auth user", async () => { const { user } = await signup(); await sql`delete from auth.users where id = ${user.id}`; const rows = await sql`select id from public.profiles where id = ${user.id}`; expect(rows).toHaveLength(0); });
});

afterAll(() => sql.end());
