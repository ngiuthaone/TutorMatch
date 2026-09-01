import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getServerSupabaseEnv } from "./server-verify";

export interface ServerSession {
  user: { id: string; email: string | null; role: string | null };
}

export async function getServerSession(): Promise<ServerSession | null> {
  const env = getServerSupabaseEnv();
  if (!env) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Setting cookies from a Server Component is not allowed in Next 16;
          // session refresh must happen in a Server Action or Route Handler.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // see note above
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
      role: (data.user.app_metadata?.role as string) ?? null,
    },
  };
}
