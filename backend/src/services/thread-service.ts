import { createClient } from "@supabase/supabase-js";
import type { AuthService } from "./auth-service.js";

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export type ThreadResult =
  | { status: "ok"; data: { id: string; status: string } }
  | { status: "invalid"; code: "INVALID_TITLE" | "INVALID_BODY" | "INVALID_ANCHOR" | "INVALID_ANCHOR_URL" | "INVALID_VISIBILITY" | "EMAIL_VERIFICATION_REQUIRED" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type PublicThreadListResult =
  | { status: "ok"; data: { threads: Record<string, unknown>[]; nextCursor: string | null } }
  | { status: "unavailable" };

export type PublicThreadResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "not_found" }
  | { status: "unavailable" };

export type ReplyResult =
  | { status: "ok"; data: { id: string; depth: number; status: string } }
  | { status: "invalid"; code: "INVALID_BODY" | "DEPTH_EXCEEDED" | "THREAD_CLOSED" | "REPLIES_DISABLED" | "EMAIL_VERIFICATION_REQUIRED" }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type ThreadMutationResult =
  | { status: "ok"; data: { id: string; status: string } }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type AppreciateResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "invalid" | "not_found" | "unavailable" };

export type ReportResult =
  | { status: "ok"; data: { id: string; status: string } }
  | { status: "invalid" }
  | { status: "unavailable" };

function mapThreadError(code: string, message: string): ThreadResult {
  if (code === "P0001") {
    if (message.includes("EMAIL_VERIFICATION_REQUIRED")) return { status: "invalid", code: "EMAIL_VERIFICATION_REQUIRED" };
    return { status: "invalid", code: "INVALID_BODY" };
  }
  if (code === "22501" || message.includes("permission denied") || code === "42501") return { status: "forbidden" };
  if (code === "22023") {
    if (message.includes("INVALID_ANCHOR_URL")) return { status: "invalid", code: "INVALID_ANCHOR_URL" };
    if (message.includes("INVALID_ANCHOR")) return { status: "invalid", code: "INVALID_ANCHOR" };
    if (message.includes("INVALID_VISIBILITY")) return { status: "invalid", code: "INVALID_VISIBILITY" };
    if (message.includes("INVALID_TITLE")) return { status: "invalid", code: "INVALID_TITLE" };
    return { status: "invalid", code: "INVALID_BODY" };
  }
  return { status: "unavailable" };
}

function mapReplyError(code: string, message: string): ReplyResult {
  if (code === "P0001") {
    if (message.includes("EMAIL_VERIFICATION_REQUIRED")) return { status: "invalid", code: "EMAIL_VERIFICATION_REQUIRED" };
    if (message.includes("THREAD_NOT_FOUND") || message.includes("PARENT_NOT_FOUND")) return { status: "not_found" };
    if (message.includes("THREAD_CLOSED")) return { status: "invalid", code: "THREAD_CLOSED" };
    if (message.includes("REPLIES_DISABLED")) return { status: "invalid", code: "REPLIES_DISABLED" };
    if (message.includes("DEPTH_EXCEEDED")) return { status: "invalid", code: "DEPTH_EXCEEDED" };
    if (message.includes("PARENT_DELETED")) return { status: "not_found" };
    return { status: "invalid", code: "INVALID_BODY" };
  }
  if (code === "42501" || message.includes("permission denied")) return { status: "forbidden" };
  if (code === "22023") return { status: "invalid", code: "INVALID_BODY" };
  return { status: "unavailable" };
}

function mapMutationError(code: string, message: string): ThreadMutationResult {
  if (code === "P0001") return { status: "not_found" };
  if (code === "42501" || message.includes("permission denied")) return { status: "forbidden" };
  return { status: "unavailable" };
}

export function createSupabaseThreadService(url: string, publishableKey: string, _authService: AuthService) {
  const caller = (token?: string) => createClient(url, publishableKey, {
    auth: authOptions,
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });

  return {
    async createThread(
      token: string,
      input: { title: string; body?: string | null | undefined; anchorType: string; anchorId?: string | null | undefined; anchorUrl?: string | null | undefined; anchorTitle?: string | null | undefined; tags?: string[] | undefined; level?: string | null | undefined; visibility?: string | undefined; communityId?: string | null | undefined; replyPermission?: string | undefined },
    ): Promise<ThreadResult> {
      try {
        const { data, error } = await caller(token).rpc("create_reference_thread", {
          p_title: input.title,
          p_body: input.body ?? null,
          p_anchor_type: input.anchorType,
          p_anchor_id: input.anchorId ?? null,
          p_anchor_url: input.anchorUrl ?? null,
          p_anchor_title: input.anchorTitle ?? null,
          p_tags: input.tags ?? [],
          p_level: input.level ?? null,
          p_visibility: input.visibility ?? "public",
          p_community_id: input.communityId ?? null,
          p_reply_permission: input.replyPermission ?? "everyone",
        });
        if (error) return mapThreadError(error.code ?? "", error.message ?? "");
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "published") } };
      } catch {
        return { status: "unavailable" };
      }
    },

    async listPublicThreads(cursor: string | null, limit: number, tag: string | null, level: string | null, anchorType: string | null): Promise<PublicThreadListResult> {
      try {
        const { data, error } = await caller().rpc("list_reference_threads", {
          p_cursor: cursor, p_limit: limit, p_tag: tag, p_level: level, p_anchor_type: anchorType,
        });
        if (error) return { status: "unavailable" };
        const row = data as { threads?: Record<string, unknown>[]; next_cursor?: string | null };
        return { status: "ok", data: { threads: row.threads ?? [], nextCursor: row.next_cursor ?? null } };
      } catch {
        return { status: "unavailable" };
      }
    },

    async getPublicThread(id: string): Promise<PublicThreadResult> {
      try {
        const { data, error } = await caller().rpc("get_reference_thread", { p_id: id });
        if (error) return { status: "unavailable" };
        if (!data || typeof data !== "object") return { status: "not_found" };
        return { status: "ok", data: data as Record<string, unknown> };
      } catch {
        return { status: "unavailable" };
      }
    },

    async reply(token: string, threadId: string, body: string, parentId: string | null): Promise<ReplyResult> {
      try {
        const { data, error } = await caller(token).rpc("reply_to_thread", {
          p_thread_id: threadId, p_body: body, p_parent_id: parentId,
        });
        if (error) return mapReplyError(error.code ?? "", error.message ?? "");
        const row = data as { id?: string; depth?: number; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), depth: row.depth ?? 1, status: String(row.status ?? "published") } };
      } catch {
        return { status: "unavailable" };
      }
    },

    async closeThread(token: string, id: string): Promise<ThreadMutationResult> {
      try {
        const { data, error } = await caller(token).rpc("close_reference_thread", { p_id: id });
        if (error) return mapMutationError(error.code ?? "", error.message ?? "");
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "closed") } };
      } catch {
        return { status: "unavailable" };
      }
    },

    async reopenThread(token: string, id: string): Promise<ThreadMutationResult> {
      try {
        const { data, error } = await caller(token).rpc("reopen_reference_thread", { p_id: id });
        if (error) return mapMutationError(error.code ?? "", error.message ?? "");
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "published") } };
      } catch {
        return { status: "unavailable" };
      }
    },

    async deleteThread(token: string, id: string): Promise<ThreadMutationResult> {
      try {
        const { data, error } = await caller(token).rpc("delete_reference_thread", { p_id: id });
        if (error) return mapMutationError(error.code ?? "", error.message ?? "");
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "deleted") } };
      } catch {
        return { status: "unavailable" };
      }
    },

    async deleteReply(token: string, id: string): Promise<ThreadMutationResult> {
      try {
        const { data, error } = await caller(token).rpc("delete_reply", { p_id: id });
        if (error) return mapMutationError(error.code ?? "", error.message ?? "");
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "deleted") } };
      } catch {
        return { status: "unavailable" };
      }
    },

    async appreciate(token: string, targetType: string, targetId: string): Promise<AppreciateResult> {
      try {
        const { data, error } = await caller(token).rpc("appreciate_reference", { p_target_type: targetType, p_target_id: targetId });
        if (error) {
          const code = error.code ?? "";
          if (code === "22023") return { status: "invalid" };
          if (code === "P0001") return { status: "not_found" };
          return { status: "unavailable" };
        }
        return { status: "ok", data: data as Record<string, unknown> };
      } catch {
        return { status: "unavailable" };
      }
    },

    async unappreciate(token: string, targetType: string, targetId: string): Promise<AppreciateResult> {
      try {
        const { data, error } = await caller(token).rpc("unappreciate_reference", { p_target_type: targetType, p_target_id: targetId });
        if (error) return { status: "unavailable" };
        return { status: "ok", data: data as Record<string, unknown> };
      } catch {
        return { status: "unavailable" };
      }
    },

    async report(token: string, targetType: string, targetId: string, reason: string): Promise<ReportResult> {
      try {
        const { data, error } = await caller(token).rpc("report_reference_content", {
          p_target_type: targetType, p_target_id: targetId, p_reason: reason,
        });
        if (error) {
          const code = error.code ?? "";
          if (code === "22023") return { status: "invalid" };
          return { status: "unavailable" };
        }
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "pending") } };
      } catch {
        return { status: "unavailable" };
      }
    },
  };
}

export type ThreadService = ReturnType<typeof createSupabaseThreadService>;
