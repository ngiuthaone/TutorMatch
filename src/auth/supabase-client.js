import { createClient } from "@supabase/supabase-js";
let singleton = null;
export function getSupabaseClient(config, factory = createClient) {
  if (!singleton) singleton = factory(config.supabaseUrl, config.supabasePublishableKey, { auth: {
    flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
    storageKey: `tutoria-auth-${new URL(config.supabaseUrl).hostname.split(".")[0]}`
  } });
  return singleton;
}
export function resetSupabaseClientForTests() { singleton = null; }
