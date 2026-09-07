import { createBrowserClient, type SupabaseClient } from "@supabase/ssr";
import { getRuntimeConfig, isLiveMode } from "./config";

let singleton: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isLiveMode()) return null;
  const config = getRuntimeConfig();
  if (!singleton) {
    singleton = createBrowserClient(config.supabaseUrl, config.supabasePublishableKey);
  }
  return singleton;
}

export function resetSupabaseClientForTests(): void {
  singleton = null;
}