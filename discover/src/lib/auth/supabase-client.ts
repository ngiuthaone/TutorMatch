import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRuntimeConfig, isLiveMode } from "./config";

let singleton: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isLiveMode()) return null;
  const config = getRuntimeConfig();
  if (!singleton) {
    singleton = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: `tutoria-auth-${new URL(config.supabaseUrl).hostname.split(".")[0]}`,
      },
    });
  }
  return singleton;
}

export function resetSupabaseClientForTests(): void {
  singleton = null;
}