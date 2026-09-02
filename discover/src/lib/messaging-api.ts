import { getApiBaseUrl } from "./auth/config";
import { getSessionAccessToken } from "./auth/session";

export class MessagingApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 0, message?: string) {
    super(message || code);
    this.name = "MessagingApiError";
    this.code = code;
    this.status = status;
  }
}

export type MessagingParticipant = {
  userId: string;
  role: "host" | "learner";
  displayName: string;
};

export type MessagingBookingContext = {
  bookingId: string;
  sessionId: string;
  sessionStartsAt: string;
  sessionEndsAt: string;
  bookingStatus: string;
};

export type MessagingConversation = {
  id: string;
  bookingId: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
  viewerRole: "host" | "learner";
  participant: MessagingParticipant;
  bookingContext: MessagingBookingContext | null;
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
  editedAt: string | null;
  deletedAt: string | null;
  messageType: "text" | "image" | "file" | "system" | "media";
  moderationStatus: string;
};

export type MessagingConversationPage = {
  conversation: MessagingConversation;
  messages: MessagingMessage[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ensureUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new MessagingApiError("INVALID_RESPONSE", 500, `${field} is not a valid UUID`);
  }
  return value;
}

function ensureString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new MessagingApiError("INVALID_RESPONSE", 500, `${field} is not a string`);
  return value;
}

function ensureIsoDate(value: unknown, field: string): string {
  const str = ensureString(value, field);
  if (Number.isNaN(Date.parse(str))) throw new MessagingApiError("INVALID_RESPONSE", 500, `${field} is not a date`);
  return str;
}

function ensureRole(value: unknown): "host" | "learner" {
  if (value !== "host" && value !== "learner") throw new MessagingApiError("INVALID_RESPONSE", 500);
  return value;
}

function participantFrom(value: unknown): MessagingParticipant {
  if (!value || typeof value !== "object") throw new MessagingApiError("INVALID_RESPONSE", 500);
  const p = value as { userId?: unknown; role?: unknown; displayName?: unknown };
  return {
    userId: ensureUuid(p.userId, "participant.userId"),
    role: ensureRole(p.role),
    displayName: ensureString(p.displayName, "participant.displayName"),
  };
}

function bookingContextFrom(value: unknown): MessagingBookingContext | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") throw new MessagingApiError("INVALID_RESPONSE", 500);
  const b = value as { bookingId?: unknown; sessionId?: unknown; sessionStartsAt?: unknown; sessionEndsAt?: unknown; bookingStatus?: unknown };
  return {
    bookingId: ensureUuid(b.bookingId, "bookingContext.bookingId"),
    sessionId: ensureUuid(b.sessionId, "bookingContext.sessionId"),
    sessionStartsAt: ensureIsoDate(b.sessionStartsAt, "bookingContext.sessionStartsAt"),
    sessionEndsAt: ensureIsoDate(b.sessionEndsAt, "bookingContext.sessionEndsAt"),
    bookingStatus: ensureString(b.bookingStatus, "bookingContext.bookingStatus"),
  };
}

function lastMessageFrom(value: unknown): MessagingConversation["lastMessage"] {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") throw new MessagingApiError("INVALID_RESPONSE", 500);
  const m = value as { id?: unknown; senderId?: unknown; body?: unknown; createdAt?: unknown; moderationStatus?: unknown };
  return {
    id: ensureUuid(m.id, "lastMessage.id"),
    senderId: ensureUuid(m.senderId, "lastMessage.senderId"),
    body: ensureString(m.body, "lastMessage.body"),
    createdAt: ensureIsoDate(m.createdAt, "lastMessage.createdAt"),
    moderationStatus: ensureString(m.moderationStatus, "lastMessage.moderationStatus"),
  };
}

function conversationFrom(value: unknown): MessagingConversation {
  if (!value || typeof value !== "object") throw new MessagingApiError("INVALID_RESPONSE", 500);
  const c = value as Record<string, unknown>;
  return {
    id: ensureUuid(c.id, "conversation.id"),
    bookingId: c.bookingId === null || c.bookingId === undefined ? null : ensureUuid(c.bookingId, "conversation.bookingId"),
    createdAt: ensureIsoDate(c.createdAt, "conversation.createdAt"),
    updatedAt: ensureIsoDate(c.updatedAt, "conversation.updatedAt"),
    lastMessageAt: ensureIsoDate(c.lastMessageAt, "conversation.lastMessageAt"),
    lastMessagePreview: ensureString(c.lastMessagePreview, "conversation.lastMessagePreview"),
    unreadCount: typeof c.unreadCount === "number" ? c.unreadCount : 0,
    viewerRole: ensureRole(c.viewerRole),
    participant: participantFrom(c.participant),
    bookingContext: bookingContextFrom(c.bookingContext),
    lastMessage: lastMessageFrom(c.lastMessage),
  };
}

function messageFrom(value: unknown): MessagingMessage {
  if (!value || typeof value !== "object") throw new MessagingApiError("INVALID_RESPONSE", 500);
  const m = value as Record<string, unknown>;
  return {
    id: ensureUuid(m.id, "message.id"),
    senderId: ensureUuid(m.senderId, "message.senderId"),
    mine: m.mine === true,
    body: ensureString(m.body, "message.body"),
    createdAt: ensureIsoDate(m.createdAt, "message.createdAt"),
    editedAt: m.editedAt === null || m.editedAt === undefined ? null : ensureIsoDate(m.editedAt, "message.editedAt"),
    deletedAt: m.deletedAt === null || m.deletedAt === undefined ? null : ensureIsoDate(m.deletedAt, "message.deletedAt"),
    messageType: ((): MessagingMessage["messageType"] => {
      const t = m.messageType;
      if (t === "text" || t === "image" || t === "file" || t === "system" || t === "media") return t;
      return "text";
    })(),
    moderationStatus: ensureString(m.moderationStatus, "message.moderationStatus"),
  };
}

async function jsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new MessagingApiError("INVALID_RESPONSE", response.status);
  }
}

function apiError(response: Response, payload: unknown): MessagingApiError {
  const error = (payload as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  const code = typeof error?.code === "string" ? error.code : "MESSAGING_UNAVAILABLE";
  return new MessagingApiError(code, response.status, typeof error?.message === "string" ? error.message : undefined);
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; authenticated?: boolean; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.authenticated) {
    const token = getSessionAccessToken();
    if (!token) throw new MessagingApiError("UNAUTHORIZED", 401);
    headers.Authorization = `Bearer ${token}`;
  }
  const init: RequestInit = {
    method: options.method || "GET",
    headers,
    credentials: "omit",
    cache: "no-store",
  };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  if (options.signal) init.signal = options.signal;
  const response = await fetch(`${getApiBaseUrl().replace(/\/$/, "")}${path}`, init);
  const payload = await jsonResponse(response);
  if (!response.ok) throw apiError(response, payload);
  return payload as T;
}

const BASE = "/api/v1/messaging";

/** Generates a stable per-attempt client message id. Caller-provided keys are
 *  preferred (idempotent retries must reuse the same key). */
export function generateClientMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `cmsg-${crypto.randomUUID()}`;
  }
  return `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function listConversations(signal?: AbortSignal): Promise<MessagingConversation[]> {
  const opts = signal ? { signal } : {};
  const payload = await request<{ ok?: unknown; conversations?: unknown[] }>(`${BASE}/conversations`, { authenticated: true, ...opts });
  if (payload.ok !== true || !Array.isArray(payload.conversations)) throw new MessagingApiError("INVALID_RESPONSE", 500);
  return payload.conversations.map(conversationFrom);
}

export async function getConversation(conversationId: string, signal?: AbortSignal): Promise<MessagingConversation> {
  const opts = signal ? { signal } : {};
  const payload = await request<{ ok?: unknown; conversation?: unknown }>(`${BASE}/conversations/${encodeURIComponent(conversationId)}`, { authenticated: true, ...opts });
  if (payload.ok !== true) throw new MessagingApiError("INVALID_RESPONSE", 500);
  return conversationFrom(payload.conversation);
}

export async function getOrCreateBookingConversation(bookingId: string, signal?: AbortSignal): Promise<MessagingConversation> {
  const opts = signal ? { signal } : {};
  const payload = await request<{ ok?: unknown; conversation?: unknown }>(`${BASE}/bookings/${encodeURIComponent(bookingId)}/conversation`, { authenticated: true, ...opts });
  if (payload.ok !== true) throw new MessagingApiError("INVALID_RESPONSE", 500);
  return conversationFrom(payload.conversation);
}

export async function listMessages(conversationId: string, limit = 100, signal?: AbortSignal): Promise<MessagingMessage[]> {
  const opts = signal ? { signal } : {};
  const payload = await request<{ ok?: unknown; messages?: unknown[] }>(`${BASE}/conversations/${encodeURIComponent(conversationId)}/messages?limit=${limit}`, { authenticated: true, ...opts });
  if (payload.ok !== true || !Array.isArray(payload.messages)) throw new MessagingApiError("INVALID_RESPONSE", 500);
  return payload.messages.map(messageFrom);
}

export async function sendMessage(conversationId: string, body: string, clientMessageId: string): Promise<MessagingMessage> {
  const payload = await request<{ ok?: unknown; message?: unknown; duplicate?: boolean }>(`${BASE}/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    body: { clientMessageId, body },
    authenticated: true,
  });
  if (payload.ok !== true) throw new MessagingApiError("INVALID_RESPONSE", 500);
  return messageFrom(payload.message);
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await request<{ ok?: unknown; conversationId?: unknown; lastReadAt?: unknown }>(`${BASE}/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: "POST",
    authenticated: true,
  });
}

export async function loadConversationPage(conversationId: string, signal?: AbortSignal): Promise<MessagingConversationPage> {
  const [conversation, messages] = await Promise.all([
    getConversation(conversationId, signal),
    listMessages(conversationId, 200, signal),
  ]);
  return { conversation, messages };
}

export async function searchConversations(query: string, signal?: AbortSignal): Promise<MessagingConversation[]> {
  if (!query.trim()) return [];
  const url = `${BASE}/conversations?q=${encodeURIComponent(query)}`;
  const payload = await request<{ ok?: unknown; conversations?: unknown[] }>(url, { authenticated: true, ...(signal ? { signal } : {}) });
  if (payload.ok !== true || !Array.isArray(payload.conversations)) throw new MessagingApiError("INVALID_RESPONSE", 500);
  return payload.conversations.map(conversationFrom);
}

export type ReportReason = "harassment" | "spam" | "scam" | "inappropriate" | "abuse" | "other";

export async function editMessage(messageId: string, body: string): Promise<MessagingMessage> {
  const payload = await request<{ ok?: unknown; message?: unknown }>(`${BASE}/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    body: { body },
    authenticated: true,
  });
  if (payload.ok !== true) throw new MessagingApiError("INVALID_RESPONSE", 500);
  return messageFrom(payload.message);
}

export async function deleteMessage(messageId: string): Promise<MessagingMessage> {
  const payload = await request<{ ok?: unknown; message?: unknown }>(`${BASE}/messages/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
    authenticated: true,
  });
  if (payload.ok !== true) throw new MessagingApiError("INVALID_RESPONSE", 500);
  return messageFrom(payload.message);
}

export async function reportMessage(messageId: string, reason: ReportReason, details?: string): Promise<{ id: string; status: string }> {
  const payload = await request<{ ok?: unknown; report?: { id?: unknown; status?: unknown } }>(
    `${BASE}/messages/${encodeURIComponent(messageId)}/report`,
    { method: "POST", body: { reason, ...(details ? { details } : {}) }, authenticated: true },
  );
  if (payload.ok !== true || !payload.report) throw new MessagingApiError("INVALID_RESPONSE", 500);
  return { id: String(payload.report.id ?? ""), status: String(payload.report.status ?? "pending") };
}

export async function blockUser(userId: string): Promise<void> {
  await request<{ ok?: unknown }>(`${BASE}/users/${encodeURIComponent(userId)}/block`, { method: "POST", authenticated: true });
}

export async function unblockUser(userId: string): Promise<void> {
  await request<{ ok?: unknown }>(`${BASE}/users/${encodeURIComponent(userId)}/block`, { method: "DELETE", authenticated: true });
}

// Realtime: subscribe to new messages on a single conversation. Returns an
// unsubscribe function. The channel is server-side authorized via Supabase
// RLS on public.messages, so a caller can only see inserts for
// conversations they are a member of.
export function subscribeToConversationMessages(
  conversationId: string,
  onMessage: (msg: MessagingMessage) => void,
  signal?: AbortSignal,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  // Lazy import to keep the messaging-api usable in non-browser contexts.
  let unsubscribe = () => undefined;
  let cancelled = false;
  void (async () => {
    try {
      const supabase = (await import("@/lib/auth/supabase-client")).getSupabaseClient();
      if (cancelled) return;
      if (!supabase) return; // Not configured for live mode — caller is in demo.
      const channel = supabase
        .channel(`messaging:conversation:${conversationId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            try {
              const row = payload.new as Record<string, unknown>;
              onMessage(messageFrom(row));
            } catch (error) {
              console.error("subscribeToConversationMessages: failed to parse payload", error);
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            try {
              const row = payload.new as Record<string, unknown>;
              onMessage(messageFrom(row));
            } catch (error) {
              console.error("subscribeToConversationMessages: failed to parse update", error);
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            try {
              const row = payload.old as Record<string, unknown>;
              // Dispatch a synthetic message with deletedAt to allow the
              // UI to remove it without an extra round-trip.
              onMessage({
                id: ensureUuid(row.id, "deleted.message.id"),
                senderId: "00000000-0000-0000-0000-000000000000",
                mine: false,
                body: "",
                createdAt: new Date().toISOString(),
                editedAt: null,
                deletedAt: new Date().toISOString(),
                messageType: "text",
                moderationStatus: "approved",
              });
            } catch (error) {
              console.error("subscribeToConversationMessages: failed to parse delete", error);
            }
          },
        )
        .subscribe();
      unsubscribe = () => {
        void supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error("subscribeToConversationMessages: subscribe failed", error);
    }
  })();
  if (signal) {
    const onAbort = () => {
      cancelled = true;
      unsubscribe();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  }
  return () => {
    cancelled = true;
    unsubscribe();
  };
}

// ── Attachments ────────────────────────────────────────────────────────
//
// Adapted from tutorstartup's useFileUpload (MIT, fd6887b). The pattern is:
//   1. Pick a file via the file picker.
//   2. Validate type + size client-side.
//   3. Upload to Supabase Storage at <conversation_id>/<message_id>/<file>.
//   4. POST the metadata to the conversation (via create_message_with_attachments).
//   5. The RLS policy on storage.objects grants read access to conversation
//      members; signed URLs are obtained at read time.
//
// Tutoria uses a dedicated path layout per Tutoria's storage RLS policy:
//   <conversation_id>/<message_id>/<filename>
//   1st segment = conversation UUID (must be a member)
//   2nd segment = message UUID (must be the sender)
//   3rd segment = filename
//
// 100 MB cap, 15 allowed MIME types (image/*, pdf, text/*, zip, MS Office).
export type MessageAttachment = {
  id: string;
  messageId: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  signedUrl: string | null;
  createdAt: string;
};

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const ALLOWED_MIME = new Set<string>([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
  "application/pdf", "text/plain", "text/csv",
  "application/zip", "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export type AttachmentValidationResult =
  | { status: "ok"; detectedType: "image" | "file" | "video" | "audio" }
  | { status: "too_large" }
  | { status: "unsupported_type" };

export function validateAttachment(file: File): AttachmentValidationResult {
  if (file.size > MAX_FILE_BYTES) return { status: "too_large" };
  if (!ALLOWED_MIME.has(file.type)) return { status: "unsupported_type" };
  let detectedType: "image" | "file" | "video" | "audio" = "file";
  if (file.type.startsWith("image/")) detectedType = "image";
  else if (file.type.startsWith("video/")) detectedType = "video";
  else if (file.type.startsWith("audio/")) detectedType = "audio";
  return { status: "ok", detectedType };
}

export async function uploadMessageAttachment(
  conversationId: string,
  messageId: string,
  file: File,
  signal?: AbortSignal,
): Promise<{ status: "ok"; storagePath: string } | { status: "unavailable" } | { status: "forbidden" }> {
  if (typeof window === "undefined") return { status: "unavailable" };
  const { getSupabaseClient } = await import("@/lib/auth/supabase-client");
  const supabase = getSupabaseClient();
  if (!supabase) return { status: "unavailable" };
  const storagePath = `${conversationId}/${messageId}/${crypto.randomUUID()}-${file.name}`;
  const init: RequestInit = {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
    ...(signal ? { signal } : {}),
  } as unknown as RequestInit;
  // supabase storage does not pass through a RequestInit cacheControl;
  // use the typed builder instead
  const { error } = await supabase.storage
    .from("message-attachments")
    .upload(storagePath, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) {
    if (error.message.toLowerCase().includes("policy") || /42501|forbidden/.test(error.message)) {
      return { status: "forbidden" };
    }
    return { status: "unavailable" };
  }
  return { status: "ok", storagePath };
}

export async function getAttachmentSignedUrl(
  storagePath: string,
  ttlSeconds = 60 * 60 * 24, // 24 hours
  signal?: AbortSignal,
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const { getSupabaseClient } = await import("@/lib/auth/supabase-client");
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from("message-attachments")
    .createSignedUrl(storagePath, ttlSeconds);
  if (error || !data) return null;
  void signal; // signal is not directly supported on the storage SDK; the
  // browser will close the network connection when AbortSignal fires.
  return data.signedUrl;
}

export type CreateMessageWithAttachmentsPayload = {
  body: string;
  messageType: "text" | "image" | "file" | "media";
  attachments: Array<{
    storage_path: string;
    storage_bucket: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
  }>;
};

export type CreateMessageResult =
  | { status: "ok"; data: MessagingMessage; duplicate: boolean }
  | { status: "invalid" | "forbidden" | "not_found" | "unavailable" };

export async function createMessageWithAttachments(
  conversationId: string,
  clientMessageId: string,
  payload: CreateMessageWithAttachmentsPayload,
  signal?: AbortSignal,
): Promise<CreateMessageResult> {
  try {
    const supabase = (await import("@/lib/auth/supabase-client")).getSupabaseClient();
    if (!supabase) return { status: "unavailable" };
    const { data, error } = await supabase.rpc("create_message_with_attachments", {
      p_conversation_id: conversationId,
      p_client_message_id: clientMessageId,
      p_body: payload.body,
      p_message_type: payload.messageType,
      p_attachments: payload.attachments,
    });
    if (error) {
      if (error.code === "42501" || /insufficient_privilege|forbidden/i.test(error.message)) {
        return { status: "forbidden" };
      }
      if (error.code === "22023") return { status: "invalid" };
      if (error.code === "P0001") return { status: "not_found" };
      return { status: "unavailable" };
    }
    if (!data) return { status: "unavailable" };
    const row = data as Record<string, unknown> & { duplicate?: boolean };
    return { status: "ok", data: messageFrom(row), duplicate: Boolean(row.duplicate) };
  } catch (error) {
    void signal;
    return { status: "unavailable" };
  }
}

// ── Cursor pagination (cursor-based) ────────────────────────────────────
//
// Replaces offset-based pagination. The server already supports a `before`
// cursor (timestamps). The client appends older messages on demand.
//
// Adapted from zingle's LoadMoreMessages (STUDY_ONLY repo, no license;
// pattern re-implemented from public behavior): a sentinel that indicates
// whether more pages exist, and a dedup-by-id map that merges older pages
// into the existing list without disturbing scroll position.

export type MessagesPage =
  | { status: "ok"; messages: MessagingMessage[]; hasMore: boolean; oldestCreatedAt: string | null }
  | { status: "forbidden" | "not_found" | "unavailable" };

export async function loadOlderMessages(
  conversationId: string,
  oldestCreatedAt: string,
  limit = 50,
  signal?: AbortSignal,
): Promise<MessagesPage> {
  try {
    const url = `${BASE}/conversations/${encodeURIComponent(conversationId)}/messages?limit=${limit}&before=${encodeURIComponent(oldestCreatedAt)}`;
    const payload = await request<{ ok?: unknown; messages?: unknown[] }>(url, { authenticated: true, ...(signal ? { signal } : {}) });
    if (payload.ok !== true || !Array.isArray(payload.messages)) {
      throw new MessagingApiError("INVALID_RESPONSE", 500);
    }
    const messages = payload.messages.map(messageFrom);
    const hasMore = messages.length === limit;
    return {
      status: "ok",
      messages,
      hasMore,
      oldestCreatedAt: messages.length > 0 ? messages[0].createdAt : null,
    };
  } catch (caught) {
    if (caught instanceof MessagingApiError && caught.code === "FORBIDDEN") {
      return { status: "forbidden" };
    }
    return { status: "unavailable" };
  }
}