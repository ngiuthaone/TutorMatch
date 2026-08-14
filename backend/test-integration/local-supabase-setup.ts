import { createHmac } from "node:crypto";

// Supabase CLI can print a legacy anon token that is stale after a local reset.
// The repository pins the local JWT secret in supabase/config.toml; generate the
// low-privilege fixture token that PostgREST can actually verify.
if (process.env.SUPABASE_TEST_URL && ["localhost", "127.0.0.1"].includes(new URL(process.env.SUPABASE_TEST_URL).hostname)) {
  const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const payload = base64url({ iss: "supabase-demo", role: "anon", exp: Math.floor(Date.now() / 1000) + 3600 });
  const unsigned = `${header}.${payload}`;
  const signature = createHmac("sha256", process.env.SUPABASE_TEST_JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long").update(unsigned).digest("base64url");
  process.env.SUPABASE_TEST_PUBLISHABLE_KEY = `${unsigned}.${signature}`;
}
