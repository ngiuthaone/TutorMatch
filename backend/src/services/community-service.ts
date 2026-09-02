import { createClient } from "@supabase/supabase-js";
import type { AuthService } from "./auth-service.js";
import { logServiceError } from "../lib/service-error.js";

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export type CommunityCreateResult =
  | { status: "ok"; data: { id: string; slug: string } }
  | { status: "invalid"; code: "INVALID_SLUG" | "INVALID_SLUG_FORMAT" | "INVALID_NAME" | "INVALID_VISIBILITY" | "INVALID_JOIN_POLICY" | "DESCRIPTION_TOO_LONG" | "SLUG_TAKEN" | "EMAIL_VERIFICATION_REQUIRED" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type CommunityUpdateResult =
  | { status: "ok"; data: { id: string; updated: boolean } }
  | { status: "invalid"; code: "INVALID_NAME" | "DESCRIPTION_TOO_LONG" | "INVALID_VISIBILITY" | "INVALID_JOIN_POLICY" | "EMAIL_VERIFICATION_REQUIRED" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type CommunityArchiveResult =
  | { status: "ok"; data: { id: string; archived: boolean } }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type CommunityJoinResult =
  | { status: "ok"; data: { community_id: string; status: "active" | "pending" } }
  | { status: "invalid"; code: "JOIN_NOT_OPEN" | "JOIN_NOT_REQUEST" | "EMAIL_VERIFICATION_REQUIRED" }
  | { status: "not_found" }
  | { status: "unavailable" };

export type CommunityLeaveResult =
  | { status: "ok"; data: { community_id: string; left: boolean } }
  | { status: "invalid"; code: "NOT_MEMBER" | "OWNER_CANNOT_LEAVE" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type CommunityMemberActionResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "invalid"; code: "NO_PENDING_REQUEST" | "NOT_MEMBER" | "INVALID_ROLE" | "CANNOT_BAN_OWNER" | "CANNOT_BAN_SELF" | "EMAIL_VERIFICATION_REQUIRED" }
  | { status: "forbidden" }
  | { status: "not_found" }
  | { status: "unavailable" };

export type CommunityListResult =
  | { status: "ok"; data: { communities: Record<string, unknown>[]; nextCursor: string | null } }
  | { status: "unavailable" };

export type CommunityGetResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "not_found" }
  | { status: "unavailable" };

export type CommunityMemberListResult =
  | { status: "ok"; data: { members: Record<string, unknown>[]; nextCursor: string | null } }
  | { status: "unavailable" };

export type CommunityMembershipCheckResult =
  | { status: "ok"; data: { is_member: boolean; is_moderator: boolean; is_owner: boolean; is_pending: boolean; is_banned: boolean } }
  | { status: "unavailable" };

function mapError(code: string, message: string, kind: "join" | "leave" | "mod" | "create" | "update"): { status: "not_found" | "forbidden" | "invalid" | "unavailable"; code?: string } {
  if (code === "P0001") {
    if (message.includes("EMAIL_VERIFICATION_REQUIRED")) return { status: "invalid", code: "EMAIL_VERIFICATION_REQUIRED" };
    if (message.includes("NOT_FOUND")) return { status: "not_found" };
    if (message.includes("JOIN_NOT_OPEN")) return { status: "invalid", code: "JOIN_NOT_OPEN" };
    if (message.includes("JOIN_NOT_REQUEST")) return { status: "invalid", code: "JOIN_NOT_REQUEST" };
    if (message.includes("NO_PENDING_REQUEST")) return { status: "invalid", code: "NO_PENDING_REQUEST" };
    if (message.includes("NOT_MEMBER")) return { status: "invalid", code: "NOT_MEMBER" };
    return { status: "not_found" };
  }
  if (code === "42501" || message.includes("FORBIDDEN")) {
    return { status: "forbidden" };
  }
  if (code === "22023") {
    if (message.includes("OWNER_CANNOT_LEAVE")) return { status: "invalid", code: "OWNER_CANNOT_LEAVE" };
    if (message.includes("CANNOT_BAN_OWNER")) return { status: "invalid", code: "CANNOT_BAN_OWNER" };
    if (message.includes("CANNOT_BAN_SELF")) return { status: "invalid", code: "CANNOT_BAN_SELF" };
    if (message.includes("INVALID_SLUG")) return { status: "invalid", code: "INVALID_SLUG" };
    if (message.includes("INVALID_SLUG_FORMAT")) return { status: "invalid", code: "INVALID_SLUG_FORMAT" };
    if (message.includes("INVALID_NAME")) return { status: "invalid", code: "INVALID_NAME" };
    if (message.includes("INVALID_VISIBILITY")) return { status: "invalid", code: "INVALID_VISIBILITY" };
    if (message.includes("INVALID_JOIN_POLICY")) return { status: "invalid", code: "INVALID_JOIN_POLICY" };
    if (message.includes("INVALID_ROLE")) return { status: "invalid", code: "INVALID_ROLE" };
    if (message.includes("DESCRIPTION_TOO_LONG")) return { status: "invalid", code: "DESCRIPTION_TOO_LONG" };
    if (message.includes("SLUG_TAKEN")) return { status: "invalid", code: "SLUG_TAKEN" };
    return { status: "invalid", code: "INVALID_BODY" };
  }
  return { status: "unavailable" };
}

export function createSupabaseCommunityService(url: string, publishableKey: string, _authService: AuthService) {
  const caller = (token?: string) => createClient(url, publishableKey, {
    auth: authOptions,
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });

  return {
    async create(token: string, input: { slug: string; name: string; description?: string | null; visibility?: string; joinPolicy?: string }): Promise<CommunityCreateResult> {
      try {
        const { data, error } = await caller(token).rpc("create_community", {
          p_slug: input.slug, p_name: input.name,
          p_description: input.description ?? null,
          p_visibility: input.visibility ?? "public",
          p_join_policy: input.joinPolicy ?? "open",
        });
        if (error) {
          logServiceError({ service: "community", operation: "create", error });
          const mapped = mapError(error.code ?? "", error.message ?? "", "create");
          if (mapped.status === "invalid") return { status: "invalid", code: (mapped.code ?? "INVALID_BODY") as CommunityCreateResult extends { status: "invalid" } ? CommunityCreateResult["code"] : never };
          if (mapped.status === "forbidden") return { status: "forbidden" };
          return { status: "unavailable" };
        }
        const row = data as { id?: string; slug?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), slug: String(row.slug ?? "") } };
      } catch (err) { logServiceError({ service: "community", operation: "create.exception", error: err }); return { status: "unavailable" }; }
    },

    async update(token: string, id: string, input: { name?: string | null | undefined; description?: string | null | undefined; visibility?: string | null | undefined; joinPolicy?: string | null | undefined }): Promise<CommunityUpdateResult> {
      try {
        const { data, error } = await caller(token).rpc("update_community", {
          p_id: id,
          p_name: input.name ?? null,
          p_description: input.description ?? null,
          p_visibility: input.visibility ?? null,
          p_join_policy: input.joinPolicy ?? null,
        });
        if (error) {
          logServiceError({ service: "community", operation: "update", error });
          const mapped = mapError(error.code ?? "", error.message ?? "", "update");
          if (mapped.status === "invalid") return { status: "invalid", code: (mapped.code ?? "INVALID_BODY") as CommunityUpdateResult extends { status: "invalid" } ? CommunityUpdateResult["code"] : never };
          if (mapped.status === "forbidden") return { status: "forbidden" };
          return { status: "unavailable" };
        }
        const row = data as { id?: string; updated?: boolean };
        return { status: "ok", data: { id: String(row.id ?? ""), updated: Boolean(row.updated) } };
      } catch (err) { logServiceError({ service: "community", operation: "update.exception", error: err }); return { status: "unavailable" }; }
    },

    async archive(token: string, id: string): Promise<CommunityArchiveResult> {
      try {
        const { data, error } = await caller(token).rpc("archive_community", { p_id: id });
        if (error) {
          logServiceError({ service: "community", operation: "archive", error });
          if ((error.code ?? "") === "42501") return { status: "forbidden" };
          return { status: "unavailable" };
        }
        const row = data as { id?: string; archived?: boolean };
        return { status: "ok", data: { id: String(row.id ?? ""), archived: Boolean(row.archived) } };
      } catch (err) { logServiceError({ service: "community", operation: "archive.exception", error: err }); return { status: "unavailable" }; }
    },

    async join(token: string, id: string): Promise<CommunityJoinResult> {
      try {
        const { data, error } = await caller(token).rpc("join_community", { p_id: id });
        if (error) {
          logServiceError({ service: "community", operation: "join", error });
          const mapped = mapError(error.code ?? "", error.message ?? "", "join");
          if (mapped.status === "not_found") return { status: "not_found" };
          if (mapped.status === "invalid") return { status: "invalid", code: (mapped.code ?? "JOIN_NOT_OPEN") as CommunityJoinResult extends { status: "invalid" } ? CommunityJoinResult["code"] : never };
          return { status: "unavailable" };
        }
        const row = data as { community_id?: string; status?: string };
        return { status: "ok", data: { community_id: String(row.community_id ?? ""), status: (row.status === "pending" ? "pending" : "active") } };
      } catch (err) { logServiceError({ service: "community", operation: "join.exception", error: err }); return { status: "unavailable" }; }
    },

    async requestJoin(token: string, id: string): Promise<CommunityJoinResult> {
      try {
        const { data, error } = await caller(token).rpc("request_join_community", { p_id: id });
        if (error) {
          logServiceError({ service: "community", operation: "requestJoin", error });
          const mapped = mapError(error.code ?? "", error.message ?? "", "join");
          if (mapped.status === "not_found") return { status: "not_found" };
          if (mapped.status === "invalid") return { status: "invalid", code: (mapped.code ?? "JOIN_NOT_REQUEST") as CommunityJoinResult extends { status: "invalid" } ? CommunityJoinResult["code"] : never };
          return { status: "unavailable" };
        }
        const row = data as { community_id?: string; status?: string };
        return { status: "ok", data: { community_id: String(row.community_id ?? ""), status: "pending" } };
      } catch (err) { logServiceError({ service: "community", operation: "requestJoin.exception", error: err }); return { status: "unavailable" }; }
    },

    async leave(token: string, id: string): Promise<CommunityLeaveResult> {
      try {
        const { data, error } = await caller(token).rpc("leave_community", { p_id: id });
        if (error) {
          logServiceError({ service: "community", operation: "leave", error });
          const mapped = mapError(error.code ?? "", error.message ?? "", "leave");
          if (mapped.status === "invalid") return { status: "invalid", code: (mapped.code ?? "NOT_MEMBER") as CommunityLeaveResult extends { status: "invalid" } ? CommunityLeaveResult["code"] : never };
          if (mapped.status === "forbidden") return { status: "forbidden" };
          return { status: "unavailable" };
        }
        const row = data as { community_id?: string; left?: boolean };
        return { status: "ok", data: { community_id: String(row.community_id ?? ""), left: Boolean(row.left) } };
      } catch (err) { logServiceError({ service: "community", operation: "leave.exception", error: err }); return { status: "unavailable" }; }
    },

    async approveMember(token: string, communityId: string, userId: string): Promise<CommunityMemberActionResult> {
      try {
        const { data, error } = await caller(token).rpc("approve_member", { p_community_id: communityId, p_user_id: userId });
        if (error) {
          logServiceError({ service: "community", operation: "approveMember", error });
          const mapped = mapError(error.code ?? "", error.message ?? "", "mod");
          if (mapped.status === "not_found") return { status: "not_found" };
          if (mapped.status === "forbidden") return { status: "forbidden" };
          if (mapped.status === "invalid") return { status: "invalid", code: (mapped.code ?? "NO_PENDING_REQUEST") as CommunityMemberActionResult extends { status: "invalid" } ? CommunityMemberActionResult["code"] : never };
          return { status: "unavailable" };
        }
        return { status: "ok", data: data as Record<string, unknown> };
      } catch (err) { logServiceError({ service: "community", operation: "approveMember.exception", error: err }); return { status: "unavailable" }; }
    },

    async banMember(token: string, communityId: string, userId: string, reason?: string): Promise<CommunityMemberActionResult> {
      try {
        const { data, error } = await caller(token).rpc("ban_member", { p_community_id: communityId, p_user_id: userId, p_reason: reason ?? null });
        if (error) {
          logServiceError({ service: "community", operation: "banMember", error });
          const mapped = mapError(error.code ?? "", error.message ?? "", "mod");
          if (mapped.status === "not_found") return { status: "not_found" };
          if (mapped.status === "forbidden") return { status: "forbidden" };
          if (mapped.status === "invalid") return { status: "invalid", code: (mapped.code ?? "NOT_MEMBER") as CommunityMemberActionResult extends { status: "invalid" } ? CommunityMemberActionResult["code"] : never };
          return { status: "unavailable" };
        }
        return { status: "ok", data: data as Record<string, unknown> };
      } catch (err) { logServiceError({ service: "community", operation: "banMember.exception", error: err }); return { status: "unavailable" }; }
    },

    async setMemberRole(token: string, communityId: string, userId: string, role: string): Promise<CommunityMemberActionResult> {
      try {
        const { data, error } = await caller(token).rpc("promote_member", { p_community_id: communityId, p_user_id: userId, p_role: role });
        if (error) {
          logServiceError({ service: "community", operation: "setMemberRole", error });
          const mapped = mapError(error.code ?? "", error.message ?? "", "mod");
          if (mapped.status === "not_found") return { status: "not_found" };
          if (mapped.status === "forbidden") return { status: "forbidden" };
          if (mapped.status === "invalid") return { status: "invalid", code: (mapped.code ?? "INVALID_ROLE") as CommunityMemberActionResult extends { status: "invalid" } ? CommunityMemberActionResult["code"] : never };
          return { status: "unavailable" };
        }
        return { status: "ok", data: data as Record<string, unknown> };
      } catch (err) { logServiceError({ service: "community", operation: "setMemberRole.exception", error: err }); return { status: "unavailable" }; }
    },

    async listPublic(cursor: string | null, limit: number, query?: string | null): Promise<CommunityListResult> {
      try {
        const { data, error } = await caller().rpc("list_communities", { p_cursor: cursor, p_limit: limit, p_query: query ?? null });
        if (error) { logServiceError({ service: "community", operation: "list", error }); return { status: "unavailable" }; }
        const row = data as { communities?: Record<string, unknown>[]; next_cursor?: string | null };
        return { status: "ok", data: { communities: row.communities ?? [], nextCursor: row.next_cursor ?? null } };
      } catch (err) { logServiceError({ service: "community", operation: "list.exception", error: err }); return { status: "unavailable" }; }
    },

    async getPublic(slugOrId: string): Promise<CommunityGetResult> {
      try {
        const { data, error } = await caller().rpc("get_community", { p_slug_or_id: slugOrId });
        if (error) { logServiceError({ service: "community", operation: "get", error }); return { status: "unavailable" }; }
        if (data === null) return { status: "not_found" };
        return { status: "ok", data: data as Record<string, unknown> };
      } catch (err) { logServiceError({ service: "community", operation: "get.exception", error: err }); return { status: "unavailable" }; }
    },

    async listMembers(communityId: string, cursor: string | null, limit: number): Promise<CommunityMemberListResult> {
      try {
        const { data, error } = await caller().rpc("list_community_members", { p_community_id: communityId, p_cursor: cursor, p_limit: limit });
        if (error) { logServiceError({ service: "community", operation: "listMembers", error }); return { status: "unavailable" }; }
        const row = data as { members?: Record<string, unknown>[]; next_cursor?: string | null };
        return { status: "ok", data: { members: row.members ?? [], nextCursor: row.next_cursor ?? null } };
      } catch (err) { logServiceError({ service: "community", operation: "listMembers.exception", error: err }); return { status: "unavailable" }; }
    },

    async checkMembership(communityId: string): Promise<CommunityMembershipCheckResult> {
      try {
        const { data, error } = await caller().rpc("is_community_member", { p_community_id: communityId });
        if (error) { logServiceError({ service: "community", operation: "checkMembership", error }); return { status: "unavailable" }; }
        const row = data as { is_member?: boolean; is_moderator?: boolean; is_owner?: boolean; is_pending?: boolean; is_banned?: boolean };
        return { status: "ok", data: { is_member: Boolean(row.is_member), is_moderator: Boolean(row.is_moderator), is_owner: Boolean(row.is_owner), is_pending: Boolean(row.is_pending), is_banned: Boolean(row.is_banned) } };
      } catch (err) { logServiceError({ service: "community", operation: "checkMembership.exception", error: err }); return { status: "unavailable" }; }
    },
  };
}

export type CommunityService = ReturnType<typeof createSupabaseCommunityService>;
