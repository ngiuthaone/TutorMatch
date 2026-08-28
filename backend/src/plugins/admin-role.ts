import type { FastifyRequest, FastifyReply } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { ApiError } from "../errors/api-error.js";

/**
 * Server-authoritative admin role check. Reads the caller's own profile
 * via the user's JWT (RLS allows reading only your own profile) and
 * verifies role = 'admin'. Deny-by-default.
 *
 * MUST be used AFTER app.authenticate — it depends on request.auth.userId.
 */
export function createRequireAdmin(
  supabaseUrl: string,
  publishableKey: string,
) {
  return async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    if (!request.auth?.userId) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.", { "WWW-Authenticate": "Bearer" });
    }
    const client = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${request.auth.accessToken}` } },
    });
    const { data, error } = await client
      .from("profiles")
      .select("role")
      .eq("id", request.auth.userId)
      .single();
    if (error || !data) {
      throw new ApiError(403, "FORBIDDEN", "Unable to verify admin role.");
    }
    if (data.role !== "admin") {
      throw new ApiError(403, "FORBIDDEN", "Admin access required.");
    }
  };
}
