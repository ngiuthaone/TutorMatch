import { getServerSupabaseEnv } from "./auth/server-verify";

interface RpcOptions {
  useAuthCookies?: boolean;
}

async function supabaseClient() {
  const env = getServerSupabaseEnv();
  if (!env) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(env.url, env.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function callTutorRpc<T>(name: string, params: Record<string, unknown>): Promise<T | null> {
  const client = await supabaseClient();
  if (!client) return null;
  const { data, error } = await client.rpc(name, params);
  if (error || !data) return null;
  return data as T;
}
