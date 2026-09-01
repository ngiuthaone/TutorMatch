import { createClient } from "@supabase/supabase-js";
import type { AuthService } from "./auth-service.js";

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export type FollowResult =
  | { status: "ok"; data: { followee: string; following: boolean } }
  | { status: "not_found" }
  | { status: "invalid"; code: "CANNOT_FOLLOW_SELF" }
  | { status: "unavailable" };

export type FollowListResult =
  | { status: "ok"; data: { users: Record<string, unknown>[] } }
  | { status: "not_found" }
  | { status: "unavailable" };

export type IsFollowingResult =
  | { status: "ok"; data: { following: boolean } }
  | { status: "not_found" }
  | { status: "unavailable" };

function mapFollowError(code: string, message: string): FollowResult {
  if (code === "P0001") {
    if (message.includes("NOT_FOUND")) return { status: "not_found" };
    return { status: "unavailable" };
  }
  if (code === "22023") {
    if (message.includes("CANNOT_FOLLOW_SELF")) return { status: "invalid", code: "CANNOT_FOLLOW_SELF" };
    return { status: "unavailable" };
  }
  return { status: "unavailable" };
}

export function createSupabaseFollowService(url: string, publishableKey: string, _authService: AuthService) {
  const caller = (token?: string) => createClient(url, publishableKey, {
    auth: authOptions,
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });

  return {
    async follow(token: string, followeeName: string): Promise<FollowResult> {
      try {
        const { data, error } = await caller(token).rpc("follow_user", { p_followee_name: followeeName });
        if (error) return mapFollowError(error.code ?? "", error.message ?? "");
        const row = data as { followee?: string; following?: boolean };
        return { status: "ok", data: { followee: String(row.followee ?? ""), following: Boolean(row.following) } };
      } catch {
        return { status: "unavailable" };
      }
    },

    async unfollow(token: string, followeeName: string): Promise<FollowResult> {
      try {
        const { data, error } = await caller(token).rpc("unfollow_user", { p_followee_name: followeeName });
        if (error) return mapFollowError(error.code ?? "", error.message ?? "");
        const row = data as { followee?: string; following?: boolean };
        return { status: "ok", data: { followee: String(row.followee ?? ""), following: Boolean(row.following) } };
      } catch {
        return { status: "unavailable" };
      }
    },

    async isFollowing(followeeName: string): Promise<IsFollowingResult> {
      try {
        const { data, error } = await caller().rpc("is_following", { p_followee_name: followeeName });
        if (error) {
          if ((error.code ?? "") === "P0001") return { status: "not_found" };
          return { status: "unavailable" };
        }
        const row = data as { following?: boolean };
        return { status: "ok", data: { following: Boolean(row.following) } };
      } catch {
        return { status: "unavailable" };
      }
    },

    async listFollowers(userName: string): Promise<FollowListResult> {
      try {
        const { data, error } = await caller().rpc("list_followers", { p_user_name: userName });
        if (error) {
          if ((error.code ?? "") === "P0001") return { status: "not_found" };
          return { status: "unavailable" };
        }
        const row = data as { followers?: Record<string, unknown>[] };
        return { status: "ok", data: { users: row.followers ?? [] } };
      } catch {
        return { status: "unavailable" };
      }
    },

    async listFollowing(userName: string): Promise<FollowListResult> {
      try {
        const { data, error } = await caller().rpc("list_following", { p_user_name: userName });
        if (error) {
          if ((error.code ?? "") === "P0001") return { status: "not_found" };
          return { status: "unavailable" };
        }
        const row = data as { following?: Record<string, unknown>[] };
        return { status: "ok", data: { users: row.following ?? [] } };
      } catch {
        return { status: "unavailable" };
      }
    },
  };
}

export type FollowService = ReturnType<typeof createSupabaseFollowService>;
