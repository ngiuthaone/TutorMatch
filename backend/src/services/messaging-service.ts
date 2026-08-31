import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

export type MessagingResult<T> =
  | { status: "ok"; data: T }
  | { status: "unavailable" };

export type MessagingReadResult<T> =
  | { status: "ok"; data: T }
  | { status: "not_found" | "forbidden" | "unavailable" };

export type MessagingSendResult =
  | { status: "ok"; data: MessagingMessage; duplicate: boolean }
  | { status: "forbidden" | "invalid" | "unavailable" };

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
    } catch {
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
      } catch {
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
      } catch {
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
      } catch {
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
      } catch {
        return { status: "unavailable" };
      }
    },
  };
}

export type MessagingService = ReturnType<typeof createSupabaseMessagingService>;