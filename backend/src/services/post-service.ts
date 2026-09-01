import { createClient } from "@supabase/supabase-js";
import type { AuthService } from "./auth-service.js";
import { logServiceError } from "../lib/service-error.js";

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export type PostCreateResult =
  | { status: "ok"; data: { id: string; status: string } }
  | { status: "invalid"; code: "INVALID_BODY" | "BODY_TOO_LARGE" | "INVALID_TYPE" | "INVALID_PERMISSION" | "EMAIL_VERIFICATION_REQUIRED" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type PostUpdateResult =
  | { status: "ok"; data: { id: string; status: string } }
  | { status: "invalid"; code: "BODY_TOO_LARGE" | "EMAIL_VERIFICATION_REQUIRED" }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type PostMutationResult =
  | { status: "ok"; data: { id: string; status: string } }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type PublicPostResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "not_found" }
  | { status: "unavailable" };

export type PublicPostListResult =
  | { status: "ok"; data: { posts: Record<string, unknown>[]; nextCursor: string | null } }
  | { status: "unavailable" };

export type MyPostListResult =
  | { status: "ok"; data: { posts: Record<string, unknown>[] } }
  | { status: "unavailable" };

export type PostRepostResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "not_found" }
  | { status: "unavailable" };

export type PostLikeResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "not_found" }
  | { status: "unavailable" };

function mapCreateError(code: string, message: string): PostCreateResult {
  if (code === "P0001" && message.includes("EMAIL_VERIFICATION_REQUIRED")) return { status: "invalid", code: "EMAIL_VERIFICATION_REQUIRED" };
  if (code === "42501" || message.includes("permission denied")) return { status: "forbidden" };
  if (code === "22023") {
    if (message.includes("BODY_TOO_LARGE")) return { status: "invalid", code: "BODY_TOO_LARGE" };
    if (message.includes("INVALID_TYPE")) return { status: "invalid", code: "INVALID_TYPE" };
    if (message.includes("INVALID_PERMISSION")) return { status: "invalid", code: "INVALID_PERMISSION" };
    return { status: "invalid", code: "INVALID_BODY" };
  }
  return { status: "unavailable" };
}

function mapUpdateError(code: string, message: string): PostUpdateResult {
  if (code === "P0001") {
    if (message.includes("EMAIL_VERIFICATION_REQUIRED")) return { status: "invalid", code: "EMAIL_VERIFICATION_REQUIRED" };
    return { status: "not_found" };
  }
  if (code === "42501" || message.includes("permission denied")) return { status: "forbidden" };
  if (code === "22023") {
    if (message.includes("BODY_TOO_LARGE")) return { status: "invalid", code: "BODY_TOO_LARGE" };
    return { status: "invalid", code: "EMAIL_VERIFICATION_REQUIRED" };
  }
  return { status: "unavailable" };
}

function mapMutationError(code: string, message: string): PostMutationResult {
  if (code === "P0001") return { status: "not_found" };
  if (code === "42501" || message.includes("permission denied")) return { status: "forbidden" };
  return { status: "unavailable" };
}

export function createSupabasePostService(url: string, publishableKey: string, _authService: AuthService) {
  const caller = (token?: string) => createClient(url, publishableKey, {
    auth: authOptions,
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });

  return {
    async create(
      token: string,
      input: { body: string; tags?: string[]; level?: string | null; postType?: string | null; replyPermission?: string | null; communityId?: string | null; imageUrl?: string | null },
    ): Promise<PostCreateResult> {
      try {
        const { data, error } = await caller(token).rpc("create_post", {
          p_body: input.body,
          p_tags: input.tags ?? [],
          p_level: input.level ?? null,
          p_post_type: input.postType ?? null,
          p_reply_permission: input.replyPermission ?? "everyone",
          p_community_id: input.communityId ?? null,
          p_image_url: input.imageUrl ?? null,
        });
        if (error) return mapCreateError(error.code ?? "", error.message ?? "");
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "published") } };
      } catch (error) {
        logServiceError({ service: "post-service", operation: "create", error });
        return { status: "unavailable" };
      }
    },

    async update(
      token: string,
      id: string,
      input: { body?: string; tags?: string[]; level?: string | null; postType?: string | null; replyPermission?: string | null; imageUrl?: string | null },
    ): Promise<PostUpdateResult> {
      try {
        const { data, error } = await caller(token).rpc("update_post", {
          p_id: id,
          p_body: input.body ?? null,
          p_tags: input.tags ?? null,
          p_level: input.level ?? null,
          p_post_type: input.postType ?? null,
          p_reply_permission: input.replyPermission ?? null,
          p_image_url: input.imageUrl ?? null,
        });
        if (error) return mapUpdateError(error.code ?? "", error.message ?? "");
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "published") } };
      } catch (error) {
        logServiceError({ service: "post-service", operation: "update", error });
        return { status: "unavailable" };
      }
    },

    async delete(token: string, id: string): Promise<PostMutationResult> {
      try {
        const { data, error } = await caller(token).rpc("delete_post", { p_id: id });
        if (error) return mapMutationError(error.code ?? "", error.message ?? "");
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "deleted") } };
      } catch (error) {
        logServiceError({ service: "post-service", operation: "delete", error });
        return { status: "unavailable" };
      }
    },

    async getPublic(id: string): Promise<PublicPostResult> {
      try {
        const { data, error } = await caller().rpc("get_public_post", { p_id: id });
        if (error) return { status: "unavailable" };
        if (data === null) return { status: "not_found" };
        return { status: "ok", data: data as Record<string, unknown> };
      } catch (error) {
        logServiceError({ service: "post-service", operation: "getPublic", error });
        return { status: "unavailable" };
      }
    },

    async listPublic(cursor: string | null, limit: number, tag?: string | null, postType?: string | null, authorName?: string | null): Promise<PublicPostListResult> {
      try {
        const { data, error } = await caller().rpc("list_public_posts", {
          p_cursor: cursor,
          p_limit: limit,
          p_tag: tag ?? null,
          p_post_type: postType ?? null,
          p_author_name: authorName ?? null,
        });
        if (error) return { status: "unavailable" };
        const row = data as { posts?: Record<string, unknown>[]; next_cursor?: string | null };
        return { status: "ok", data: { posts: row.posts ?? [], nextCursor: row.next_cursor ?? null } };
      } catch (error) {
        logServiceError({ service: "post-service", operation: "listPublic", error });
        return { status: "unavailable" };
      }
    },

    async listMyPosts(token: string): Promise<MyPostListResult> {
      try {
        const { data, error } = await caller(token).rpc("list_my_posts");
        if (error) return { status: "unavailable" };
        const row = data as { posts?: Record<string, unknown>[] };
        return { status: "ok", data: { posts: row.posts ?? [] } };
      } catch (error) {
        logServiceError({ service: "post-service", operation: "listMyPosts", error });
        return { status: "unavailable" };
      }
    },

    async repost(token: string, postId: string): Promise<PostRepostResult> {
      try {
        const { data, error } = await caller(token).rpc("repost_post", { p_post_id: postId });
        if (error) {
          if ((error.code ?? "") === "P0001") return { status: "not_found" };
          return { status: "unavailable" };
        }
        return { status: "ok", data: data as Record<string, unknown> };
      } catch (error) {
        logServiceError({ service: "post-service", operation: "repost", error });
        return { status: "unavailable" };
      }
    },

    async unrepost(token: string, postId: string): Promise<PostRepostResult> {
      try {
        const { data, error } = await caller(token).rpc("unrepost_post", { p_post_id: postId });
        if (error) return { status: "unavailable" };
        return { status: "ok", data: data as Record<string, unknown> };
      } catch (error) {
        logServiceError({ service: "post-service", operation: "unrepost", error });
        return { status: "unavailable" };
      }
    },

    async like(token: string, postId: string): Promise<PostLikeResult> {
      try {
        const { data, error } = await caller(token).rpc("like_post", { p_post_id: postId });
        if (error) {
          if ((error.code ?? "") === "P0001") return { status: "not_found" };
          return { status: "unavailable" };
        }
        return { status: "ok", data: data as Record<string, unknown> };
      } catch (error) {
        logServiceError({ service: "post-service", operation: "like", error });
        return { status: "unavailable" };
      }
    },

    async unlike(token: string, postId: string): Promise<PostLikeResult> {
      try {
        const { data, error } = await caller(token).rpc("unlike_post", { p_post_id: postId });
        if (error) return { status: "unavailable" };
        return { status: "ok", data: data as Record<string, unknown> };
      } catch (error) {
        logServiceError({ service: "post-service", operation: "unlike", error });
        return { status: "unavailable" };
      }
    },
  };
}

export type PostService = ReturnType<typeof createSupabasePostService>;
