import { createClient } from "@supabase/supabase-js";
import type { AuthService } from "./auth-service.js";

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export type NotificationListResult =
  | { status: "ok"; data: { notifications: Record<string, unknown>[]; nextCursor: string | null } }
  | { status: "unavailable" };

export type NotificationCountResult =
  | { status: "ok"; data: { count: number } }
  | { status: "unavailable" };

export type NotificationMutationResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "unavailable" };

export function createSupabaseNotificationService(url: string, publishableKey: string, _authService: AuthService) {
  const caller = (token?: string) => createClient(url, publishableKey, {
    auth: authOptions,
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });

  return {
    async listNotifications(token: string, cursor: string | null = null, limit: number = 20): Promise<NotificationListResult> {
      try {
        const { data, error } = await caller(token).rpc("list_notifications", { p_cursor: cursor, p_limit: limit });
        if (error) return { status: "unavailable" };
        const row = data as { notifications?: Record<string, unknown>[]; next_cursor?: string | null };
        return { status: "ok", data: { notifications: row.notifications ?? [], nextCursor: row.next_cursor ?? null } };
      } catch {
        return { status: "unavailable" };
      }
    },

    async getUnreadCount(token: string): Promise<NotificationCountResult> {
      try {
        const { data, error } = await caller(token).rpc("get_unread_notification_count");
        if (error) return { status: "unavailable" };
        const row = data as { count?: number };
        return { status: "ok", data: { count: row.count ?? 0 } };
      } catch {
        return { status: "unavailable" };
      }
    },

    async markRead(token: string, id: string): Promise<NotificationMutationResult> {
      try {
        const { data, error } = await caller(token).rpc("mark_notification_read", { p_id: id });
        if (error) return { status: "unavailable" };
        return { status: "ok", data: data as Record<string, unknown> };
      } catch {
        return { status: "unavailable" };
      }
    },

    async markAllRead(token: string): Promise<NotificationMutationResult> {
      try {
        const { data, error } = await caller(token).rpc("mark_all_notifications_read");
        if (error) return { status: "unavailable" };
        return { status: "ok", data: data as Record<string, unknown> };
      } catch {
        return { status: "unavailable" };
      }
    },

    async createNotification(
      token: string,
      recipientId: string,
      actorId: string | null,
      type: string,
      entityType: string,
      entityId: string,
      message: string,
    ): Promise<{ status: "ok"; data: { id: string } } | { status: "unavailable" }> {
      try {
        const { data, error } = await caller(token).rpc("create_notification", {
          p_recipient_id: recipientId,
          p_actor_id: actorId,
          p_type: type,
          p_entity_type: entityType,
          p_entity_id: entityId,
          p_message: message,
        });
        if (error) return { status: "unavailable" };
        return { status: "ok", data: { id: String(data) } };
      } catch {
        return { status: "unavailable" };
      }
    },
  };
}

export type NotificationService = ReturnType<typeof createSupabaseNotificationService>;
