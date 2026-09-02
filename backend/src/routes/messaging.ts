import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { MessagingService } from "../services/messaging-service.js";

const uuid = z.string().uuid();
const idParam = z.object({ id: uuid });

const sendBody = z.object({
  clientMessageId: z.string().trim().min(8).max(128),
  body: z.string().trim().min(1).max(2000),
});

const bookingParam = z.object({ bookingId: uuid });

const listMessagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  before: z.string().datetime({ offset: true }).optional(),
});

function failConversation(status: "not_found" | "forbidden" | "unavailable"): never {
  if (status === "not_found") throw new ApiError(404, "CONVERSATION_NOT_FOUND", "Conversation was not found.");
  if (status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You are not a member of this conversation.");
  throw new ApiError(503, "MESSAGING_UNAVAILABLE", "Messaging is temporarily unavailable.");
}

function failSend(status: "forbidden" | "blocked" | "invalid" | "unavailable"): never {
  if (status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You are not a member of this conversation.");
  if (status === "blocked") throw new ApiError(403, "BLOCKED", "You have blocked this conversation or the other party has blocked you.");
  if (status === "invalid") throw new ApiError(400, "INVALID_MESSAGE", "Message is invalid.");
  throw new ApiError(503, "MESSAGING_UNAVAILABLE", "Messaging is temporarily unavailable.");
}

function failAvailability(status: "unavailable"): never {
  throw new ApiError(503, "MESSAGING_UNAVAILABLE", "Messaging is temporarily unavailable.");
}

export const messagingRoutes: FastifyPluginAsync<{
  service: MessagingService;
  readMax: number;
  sendMax: number;
  windowMs: number;
}> = async (app, options) => {
  // GET /api/v1/messaging/conversations — list the caller's conversations.
  // Optional `?q=` for full-text search across conversation title + the
  // other party's display name + last-message preview.
  app.get("/api/v1/messaging/conversations", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } },
  }, async (request) => {
    const q = String((request.query as { q?: unknown }).q ?? "").trim();
    if (q.length > 0) {
      if (q.length > 200) throw new ApiError(400, "INVALID_QUERY", "Search query is too long.");
      const result = await options.service.searchConversations(request.auth.accessToken, q);
      if (result.status === "unavailable") throw new ApiError(503, "MESSAGING_UNAVAILABLE", "Messaging is temporarily unavailable.");
      return { ok: true, conversations: result.data };
    }
    const result = await options.service.listConversations(request.auth.accessToken);
    if (result.status === "unavailable") throw new ApiError(503, "MESSAGING_UNAVAILABLE", "Messaging is temporarily unavailable.");
    return { ok: true, conversations: result.data };
  });

  // GET /api/v1/messaging/conversations/:id — conversation summary from the
  // caller's perspective. 403 if the caller is not a member.
  app.get("/api/v1/messaging/conversations/:id", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } },
  }, async (request) => {
    const parsed = idParam.safeParse(request.params);
    if (!parsed.success) throw new ApiError(400, "INVALID_ID", "Conversation id is invalid.");
    const result = await options.service.getConversation(request.auth.accessToken, parsed.data.id);
    if (result.status !== "ok") failConversation(result.status);
    return { ok: true, conversation: result.data };
  });

  // GET /api/v1/messaging/bookings/:bookingId/conversation — returns the
  // booking's conversation, creating + seeding membership on first call.
  // This is the entry point used by the booking detail surface so the
  // learner can talk to the host from the booking context (DEC-015).
  app.get("/api/v1/messaging/bookings/:bookingId/conversation", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } },
  }, async (request) => {
    const parsed = bookingParam.safeParse(request.params);
    if (!parsed.success) throw new ApiError(400, "INVALID_ID", "Booking id is invalid.");
    const result = await options.service.getOrCreateBookingConversation(request.auth.accessToken, parsed.data.bookingId);
    if (result.status !== "ok") failConversation(result.status);
    return { ok: true, conversation: result.data };
  });

  // GET /api/v1/messaging/conversations/:id/messages — paginated message
  // history for a conversation the caller belongs to.
  app.get("/api/v1/messaging/conversations/:id/messages", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } },
  }, async (request) => {
    const id = idParam.safeParse(request.params);
    if (!id.success) throw new ApiError(400, "INVALID_ID", "Conversation id is invalid.");
    const query = listMessagesQuery.safeParse(request.query);
    if (!query.success) throw new ApiError(400, "INVALID_QUERY", "Query is invalid.");
    const result = await options.service.listMessages(
      request.auth.accessToken,
      id.data.id,
      query.data.limit,
      query.data.before,
    );
    if (result.status !== "ok") failConversation(result.status);
    return { ok: true, messages: result.data };
  });

  // GET /api/v1/messaging/conversations/:id/messages/:messageId/attachments
  // — list attachments for a single message. Caller must be a member of
  // the conversation. Returns an empty array when the message has no
  // attachments (e.g. a text-only message).
  app.get("/api/v1/messaging/conversations/:id/messages/:messageId/attachments", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } },
  }, async (request) => {
    const params = z.object({ id: z.string().uuid(), messageId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) throw new ApiError(400, "INVALID_ID", "Conversation or message id is invalid.");
    const result = await options.service.listAttachments(
      request.auth.accessToken,
      params.data.messageId,
    );
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You are not a member of this conversation.");
    if (result.status === "not_found") throw new ApiError(404, "MESSAGE_NOT_FOUND", "Message not found.");
    if (result.status === "unavailable") throw new ApiError(503, "MESSAGING_UNAVAILABLE", "Messaging is temporarily unavailable.");
    return { ok: true, attachments: result.data };
  });

  // POST /api/v1/messaging/conversations/:id/messages — idempotent send.
  // clientMessageId is required and is the durable dedupe token for the
  // caller's retry.
  app.post("/api/v1/messaging/conversations/:id/messages", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.sendMax, timeWindow: options.windowMs } },
  }, async (request) => {
    const id = idParam.safeParse(request.params);
    if (!id.success) throw new ApiError(400, "INVALID_ID", "Conversation id is invalid.");
    const body = sendBody.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "INVALID_MESSAGE", "Message is invalid.");
    const result = await options.service.sendMessage(
      request.auth.accessToken,
      id.data.id,
      body.data.clientMessageId,
      body.data.body,
    );
    if (result.status !== "ok") failSend(result.status);
    return { ok: true, message: result.data, duplicate: result.duplicate };
  });

  // POST /api/v1/messaging/conversations/:id/read — mark the conversation
  // as read for the caller; resets unread counts on the next list call.
  app.post("/api/v1/messaging/conversations/:id/read", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } },
  }, async (request) => {
    const id = idParam.safeParse(request.params);
    if (!id.success) throw new ApiError(400, "INVALID_ID", "Conversation id is invalid.");
    const result = await options.service.markRead(request.auth.accessToken, id.data.id);
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You are not a member of this conversation.");
    if (result.status !== "ok") throw new ApiError(503, "MESSAGING_UNAVAILABLE", "Messaging is temporarily unavailable.");
    return { ok: true, ...result.data };
  });

  // PATCH /api/v1/messaging/messages/:id — owner only. Edit body.
  app.patch("/api/v1/messaging/messages/:id", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.sendMax, timeWindow: options.windowMs } },
  }, async (request) => {
    const id = idParam.safeParse(request.params);
    if (!id.success) throw new ApiError(400, "INVALID_ID", "Message id is invalid.");
    const body = z.object({ body: z.string().trim().min(1).max(2000) }).safeParse(request.body);
    if (!body.success) throw new ApiError(400, "INVALID_MESSAGE", "Message body is invalid.");
    const result = await options.service.editMessage(request.auth.accessToken, id.data.id, body.data.body);
    if (result.status === "not_found") throw new ApiError(404, "MESSAGE_NOT_FOUND", "Message not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You can only edit your own messages.");
    if (result.status !== "ok") throw new ApiError(503, "MESSAGING_UNAVAILABLE", "Messaging is temporarily unavailable.");
    return { ok: true, message: result.data };
  });

  // DELETE /api/v1/messaging/messages/:id — owner only. Soft delete.
  app.delete("/api/v1/messaging/messages/:id", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.sendMax, timeWindow: options.windowMs } },
  }, async (request) => {
    const id = idParam.safeParse(request.params);
    if (!id.success) throw new ApiError(400, "INVALID_ID", "Message id is invalid.");
    const result = await options.service.deleteMessage(request.auth.accessToken, id.data.id);
    if (result.status === "not_found") throw new ApiError(404, "MESSAGE_NOT_FOUND", "Message not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You can only delete your own messages.");
    if (result.status !== "ok") throw new ApiError(503, "MESSAGING_UNAVAILABLE", "Messaging is temporarily unavailable.");
    return { ok: true, message: result.data };
  });

  // POST /api/v1/messaging/messages/:id/report — any active member of
  // the conversation. Persists a moderation record (admin + reporter only).
  app.post("/api/v1/messaging/messages/:id/report", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.sendMax, timeWindow: options.windowMs } },
  }, async (request) => {
    const id = idParam.safeParse(request.params);
    if (!id.success) throw new ApiError(400, "INVALID_ID", "Message id is invalid.");
    const body = z.object({
      reason: z.enum(["harassment", "spam", "scam", "inappropriate", "abuse", "other"]),
      details: z.string().trim().max(2000).optional(),
    }).safeParse(request.body);
    if (!body.success) throw new ApiError(400, "INVALID_REPORT", "Report reason is invalid.");
    const result = await options.service.reportMessage(request.auth.accessToken, id.data.id, body.data.reason, body.data.details);
    if (result.status === "not_found") throw new ApiError(404, "MESSAGE_NOT_FOUND", "Message not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You can only report messages in your own conversations.");
    if (result.status !== "ok") throw new ApiError(503, "MESSAGING_UNAVAILABLE", "Messaging is temporarily unavailable.");
    return { ok: true, report: result.data };
  });

  // POST /api/v1/messaging/users/:userId/block — caller is the blocker.
  app.post("/api/v1/messaging/users/:userId/block", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.sendMax, timeWindow: options.windowMs } },
  }, async (request) => {
    const id = z.object({ userId: z.string().uuid() }).safeParse(request.params);
    if (!id.success) throw new ApiError(400, "INVALID_ID", "User id is invalid.");
    const result = await options.service.blockUser(request.auth.accessToken, id.data.userId);
    if (result.status === "not_found") throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not have permission to block this user.");
    if (result.status !== "ok") throw new ApiError(503, "MESSAGING_UNAVAILABLE", "Messaging is temporarily unavailable.");
    return { ok: true, ...result.data };
  });

  // DELETE /api/v1/messaging/users/:userId/block — caller is the blocker.
  app.delete("/api/v1/messaging/users/:userId/block", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } },
  }, async (request) => {
    const id = z.object({ userId: z.string().uuid() }).safeParse(request.params);
    if (!id.success) throw new ApiError(400, "INVALID_ID", "User id is invalid.");
    const result = await options.service.unblockUser(request.auth.accessToken, id.data.userId);
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not have permission to unblock this user.");
    if (result.status !== "ok") throw new ApiError(503, "MESSAGING_UNAVAILABLE", "Messaging is temporarily unavailable.");
    return { ok: true, ...result.data };
  });
};