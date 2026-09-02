import { createClient } from "@supabase/supabase-js";
import type { AuthService } from "./auth-service.js";
import { logServiceError } from "../lib/service-error.js";

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export type SearchResult =
  | { status: "ok"; data: { posts: Record<string, unknown>[]; threads: Record<string, unknown>[]; communities: Record<string, unknown>[]; nextCursor: string | null } }
  | { status: "unavailable" };

export function createSupabaseSearchService(url: string, publishableKey: string, _authService: AuthService) {
  const caller = (token?: string) => createClient(url, publishableKey, {
    auth: authOptions,
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });

  return {
    async searchAll(query: string, limit: number = 20, kind: string = "all"): Promise<SearchResult> {
      try {
        const { data, error } = await caller().rpc("search_all", { p_query: query, p_limit: limit, p_kind: kind });
        if (error) { logServiceError({ service: "search", operation: "searchAll", error }); return { status: "unavailable" }; }
        const row = data as { posts?: Record<string, unknown>[]; threads?: Record<string, unknown>[]; communities?: Record<string, unknown>[]; next_cursor?: string | null };
        return {
          status: "ok",
          data: {
            posts: row.posts ?? [],
            threads: row.threads ?? [],
            communities: row.communities ?? [],
            nextCursor: row.next_cursor ?? null,
          },
        };
      } catch (err) {
        logServiceError({ service: "search", operation: "searchAll.exception", error: err });
        return { status: "unavailable" };
      }
    },
  };
}

export type SearchService = ReturnType<typeof createSupabaseSearchService>;
