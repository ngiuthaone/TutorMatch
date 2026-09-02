import { createClient } from "@supabase/supabase-js";
import type { AuthService } from "./auth-service.js";
import { logServiceError } from "../lib/service-error.js";

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export type ModerationResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "forbidden" }
  | { status: "not_found" }
  | { status: "unavailable" };

export function createSupabaseModerationService(url: string, publishableKey: string, _authService: AuthService) {
  const caller = (token?: string) => createClient(url, publishableKey, {
    auth: authOptions,
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });

  return {
    async pinPost(token: string, postId: string): Promise<ModerationResult> {
      return callRpc(await caller(token).rpc("pin_post", { p_post_id: postId }));
    },
    async unpinPost(token: string, postId: string): Promise<ModerationResult> {
      return callRpc(await caller(token).rpc("unpin_post", { p_post_id: postId }));
    },
    async lockPost(token: string, postId: string): Promise<ModerationResult> {
      return callRpc(await caller(token).rpc("lock_post", { p_post_id: postId }));
    },
    async unlockPost(token: string, postId: string): Promise<ModerationResult> {
      return callRpc(await caller(token).rpc("unlock_post", { p_post_id: postId }));
    },
    async removePost(token: string, postId: string, reason?: string): Promise<ModerationResult> {
      return callRpc(await caller(token).rpc("remove_post", { p_post_id: postId, p_reason: reason ?? null }));
    },
    async restorePost(token: string, postId: string): Promise<ModerationResult> {
      return callRpc(await caller(token).rpc("restore_post", { p_post_id: postId }));
    },
    async pinThread(token: string, threadId: string): Promise<ModerationResult> {
      return callRpc(await caller(token).rpc("pin_thread", { p_thread_id: threadId }));
    },
    async unpinThread(token: string, threadId: string): Promise<ModerationResult> {
      return callRpc(await caller(token).rpc("unpin_thread", { p_thread_id: threadId }));
    },
    async lockThread(token: string, threadId: string): Promise<ModerationResult> {
      return callRpc(await caller(token).rpc("lock_thread", { p_thread_id: threadId }));
    },
    async unlockThread(token: string, threadId: string): Promise<ModerationResult> {
      return callRpc(await caller(token).rpc("unlock_thread", { p_thread_id: threadId }));
    },
    async removeThread(token: string, threadId: string, reason?: string): Promise<ModerationResult> {
      return callRpc(await caller(token).rpc("remove_thread", { p_thread_id: threadId, p_reason: reason ?? null }));
    },
    async restoreThread(token: string, threadId: string): Promise<ModerationResult> {
      return callRpc(await caller(token).rpc("restore_thread", { p_thread_id: threadId }));
    },
  };
}

async function callRpc(promise: Promise<{ data: unknown; error: { code?: string; message?: string } | null }>): Promise<ModerationResult> {
  try {
    const { data, error } = await promise;
    if (error) {
      logServiceError({ service: "moderation", operation: "rpc", error });
      if (error.code === "42501") return { status: "forbidden" };
      if (error.code === "P0001") return { status: "not_found" };
      return { status: "unavailable" };
    }
    return { status: "ok", data: data as Record<string, unknown> };
  } catch (err) {
    logServiceError({ service: "moderation", operation: "rpc.exception", error: err });
    return { status: "unavailable" };
  }
}

export type ModerationService = ReturnType<typeof createSupabaseModerationService>;
