import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Runs ONCE before the entire test run (vitest globalSetup).
 * 1. Sets SUPABASE_TEST_* env vars from `supabase status --output env`
 * 2. Resets the local Supabase DB so every test file starts from a clean state.
 *
 * This replaces the per-file `supabase db reset` call that was previously in
 * local-supabase-setup.ts — that approach caused 37 parallel processes to
 * race for the same DB and corrupt each other's state.
 */
export async function setup() {
  if (process.env.SKIP_DB_RESET === "1") return;

  const backendRoot = resolve(__dirname, "..");

  // 1. Get local Supabase env vars (URL, keys) if not already set
  if (!process.env.SUPABASE_TEST_URL || !process.env.SUPABASE_TEST_PUBLISHABLE_KEY || !process.env.SUPABASE_TEST_SERVICE_ROLE_KEY || !process.env.SUPABASE_TEST_DB_URL) {
    try {
      const out = execSync("supabase status --output env", {
        cwd: backendRoot,
        env: { ...process.env, SUPABASE_PROJECT_ID: "backend" },
        encoding: "utf8",
      });
      for (const line of out.split("\n")) {
        const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
        if (!m) continue;
        const [, key, val] = m;
        if (key === "API_URL" && !process.env.SUPABASE_TEST_URL) process.env.SUPABASE_TEST_URL = val;
        if (key === "PUBLISHABLE_KEY" && !process.env.SUPABASE_TEST_PUBLISHABLE_KEY) process.env.SUPABASE_TEST_PUBLISHABLE_KEY = val;
        if (key === "ANON_KEY" && !process.env.SUPABASE_TEST_PUBLISHABLE_KEY) process.env.SUPABASE_TEST_PUBLISHABLE_KEY = val;
        if (key === "SERVICE_ROLE_KEY" && !process.env.SUPABASE_TEST_SERVICE_ROLE_KEY) process.env.SUPABASE_TEST_SERVICE_ROLE_KEY = val;
        if (key === "SECRET_KEY" && !process.env.SUPABASE_TEST_SERVICE_ROLE_KEY) process.env.SUPABASE_TEST_SERVICE_ROLE_KEY = val;
        if (key === "DB_URL" && !process.env.SUPABASE_TEST_DB_URL) process.env.SUPABASE_TEST_DB_URL = val;
        if (key === "JWT_SECRET" && !process.env.SUPABASE_TEST_JWT_SECRET) process.env.SUPABASE_TEST_JWT_SECRET = val;
      }
    } catch (err) {
      console.error("supabase status failed:", (err as Error).message);
      throw err;
    }
  }

  // 2. Reset DB (single, sequential, before any test file runs)
  execSync("supabase db reset --local --no-seed", {
    cwd: backendRoot,
    stdio: "inherit",
  });
}
