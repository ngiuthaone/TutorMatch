import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logServiceError } from "../lib/service-error.js";

export type MessagingConversation = {
  id: string;
  bookingId: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
  viewerRole: "host" | "learner";
  participant: { userId: string; role: "host" | "learner"; displayName: string };
  bookingContext:
    | {
        bookingId: string;
        sessionId: string;
        sessionStartsAt: string;
        sessionEndsAt: string;
        bookingStatus: string;
      }
    | null;
  lastMessage: {
    id: string;
    senderId: string;
    body: string;
    createdAt: string;
    moderationStatus: string;
  } | null;
};

export type MessagingMessage = {
  id: string;
  senderId: string;
  mine: boolean;
  body: string;
  createdAt: string;
  moderationStatus: string;
};

export type MessagingAttachment = {
  id: string;
  messageId: string;
  storageBucket: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type MessagingResult<T> =
  | { status: "ok"; data: T }
  | { status: "unavailable" };

export type MessagingReadResult<T> =
  | { status: "ok"; data: T }
  | { status: "not_found" | "forbidden" | "unavailable" };

export type MessagingSendResult =
  | { status: "ok"; data: MessagingMessage; duplicate: boolean }
  | { status: "forbidden" }
  | { status: "blocked" }
  | { status: "invalid" }
  | { status: "unavailable" };

export function defaultClientFactory(url: string, publishableKey: string): (token?: string) => SupabaseClient {
  return (token?: string) => createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}

/** Server-authoritative read. Uses the caller's JWT so RLS/authz in the
 *  security-definer RPCs remains the trust boundary. */
export function createSupabaseMessagingService(
  url: string,
  publishableKey: string,
  clientFactory: (token?: string) => SupabaseClient = defaultClientFactory(url, publishableKey),
) {
  const caller = clientFactory;

  async function rpc<T>(token: string, name: string, args: Record<string, unknown>): Promise<MessagingResult<T>> {
    try {
      const { data, error } = await caller(token).rpc(name, args);
      if (error) return { status: "unavailable" };
      return { status: "ok", data: data as T };
    } catch (error) {
      logServiceError({ service: "messaging-service", operation: "rpc", error });
      return { status: "unavailable" };
    }
  }

  return {
    async listConversations(token: string): Promise<MessagingResult<MessagingConversation[]>> {
      return rpc<MessagingConversation[]>(token, "list_my_conversations", {});
    },

    async getConversation(token: string, conversationId: string): Promise<MessagingReadResult<MessagingConversation>> {
      const result = await rpc<MessagingConversation>(token, "get_conversation", { cid: conversationId });
      if (result.status === "unavailable") return { status: "unavailable" };
      if (result.status === "ok" && result.data) return { status: "ok", data: result.data };
      return { status: "not_found" };
    },

    async getOrCreateBookingConversation(token: string, bookingId: string): Promise<MessagingReadResult<MessagingConversation>> {
      try {
        const { data, error } = await caller(token).rpc("get_or_create_booking_conversation", { p_booking_id: bookingId });
        if (error) {
          // 42501 = insufficient_privilege: caller is not host/learner for that booking.
          if (error.code === "42501" || /insufficient_privilege|forbidden/i.test(error.message)) {
            return { status: "forbidden" };
          }
          return { status: "unavailable" };
        }
        if (!data) return { status: "not_found" };
        return { status: "ok", data: data as MessagingConversation };
      } catch (error) {
        logServiceError({ service: "messaging-service", operation: "getOrCreateBookingConversation", error });
        return { status: "unavailable" };
      }
    },

    async listMessages(token: string, conversationId: string, limit = 100, before?: string): Promise<MessagingReadResult<MessagingMessage[]>> {
      try {
        const args: Record<string, unknown> = { cid: conversationId, p_limit: limit };
        if (before) args.p_before = before;
        const { data, error } = await caller(token).rpc("list_conversation_messages", args);
        if (error) {
          if (error.code === "42501" || /insufficient_privilege|forbidden/i.test(error.message)) {
            return { status: "forbidden" };
          }
          return { status: "unavailable" };
        }
        return { status: "ok", data: (data as MessagingMessage[]) ?? [] };
      } catch (error) {
        logServiceError({ service: "messaging-service", operation: "listMessages", error });
        return { status: "unavailable" };
      }
    },

    async listAttachments(token: string, messageId: string): Promise<MessagingReadResult<MessagingAttachment[]>> {
      try {
        const { data, error } = await caller(token).rpc("list_message_attachments", { p_message_id: messageId });
        if (error) {
          if (error.code === "P0001") return { status: "not_found" };
          if (error.code === "42501" || /insufficient_privilege|forbidden/i.test(error.message)) {
            return { status: "forbidden" };
          }
          return { status: "unavailable" };
        }
        return { status: "ok", data: (data as MessagingAttachment[]) ?? [] };
      } catch (error) {
        logServiceError({ service: "messaging-service", operation: "listAttachments", error });
        return { status: "unavailable" };
      }
    },

    async sendMessage(
      token: string,
      conversationId: string,
      clientMessageId: string,
      body: string,
    ): Promise<MessagingSendResult> {
      try {
        const { data, error } = await caller(token).rpc("send_message", {
          cid: conversationId,
          p_client_message_id: clientMessageId,
          p_body: body,
        });
        if (error) {
          // Distinguish "blocked by user_blocks" (deterministic, the
          // sender or recipient has a row in public.user_blocks) from
          // generic "not a member" (insufficient_privilege). The BLOCKED
          // error code from the RPC is mapped to a dedicated `blocked`
          // status so the route can return a specific 403 with code
          // BLOCKED.
          if (/BLOCKED/i.test(error.message)) {
            return { status: "blocked" };
          }
          if (error.code === "42501" || /insufficient_privilege|forbidden/i.test(error.message)) {
            return { status: "forbidden" };
          }
          if (error.code === "22023" || /INVALID_MESSAGE|IDEMPOTENCY_CONFLICT/i.test(error.message)) {
            return { status: "invalid" };
          }
          return { status: "unavailable" };
        }
        if (!data) return { status: "unavailable" };
        const message = data as MessagingMessage & { duplicate?: boolean };
        return { status: "ok", data: message, duplicate: Boolean(message.duplicate) };
      } catch (error) {
        logServiceError({ service: "messaging-service", operation: "sendMessage", error });
        return { status: "unavailable" };
      }
    },

    async markRead(token: string, conversationId: string): Promise<MessagingReadResult<{ conversationId: string; lastReadAt: string }>> {
      try {
        const { data, error } = await caller(token).rpc("mark_conversation_read", { cid: conversationId });
        if (error) {
          if (error.code === "42501" || /insufficient_privilege|forbidden/i.test(error.message)) {
            return { status: "forbidden" };
          }
          return { status: "unavailable" };
        }
        return { status: "ok", data: data as { conversationId: string; lastReadAt: string } };
      } catch (error) {
        logServiceError({ service: "messaging-service", operation: "markRead", error });
        return { status: "unavailable" };
      }
    },

    async searchConversations(token: string, query: string): Promise<MessagingResult<MessagingConversation[]>> {
      try {
        const { data, error } = await caller(token).rpc("search_conversations", { p_query: query });
        if (error) {
          if (error.code === "42501" || /insufficient_privilege|forbidden/i.test(error.message)) {
            return { status: { status: "unavailable" } } as unknown as MessagingResult<MessagingConversation[]>;
          }
          return { status: "unavailable" };
        }
        const list = (data as MessagingConversation[]) ?? [];
        return { status: "ok", data: list };
      } catch (error) {
        logServiceError({ service: "messaging-service", operation: "searchConversations", error });
        return { status: "unavailable" };
      }
    },

    async editMessage(token: string, messageId: string, body: string): Promise<MessagingReadResult<MessagingMessage>> {
      try {
        const { data, error } = await caller(token).rpc("edit_message", { p_message_id: messageId, p_new_body: body });
        if (error) {
          if (error.code === "42501" || /insufficient_privilege|forbidden/i.test(error.message)) {
            return { status: "forbidden" };
          }
          if (error.code === "P0001") return { status: "not_found" };
          if (error.code === "22023") return { status: "unavailable" };
          return { status: "unavailable" };
        }
        return { status: "ok", data: data as MessagingMessage };
      } catch (error) {
        logServiceError({ service: "messaging-service", operation: "editMessage", error });
        return { status: "unavailable" };
      }
    },

    async deleteMessage(token: string, messageId: string): Promise<MessagingReadResult<MessagingMessage>> {
      try {
        const { data, error } = await caller(token).rpc("soft_delete_message", { p_message_id: messageId });
        if (error) {
          if (error.code === "42501" || /insufficient_privilege|forbidden/i.test(error.message)) {
            return { status: "forbidden" };
          }
          if (error.code === "P0001") return { status: "not_found" };
          return { status: "unavailable" };
        }
        return { status: "ok", data: data as MessagingMessage };
      } catch (error) {
        logServiceError({ service: "messaging-service", operation: "deleteMessage", error });
        return { status: "unavailable" };
      }
    },

    async reportMessage(token: string, messageId: string, reason: string, details?: string): Promise<MessagingReadResult<{ id: string; status: string }>> {
      try {
        const { data, error } = await caller(token).rpc("report_message", { p_message_id: messageId, p_reason: reason, p_details: details ?? null });
        if (error) {
          if (error.code === "42501" || /insufficient_privilege|forbidden/i.test(error.message)) {
            return { status: "forbidden" };
          }
          if (error.code === "P0001") return { status: "not_found" };
          if (error.code === "22023") return { status: "unavailable" };
          return { status: "unavailable" };
        }
        return { status: "ok", data: data as { id: string; status: string } };
      } catch (error) {
        logServiceError({ service: "messaging-service", operation: "reportMessage", error });
        return { status: "unavailable" };
      }
    },

    async blockUser(token: string, targetUserId: string): Promise<MessagingReadResult<{ blocker: string; blocked: string }>> {
      try {
        const { data, error } = await caller(token).rpc("block_user", { p_target_user_id: targetUserId });
        if (error) {
          if (error.code === "42501" || /insufficient_privilege|forbidden/i.test(error.message)) {
            return { status: "forbidden" };
          }
          if (error.code === "P0001") return { status: "not_found" };
          return { status: "unavailable" };
        }
        return { status: "ok", data: data as { blocker: string; blocked: string } };
      } catch (error) {
        logServiceError({ service: "messaging-service", operation: "blockUser", error });
        return { status: "unavailable" };
      }
    },

    async unblockUser(token: string, targetUserId: string): Promise<MessagingReadResult<{ blocker: string; blocked: string }>> {
      try {
        const { data, error } = await caller(token).rpc("unblock_user", { p_target_user_id: targetUserId });
        if (error) {
          if (error.code === "42501" || /insufficient_privilege|forbidden/i.test(error.message)) {
            return { status: "forbidden" };
          }
          return { status: "unavailable" };
        }
        return { status: "ok", data: data as { blocker: string; blocked: string } };
      } catch (error) {
        logServiceError({ service: "messaging-service", operation: "unblockUser", error });
        return { status: "unavailable" };
      }
    },
  };
}

export type MessagingService = ReturnType<typeof createSupabaseMessagingService>;
