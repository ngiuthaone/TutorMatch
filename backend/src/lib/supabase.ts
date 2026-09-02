import { createClient } from "@supabase/supabase-js";
import { profileSchema } from "../schemas/profile.js";
import type { AuthService } from "../services/auth-service.js";
import { logServiceError } from "./service-error.js";

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export function createSupabaseAuthService(url: string, publishableKey: string): AuthService {
  return {
    async validateAccessToken(token) {
      try {
        const client = createClient(url, publishableKey, { auth: authOptions });
        const { data, error } = await client.auth.getUser(token);
        if (error) return error.status === 401 || error.status === 403 ? { status: "invalid" } : { status: "unavailable" };
        if (!data.user) return { status: "invalid" };
        return { status: "authenticated", user: { id: data.user.id, email: data.user.email ?? null } };
      } catch (error) {
        logServiceError({ service: "supabase", operation: "validateAccessToken", error });
        return { status: "unavailable" };
      }
    },
    async getOwnProfile(token, userId) {
      try {
        const client = createClient(url, publishableKey, {
          auth: authOptions,
          global: { headers: { Authorization: `Bearer ${token}` } }
        });
        const { data, error } = await client.from("profiles")
          .select("id,role,name,phone,avatar_url,created_at,updated_at").eq("id", userId).maybeSingle();
        if (error) return { status: "unavailable" };
        if (!data) return { status: "not_found" };
        const parsed = profileSchema.safeParse(data);
        return parsed.success ? { status: "found", profile: parsed.data } : { status: "invalid_data" };
      } catch (error) {
        logServiceError({ service: "supabase", operation: "getOwnProfile", error });
        return { status: "unavailable" };
      }
    }
  };
}

/**
 * Create a Supabase client for service-to-service calls.
 * Does not persist session; used for backend services calling Supabase.
 */
export function createServiceClient(
  url: string,
  key: string,
  token?: string
) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}

/**
 * Create a service client factory (curried for service construction).
 */
export function createServiceClientFactory(url: string, key: string) {
  return (token?: string) => createServiceClient(url, key, token);
}
