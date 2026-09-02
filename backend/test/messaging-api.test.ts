import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { MessagingService } from "../src/services/messaging-service.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";

const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

const CONVERSATION = {
  id: "22222222-2222-4222-8222-222222222222",
  bookingId: "33333333-3333-4333-8333-333333333333",
  createdAt: "2026-08-31T10:00:00.000Z",
  updatedAt: "2026-08-31T10:05:00.000Z",
  lastMessageAt: "2026-08-31T10:05:00.000Z",
  lastMessagePreview: "Hello",
  unreadCount: 1,
  viewerRole: "learner" as const,
  participant: { userId: "44444444-4444-4444-8444-444444444444", role: "host" as const, displayName: "Mai" },
  bookingContext: null,
  lastMessage: null,
};

function setup(overrides: Partial<MessagingService> = {}, authenticated = true) {
  const calls: Array<{ name: string; args: unknown[] }> = [];
  const service: MessagingService = {
    listConversations: async (...args) => { calls.push({ name: "listConversations", args }); return { status: "ok", data: [CONVERSATION] }; },
    getConversation: async (...args) => { calls.push({ name: "getConversation", args }); return { status: "ok", data: CONVERSATION }; },
    getOrCreateBookingConversation: async (...args) => { calls.push({ name: "getOrCreateBookingConversation", args }); return { status: "ok", data: CONVERSATION }; },
    listMessages: async (...args) => { calls.push({ name: "listMessages", args }); return { status: "ok", data: [{ id: "55555555-5555-4555-8555-555555555555", senderId: CONVERSATION.participant.userId, mine: false, body: "Hi", createdAt: "2026-08-31T10:05:00.000Z", moderationStatus: "approved" }] }; },
    sendMessage: async (...args) => { calls.push({ name: "sendMessage", args }); return { status: "ok", data: { id: "66666666-6666-4666-8666-666666666666", senderId: "11111111-1111-4111-8111-111111111111", mine: true, body: args[3] as string, createdAt: "2026-08-31T10:06:00.000Z", moderationStatus: "approved" }, duplicate: false }; },
    markRead: async (...args) => { calls.push({ name: "markRead", args }); return { status: "ok", data: { conversationId: args[1] as string, lastReadAt: "2026-08-31T10:06:30.000Z" } }; },
    searchConversations: async (token, query) => { calls.push({ name: "searchConversations", args: [token, query] }); return { status: "ok", data: [] as any }; },
    editMessage: async (...args) => { calls.push({ name: "editMessage", args }); return { status: "ok", data: { id: "66666666-6666-4666-8666-666666666666", senderId: "11111111-1111-4111-8111-111111111111", mine: false, body: args[2] as string, createdAt: "2026-08-31T10:06:00.000Z", moderationStatus: "approved" } }; },
    deleteMessage: async (...args) => { calls.push({ name: "deleteMessage", args }); return { status: "ok", data: { id: "66666666-6666-4666-8666-666666666666", senderId: "11111111-1111-4111-8111-111111111111", mine: false, body: "deleted", createdAt: "2026-08-31T10:06:00.000Z", moderationStatus: "approved" } }; },
    reportMessage: async (...args) => { calls.push({ name: "reportMessage", args }); return { status: "ok", data: { id: "66666666-6666-4666-8666-666666666666", status: "reported" } }; },
    blockUser: async (...args) => { calls.push({ name: "blockUser", args }); return { status: "ok", data: { blocker: "11111111-1111-4111-8111-111111111111", blocked: "44444444-4444-4444-8444-444444444444" } }; },
    unblockUser: async (...args) => { calls.push({ name: "unblockUser", args }); return { status: "ok", data: { blocker: "11111111-1111-4111-8111-111111111111", blocked: "44444444-4444-4444-8444-444444444444" } }; },
    listAttachments: async (...args: unknown[]) => { calls.push({ name: "listAttachments", args }); return { status: "ok", data: [] }; },
    ...overrides,
  };
  const authService = new FakeAuthService();
  if (authenticated) authService.authentication = { status: "authenticated", user: { id: "11111111-1111-4111-8111-111111111111", email: "learner@example.test" } };
  const app = createApp({ config: testConfig, authService, messagingService: service });
  apps.push(app);
  return { app, calls, authService, service };
}

const auth = { authorization: "Bearer test-token" };

describe("messaging API boundary", () => {
  it("requires authentication for every messaging endpoint", async () => {
    const { app } = setup({}, false);
    const urls: ReadonlyArray<{ method: "GET" | "POST"; url: string; payload?: Record<string, unknown> }> = [
      { method: "GET", url: "/api/v1/messaging/conversations" },
      { method: "GET", url: `/api/v1/messaging/conversations/${CONVERSATION.id}` },
      { method: "GET", url: `/api/v1/messaging/conversations/${CONVERSATION.id}/messages` },
      { method: "POST", url: `/api/v1/messaging/conversations/${CONVERSATION.id}/messages`, payload: { clientMessageId: "abcdefgh", body: "x" } },
      { method: "POST", url: `/api/v1/messaging/conversations/${CONVERSATION.id}/read` },
      { method: "GET", url: `/api/v1/messaging/bookings/${CONVERSATION.bookingId}/conversation` },
    ];
    for (const req of urls) {
      const response = req.payload
        ? await app.inject({ method: req.method, url: req.url, payload: req.payload })
        : await app.inject({ method: req.method, url: req.url });
      expect(response.statusCode).toBe(401);
    }
  });

  it("lists conversations and reads conversation + messages with the caller's JWT", async () => {
    const { app, calls } = setup();
    const list = await app.inject({ method: "GET", url: "/api/v1/messaging/conversations", headers: auth });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({ ok: true, conversations: [{ id: CONVERSATION.id }] });
    expect(calls.find((call) => call.name === "listConversations")?.args[0]).toBe("test-token");

    const conv = await app.inject({ method: "GET", url: `/api/v1/messaging/conversations/${CONVERSATION.id}`, headers: auth });
    expect(conv.statusCode).toBe(200);
    expect(conv.json().conversation.participant.role).toBe("host");

    const msgs = await app.inject({ method: "GET", url: `/api/v1/messaging/conversations/${CONVERSATION.id}/messages`, headers: auth });
    expect(msgs.statusCode).toBe(200);
    expect(msgs.json().messages[0].mine).toBe(false);
  });

  it("looks up or creates a booking conversation and threads the JWT through", async () => {
    const { app, calls } = setup();
    const response = await app.inject({ method: "GET", url: `/api/v1/messaging/bookings/${CONVERSATION.bookingId}/conversation`, headers: auth });
    expect(response.statusCode).toBe(200);
    expect(calls.find((call) => call.name === "getOrCreateBookingConversation")?.args.slice(1)).toEqual([CONVERSATION.bookingId]);
  });

  it("rejects malformed ids and bodies without leaking internal errors", async () => {
    const { app } = setup();
    const badId = await app.inject({ method: "GET", url: "/api/v1/messaging/conversations/not-a-uuid", headers: auth });
    expect(badId.statusCode).toBe(400);
    expect(badId.json().error.code).toBe("INVALID_ID");

    const emptyBody = await app.inject({ method: "POST", url: `/api/v1/messaging/conversations/${CONVERSATION.id}/messages`, headers: auth, payload: { clientMessageId: "abcdefgh", body: "" } });
    expect(emptyBody.statusCode).toBe(400);
    expect(emptyBody.json().error.code).toBe("INVALID_MESSAGE");

    const shortKey = await app.inject({ method: "POST", url: `/api/v1/messaging/conversations/${CONVERSATION.id}/messages`, headers: auth, payload: { clientMessageId: "short", body: "Hello" } });
    expect(shortKey.statusCode).toBe(400);
  });

  it("maps service-level forbidden / not_found / unavailable to stable API errors", async () => {
    const forbidden = setup({ getConversation: async () => ({ status: "forbidden" }) });
    const f = await forbidden.app.inject({ method: "GET", url: `/api/v1/messaging/conversations/${CONVERSATION.id}`, headers: auth });
    expect(f.statusCode).toBe(403);
    expect(f.json().error.code).toBe("FORBIDDEN");

    const missing = setup({ getConversation: async () => ({ status: "not_found" }) });
    const n = await missing.app.inject({ method: "GET", url: `/api/v1/messaging/conversations/${CONVERSATION.id}`, headers: auth });
    expect(n.statusCode).toBe(404);
    expect(n.json().error.code).toBe("CONVERSATION_NOT_FOUND");

    const down = setup({ listConversations: async () => ({ status: "unavailable" }) });
    const d = await down.app.inject({ method: "GET", url: "/api/v1/messaging/conversations", headers: auth });
    expect(d.statusCode).toBe(503);
    expect(d.json().error.code).toBe("MESSAGING_UNAVAILABLE");
  });

  it("sends a message and surfaces duplicate=true on idempotent retry", async () => {
    const { app, calls } = setup({
      sendMessage: async (token, cid, key, body) => {
        calls.push({ name: "sendMessage", args: [token, cid, key, body] });
        return {
          status: "ok",
          data: { id: "66666666-6666-4666-8666-666666666666", senderId: "11111111-1111-4111-8111-111111111111", mine: true, body, createdAt: "2026-08-31T10:06:00.000Z", moderationStatus: "approved" },
          duplicate: true,
        };
      },
    });
    const response = await app.inject({ method: "POST", url: `/api/v1/messaging/conversations/${CONVERSATION.id}/messages`, headers: auth, payload: { clientMessageId: "duplicate-key-12345678", body: "Hello host" } });
    expect(response.statusCode).toBe(200);
    expect(response.json().duplicate).toBe(true);
    const sendCall = calls.find((call) => call.name === "sendMessage");
    expect(sendCall?.args.slice(1)).toEqual([CONVERSATION.id, "duplicate-key-12345678", "Hello host"]);
  });

  it("maps invalid/forbidden send results to 400 and 403", async () => {
    const invalid = setup({ sendMessage: async () => ({ status: "invalid" }) });
    const r1 = await invalid.app.inject({ method: "POST", url: `/api/v1/messaging/conversations/${CONVERSATION.id}/messages`, headers: auth, payload: { clientMessageId: "abcdefghijkl", body: "x" } });
    expect(r1.statusCode).toBe(400);
    expect(r1.json().error.code).toBe("INVALID_MESSAGE");

    const forbidden = setup({ sendMessage: async () => ({ status: "forbidden" }) });
    const r2 = await forbidden.app.inject({ method: "POST", url: `/api/v1/messaging/conversations/${CONVERSATION.id}/messages`, headers: auth, payload: { clientMessageId: "abcdefghijkl", body: "x" } });
    expect(r2.statusCode).toBe(403);
    expect(r2.json().error.code).toBe("FORBIDDEN");
  });

  it("marks a conversation as read", async () => {
    const { app, calls } = setup();
    const response = await app.inject({ method: "POST", url: `/api/v1/messaging/conversations/${CONVERSATION.id}/read`, headers: auth });
    expect(response.statusCode).toBe(200);
    expect(response.json().conversationId).toBe(CONVERSATION.id);
    expect(calls.find((call) => call.name === "markRead")?.args.slice(1)).toEqual([CONVERSATION.id]);
  });
});
