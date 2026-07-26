import { beforeEach, describe, expect, it, vi } from "vitest"; import { getSupabaseClient, resetSupabaseClientForTests } from "../../src/auth/supabase-client.js";
describe("Supabase client", () => {
  beforeEach(resetSupabaseClientForTests);
  it("creates one configured PKCE client", () => { const factory = vi.fn(() => ({ auth: {} })); const config = { supabaseUrl: "https://project.supabase.co", supabasePublishableKey: "public" }; const first = getSupabaseClient(config, factory), second = getSupabaseClient(config, factory); expect(first).toBe(second); expect(factory).toHaveBeenCalledOnce(); expect(factory.mock.calls[0][2].auth).toMatchObject({ flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }); });
  it("uses a project-scoped storage key", () => { const factory = vi.fn(() => ({})); getSupabaseClient({ supabaseUrl: "https://abc.supabase.co", supabasePublishableKey: "public" }, factory); expect(factory.mock.calls[0][2].auth.storageKey).toContain("abc"); });
});
