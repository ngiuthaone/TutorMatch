import { createClient } from "@supabase/supabase-js";
import type { AuthService } from "./auth-service.js";

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export type CommentResult =
  | { status: "ok"; data: { id: string; depth: number; status: string } }
  | { status: "invalid"; code: "INVALID_BODY" | "DEPTH_EXCEEDED" | "OWNER_CLOSED" | "COMMENTS_DISABLED" | "EMAIL_VERIFICATION_REQUIRED" }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type CommentMutationResult =
  | { status: "ok"; data: { id: string; status: string } }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type CommentAppreciateResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "not_found" }
  | { status: "unavailable" };

export type PublicCommentListResult =
  | { status: "ok"; data: { comments: Record<string, unknown>[] } }
  | { status: "unavailable" };

function mapCommentError(code: string, message: string): CommentResult {
  if (code === "P0001") {
    if (message.includes("EMAIL_VERIFICATION_REQUIRED")) return { status: "invalid", code: "EMAIL_VERIFICATION_REQUIRED" };
    if (message.includes("NOT_FOUND")) return { status: "not_found" };
    if (message.includes("PARENT_NOT_FOUND")) return { status: "not_found" };
    if (message.includes("PARENT_DELETED")) return { status: "not_found" };
    if (message.includes("OWNER_CLOSED")) return { status: "invalid", code: "OWNER_CLOSED" };
    if (message.includes("COMMENTS_DISABLED")) return { status: "invalid", code: "COMMENTS_DISABLED" };
    if (message.includes("DEPTH_EXCEEDED")) return { status: "invalid", code: "DEPTH_EXCEEDED" };
    return { status: "invalid", code: "INVALID_BODY" };
  }
  if (code === "42501" || message.includes("permission denied")) return { status: "forbidden" };
  if (code === "22023") return { status: "invalid", code: "INVALID_BODY" };
  return { status: "unavailable" };
}

function mapMutationError(code: string, message: string): CommentMutationResult {
  if (code === "P0001") return { status: "not_found" };
  if (code === "42501" || message.includes("permission denied")) return { status: "forbidden" };
  return { status: "unavailable" };
}

export function createSupabaseCommentService(url: string, publishableKey: string, _authService: AuthService) {
  const caller = (token?: string) => createClient(url, publishableKey, {
    auth: authOptions,
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });

  return {
    async create(
      token: string,
      input: { ownerType: "thread" | "article"; ownerId: string; body: string; parentId?: string | null },
    ): Promise<CommentResult> {
      try {
        const { data, error } = await caller(token).rpc("create_comment", {
          p_owner_type: input.ownerType,
          p_owner_id: input.ownerId,
          p_body: input.body,
          p_parent_id: input.parentId ?? null,
        });
        if (error) return mapCommentError(error.code ?? "", error.message ?? "");
        const row = data as { id?: string; depth?: number; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), depth: row.depth ?? 1, status: String(row.status ?? "published") } };
      } catch {
        return { status: "unavailable" };
      }
    },

    async deleteComment(token: string, id: string): Promise<CommentMutationResult> {
      try {
        const { data, error } = await caller(token).rpc("delete_comment", { p_id: id });
        if (error) return mapMutationError(error.code ?? "", error.message ?? "");
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "deleted") } };
      } catch {
        return { status: "unavailable" };
      }
    },

    async appreciate(token: string, commentId: string): Promise<CommentAppreciateResult> {
      try {
        const { data, error } = await caller(token).rpc("appreciate_comment", { p_comment_id: commentId });
        if (error) {
          if ((error.code ?? "") === "P0001") return { status: "not_found" };
          return { status: "unavailable" };
        }
        return { status: "ok", data: data as Record<string, unknown> };
      } catch {
        return { status: "unavailable" };
      }
    },

    async unappreciate(token: string, commentId: string): Promise<CommentAppreciateResult> {
      try {
        const { data, error } = await caller(token).rpc("unappreciate_comment", { p_comment_id: commentId });
        if (error) return { status: "unavailable" };
        return { status: "ok", data: data as Record<string, unknown> };
      } catch {
        return { status: "unavailable" };
      }
    },

    async listPublic(ownerType: "thread" | "article", ownerId: string): Promise<PublicCommentListResult> {
      try {
        const { data, error } = await caller().rpc("list_comments", { p_owner_type: ownerType, p_owner_id: ownerId });
        if (error) return { status: "unavailable" };
        const row = data as { comments?: Record<string, unknown>[] };
        return { status: "ok", data: { comments: row.comments ?? [] } };
      } catch {
        return { status: "unavailable" };
      }
    },
  };
}

export type CommentService = ReturnType<typeof createSupabaseCommentService>;
