import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";

export async function signUpConfirmed({
  anon,
  url,
  publishableKey,
  serviceRoleKey,
  email,
  password,
  metadata,
}: {
  anon: SupabaseClient;
  url: string;
  publishableKey: string;
  serviceRoleKey: string;
  email: string;
  password: string;
  metadata: Record<string, unknown>;
}): Promise<{ user: User; session: Session; client: SupabaseClient }> {
  const { data, error } = await anon.auth.signUp({ email, password, options: { data: metadata } });
  if (error || !data.user) throw new Error(`Local signup failed: ${error?.message ?? "missing user"}`);
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const confirmed = await admin.auth.admin.updateUserById(data.user.id, { email_confirm: true });
  if (confirmed.error) throw new Error(`Local fixture confirmation failed: ${confirmed.error.message}`);
  const signedIn = await anon.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw new Error(`Local sign-in failed: ${signedIn.error?.message ?? "missing session"}`);
  return {
    user: data.user,
    session: signedIn.data.session,
    client: createClient(url, publishableKey, {
      global: { headers: { Authorization: `Bearer ${signedIn.data.session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  };
}
