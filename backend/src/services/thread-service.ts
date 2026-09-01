import { createClient } from "@supabase/supabase-js";
import type { AuthService } from "./auth-service.js";
import { logServiceError } from "../lib/service-error.js";

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export type ThreadCreateResult =
  | { status: "ok"; data: { id: string; status: string } }
  | { status: "invalid"; code: "INVALID_TITLE" | "TITLE_TOO_LONG" | "BODY_TOO_LONG" | "INVALID_ANCHOR_TYPE" | "INVALID_ANCHOR_URL" | "ANCHOR_ID_REQUIRED" | "INVALID_VISIBILITY" | "INVALID_REPLY_PERMISSION" | "INVALID_LEVEL" | "COMMUNITY_ID_REQUIRED" | "EMAIL_VERIFICATION_REQUIRED" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type ThreadListResult =
  | { status: "ok"; data: { threads: Record<string, unknown>[]; nextCursor: string | null } }
  | { status: "unavailable" };

export type ThreadGetResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "not_found" }
  | { status: "unavailable" };

export type ThreadReplyListResult =
  | { status: "ok"; data: { replies: Record<string, unknown>[] } }
  | { status: "unavailable" };

export type ThreadReplyCreateResult =
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

export type ThreadAppreciateResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "not_found" }
  | { status: "unavailable" };

export type ThreadReportResult =
  | { status: "ok"; data: { id: string; status: string } }
  | { status: "invalid"; code: "INVALID_REASON" | "EMAIL_VERIFICATION_REQUIRED" }
  | { status: "unavailable" };

function mapThreadError(code: string, message: string): { status: "not_found" | "forbidden" | "invalid" | "unavailable"; code?: string } {
  if (code === "P0001") {
    if (message.includes("EMAIL_VERIFICATION_REQUIRED")) return { status: "invalid", code: "EMAIL_VERIFICATION_REQUIRED" };
    if (message.includes("NOT_FOUND")) return { status: "not_found" };
    if (message.includes("THREAD_CLOSED")) return { status: "invalid", code: "THREAD_CLOSED" };
    if (message.includes("REPLIES_DISABLED")) return { status: "invalid", code: "REPLIES_DISABLED" };
    if (message.includes("DEPTH_EXCEEDED")) return { status: "invalid", code: "DEPTH_EXCEEDED" };
    return { status: "not_found" };
  }
  if (code === "42501" || message.includes("permission denied") || message.includes("FORBIDDEN")) {
    return { status: "forbidden" };
  }
  if (code === "22023") {
    if (message.includes("INVALID_BODY")) return { status: "invalid", code: "INVALID_BODY" };
    if (message.includes("INVALID_TITLE")) return { status: "invalid", code: "INVALID_TITLE" };
    if (message.includes("TITLE_TOO_LONG")) return { status: "invalid", code: "TITLE_TOO_LONG" };
    if (message.includes("BODY_TOO_LONG")) return { status: "invalid", code: "BODY_TOO_LONG" };
    if (message.includes("INVALID_ANCHOR")) return { status: "invalid", code: "INVALID_ANCHOR_TYPE" };
    if (message.includes("INVALID_REASON")) return { status: "invalid", code: "INVALID_REASON" };
    return { status: "invalid", code: "INVALID_BODY" };
  }
  return { status: "unavailable" };
}

export function createSupabaseThreadService(url: string, publishableKey: string, _authService: AuthService) {
  const caller = (token?: string) => createClient(url, publishableKey, {
    auth: authOptions,
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });

  return {
    async create(
      token: string,
      input: {
        title: string;
        body?: string | null;
        anchorType: string;
        anchorId?: string | null;
        anchorUrl?: string | null;
        anchorTitle?: string | null;
        anchorDomain?: string | null;
        tags?: string[];
        level?: string | null;
        visibility?: string;
        communityId?: string | null;
        replyPermission?: string;
      },
    ): Promise<ThreadCreateResult> {
      try {
        const { data, error } = await caller(token).rpc("create_reference_thread", {
          p_title: input.title,
          p_body: input.body ?? null,
          p_anchor_type: input.anchorType,
          p_anchor_id: input.anchorId ?? null,
          p_anchor_url: input.anchorUrl ?? null,
          p_anchor_title: input.anchorTitle ?? null,
          p_anchor_domain: input.anchorDomain ?? null,
          p_tags: input.tags ?? [],
          p_level: input.level ?? null,
          p_visibility: input.visibility ?? "public",
          p_community_id: input.communityId ?? null,
          p_reply_permission: input.replyPermission ?? "everyone",
        });
        if (error) {
          logServiceError("thread.create", error);
          const mapped = mapThreadError(error.code ?? "", error.message ?? "");
          if (mapped.status === "invalid") return { status: "invalid", code: (mapped.code ?? "INVALID_BODY") as ThreadCreateResult extends { status: "invalid" } ? ThreadCreateResult["code"] : never };
          if (mapped.status === "forbidden") return { status: "forbidden" };
          return { status: "unavailable" };
        }
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "published") } };
      } catch (err) {
        logServiceError("thread.create.exception", err);
        return { status: "unavailable" };
      }
    },

    async listPublic(cursor: string | null, limit: number, tag?: string | null, level?: string | null, anchorType?: string | null): Promise<ThreadListResult> {
      try {
        const { data, error } = await caller().rpc("list_reference_threads", {
          p_cursor: cursor,
          p_limit: limit,
          p_tag: tag ?? null,
          p_level: level ?? null,
          p_anchor_type: anchorType ?? null,
        });
        if (error) { logServiceError("thread.list", error); return { status: "unavailable" }; }
        const row = data as { threads?: Record<string, unknown>[]; next_cursor?: string | null };
        return { status: "ok", data: { threads: row.threads ?? [], nextCursor: row.next_cursor ?? null } };
      } catch (err) {
        logServiceError("thread.list.exception", err);
        return { status: "unavailable" };
      }
    },

    async getPublic(id: string): Promise<ThreadGetResult> {
      try {
        const { data, error } = await caller().rpc("get_reference_thread", { p_id: id });
        if (error) { logServiceError("thread.get", error); return { status: "unavailable" }; }
        if (data === null) return { status: "not_found" };
        return { status: "ok", data: data as Record<string, unknown> };
      } catch (err) {
        logServiceError("thread.get.exception", err);
        return { status: "unavailable" };
      }
    },

    async listReplies(threadId: string): Promise<ThreadReplyListResult> {
      try {
        const { data, error } = await caller().rpc("list_thread_replies", { p_thread_id: threadId });
        if (error) { logServiceError("thread.replies", error); return { status: "unavailable" }; }
        const row = data as { replies?: Record<string, unknown>[] };
        return { status: "ok", data: { replies: row.replies ?? [] } };
      } catch (err) {
        logServiceError("thread.replies.exception", err);
        return { status: "unavailable" };
      }
    },

    async reply(token: string, threadId: string, body: string, parentId?: string | null): Promise<ThreadReplyCreateResult> {
      try {
        const { data, error } = await caller(token).rpc("reply_to_thread", {
          p_thread_id: threadId,
          p_body: body,
          p_parent_id: parentId ?? null,
        });
        if (error) {
          logServiceError("thread.reply", error);
          const mapped = mapThreadError(error.code ?? "", error.message ?? "");
          if (mapped.status === "invalid") return { status: "invalid", code: (mapped.code ?? "INVALID_BODY") as ThreadReplyCreateResult extends { status: "invalid" } ? ThreadReplyCreateResult["code"] : never };
          if (mapped.status === "forbidden") return { status: "forbidden" };
          if (mapped.status === "not_found") return { status: "not_found" };
          return { status: "unavailable" };
        }
        const row = data as { id?: string; depth?: number; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), depth: row.depth ?? 1, status: String(row.status ?? "published") } };
      } catch (err) {
        logServiceError("thread.reply.exception", err);
        return { status: "unavailable" };
      }
    },

    async close(token: string, id: string): Promise<ThreadMutationResult> {
      try {
        const { data, error } = await caller(token).rpc("close_reference_thread", { p_id: id });
        if (error) {
          logServiceError("thread.close", error);
          const mapped = mapThreadError(error.code ?? "", error.message ?? "");
          if (mapped.status === "not_found") return { status: "not_found" };
          if (mapped.status === "forbidden") return { status: "forbidden" };
          return { status: "unavailable" };
        }
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "closed") } };
      } catch (err) { logServiceError("thread.close.exception", err); return { status: "unavailable" }; }
    },

    async reopen(token: string, id: string): Promise<ThreadMutationResult> {
      try {
        const { data, error } = await caller(token).rpc("reopen_reference_thread", { p_id: id });
        if (error) {
          logServiceError("thread.reopen", error);
          const mapped = mapThreadError(error.code ?? "", error.message ?? "");
          if (mapped.status === "not_found") return { status: "not_found" };
          if (mapped.status === "forbidden") return { status: "forbidden" };
          return { status: "unavailable" };
        }
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "published") } };
      } catch (err) { logServiceError("thread.reopen.exception", err); return { status: "unavailable" }; }
    },

    async deleteThread(token: string, id: string): Promise<ThreadMutationResult> {
      try {
        const { data, error } = await caller(token).rpc("delete_reference_thread", { p_id: id });
        if (error) {
          logServiceError("thread.delete", error);
          const mapped = mapThreadError(error.code ?? "", error.message ?? "");
          if (mapped.status === "not_found") return { status: "not_found" };
          if (mapped.status === "forbidden") return { status: "forbidden" };
          return { status: "unavailable" };
        }
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "deleted") } };
      } catch (err) { logServiceError("thread.delete.exception", err); return { status: "unavailable" }; }
    },

    async deleteReply(token: string, id: string): Promise<ThreadMutationResult> {
      try {
        const { data, error } = await caller(token).rpc("delete_thread_reply", { p_id: id });
        if (error) {
          logServiceError("thread.deleteReply", error);
          const mapped = mapThreadError(error.code ?? "", error.message ?? "");
          if (mapped.status === "not_found") return { status: "not_found" };
          if (mapped.status === "forbidden") return { status: "forbidden" };
          return { status: "unavailable" };
        }
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "deleted") } };
      } catch (err) { logServiceError("thread.deleteReply.exception", err); return { status: "unavailable" }; }
    },

    async appreciate(token: string, targetType: string, targetId: string): Promise<ThreadAppreciateResult> {
      try {
        const { data, error } = await caller(token).rpc("appreciate_reference", {
          p_target_type: targetType,
          p_target_id: targetId,
        });
        if (error) {
          logServiceError("thread.appreciate", error);
          if ((error.code ?? "") === "P0001") return { status: "not_found" };
          return { status: "unavailable" };
        }
        return { status: "ok", data: data as Record<string, unknown> };
      } catch (err) { logServiceError("thread.appreciate.exception", err); return { status: "unavailable" }; }
    },

    async unappreciate(token: string, targetType: string, targetId: string): Promise<ThreadAppreciateResult> {
      try {
        const { data, error } = await caller(token).rpc("unappreciate_reference", {
          p_target_type: targetType,
          p_target_id: targetId,
        });
        if (error) { logServiceError("thread.unappreciate", error); return { status: "unavailable" }; }
        return { status: "ok", data: data as Record<string, unknown> };
      } catch (err) { logServiceError("thread.unappreciate.exception", err); return { status: "unavailable" }; }
    },

    async report(token: string, targetType: string, targetId: string, reason: string): Promise<ThreadReportResult> {
      try {
        const { data, error } = await caller(token).rpc("report_reference_content", {
          p_target_type: targetType,
          p_target_id: targetId,
          p_reason: reason,
        });
        if (error) {
          logServiceError("thread.report", error);
          if (error.code === "22023" && error.message?.includes("INVALID_REASON")) {
            return { status: "invalid", code: "INVALID_REASON" };
          }
          return { status: "unavailable" };
        }
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "pending") } };
      } catch (err) { logServiceError("thread.report.exception", err); return { status: "unavailable" }; }
    },
  };
}

export type ThreadService = ReturnType<typeof createSupabaseThreadService>;
