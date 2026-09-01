import { createClient } from "@supabase/supabase-js";
import type { AuthService } from "./auth-service.js";
import { logServiceError } from "../lib/service-error.js";

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export type BookmarkAddResult =
  | { status: "ok"; data: { id: string; target_type: string; target_id: string } }
  | { status: "invalid"; code: "INVALID_TARGET_TYPE" | "EMAIL_VERIFICATION_REQUIRED" }
  | { status: "unavailable" };

export type BookmarkRemoveResult =
  | { status: "ok"; data: { removed: boolean } }
  | { status: "unavailable" };

export type BookmarkListResult =
  | { status: "ok"; data: { bookmarks: Record<string, unknown>[]; nextCursor: string | null } }
  | { status: "unavailable" };

export type ReportResult =
  | { status: "ok"; data: { id: string; status: string } }
  | { status: "invalid"; code: "INVALID_REASON" | "EMAIL_VERIFICATION_REQUIRED" }
  | { status: "not_found" }
  | { status: "unavailable" };

export function createSupabaseBookmarkService(url: string, publishableKey: string, _authService: AuthService) {
  const caller = (token?: string) => createClient(url, publishableKey, {
    auth: authOptions,
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });

  return {
    async add(token: string, targetType: string, targetId: string): Promise<BookmarkAddResult> {
      try {
        const { data, error } = await caller(token).rpc("bookmark_add", { p_target_type: targetType, p_target_id: targetId });
        if (error) {
          logServiceError({ service: "bookmark", operation: "add", error });
          if ((error.code ?? "") === "22023" && (error.message ?? "").includes("INVALID_TARGET_TYPE")) {
            return { status: "invalid", code: "INVALID_TARGET_TYPE" };
          }
          return { status: "unavailable" };
        }
        const row = data as { id?: string; target_type?: string; target_id?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), target_type: String(row.target_type ?? targetType), target_id: String(row.target_id ?? targetId) } };
      } catch (err) { logServiceError({ service: "bookmark", operation: "add.exception", error: err }); return { status: "unavailable" }; }
    },

    async remove(token: string, targetType: string, targetId: string): Promise<BookmarkRemoveResult> {
      try {
        const { data, error } = await caller(token).rpc("bookmark_remove", { p_target_type: targetType, p_target_id: targetId });
        if (error) { logServiceError({ service: "bookmark", operation: "remove", error }); return { status: "unavailable" }; }
        const row = data as { removed?: boolean };
        return { status: "ok", data: { removed: Boolean(row.removed) } };
      } catch (err) { logServiceError({ service: "bookmark", operation: "remove.exception", error: err }); return { status: "unavailable" }; }
    },

    async list(token: string, cursor: string | null, limit: number): Promise<BookmarkListResult> {
      try {
        const { data, error } = await caller(token).rpc("list_bookmarks", { p_cursor: cursor, p_limit: limit });
        if (error) { logServiceError({ service: "bookmark", operation: "list", error }); return { status: "unavailable" }; }
        const row = data as { bookmarks?: Record<string, unknown>[]; next_cursor?: string | null };
        return { status: "ok", data: { bookmarks: row.bookmarks ?? [], nextCursor: row.next_cursor ?? null } };
      } catch (err) { logServiceError({ service: "bookmark", operation: "list.exception", error: err }); return { status: "unavailable" }; }
    },
  };
}

export type BookmarkService = ReturnType<typeof createSupabaseBookmarkService>;

export function createSupabaseReportService(url: string, publishableKey: string, _authService: AuthService) {
  const caller = (token?: string) => createClient(url, publishableKey, {
    auth: authOptions,
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });

  return {
    async reportPost(token: string, postId: string, reason: string): Promise<ReportResult> {
      try {
        const { data, error } = await caller(token).rpc("report_post", { p_post_id: postId, p_reason: reason });
        if (error) {
          logServiceError({ service: "report", operation: "post", error });
          if ((error.code ?? "") === "22023" && (error.message ?? "").includes("INVALID_REASON")) {
            return { status: "invalid", code: "INVALID_REASON" };
          }
          if ((error.code ?? "") === "P0001") return { status: "not_found" };
          return { status: "unavailable" };
        }
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "pending") } };
      } catch (err) { logServiceError({ service: "report", operation: "post.exception", error: err }); return { status: "unavailable" }; }
    },

    async reportArticle(token: string, articleId: string, reason: string): Promise<ReportResult> {
      try {
        const { data, error } = await caller(token).rpc("report_article", { p_article_id: articleId, p_reason: reason });
        if (error) {
          logServiceError({ service: "report", operation: "article", error });
          if ((error.code ?? "") === "22023" && (error.message ?? "").includes("INVALID_REASON")) {
            return { status: "invalid", code: "INVALID_REASON" };
          }
          if ((error.code ?? "") === "P0001") return { status: "not_found" };
          return { status: "unavailable" };
        }
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "pending") } };
      } catch (err) { logServiceError({ service: "report", operation: "article.exception", error: err }); return { status: "unavailable" }; }
    },
  };
}

export type ReportService = ReturnType<typeof createSupabaseReportService>;
