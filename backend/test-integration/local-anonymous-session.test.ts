import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.SUPABASE_TEST_URL, key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Anonymous Supabase regression test requires local test environment.");

describe("local anonymous Supabase fixture", () => {
  it("can call public session RPCs while private booking RPCs remain denied", async () => {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const sessions = await client.rpc("list_sessions");
    expect(sessions.error).toBeNull();
    const privateResult = await client.rpc("get_my_bookings");
    expect(privateResult.error).toBeTruthy();
  });
});
