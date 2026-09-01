"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isLiveMode } from "@/lib/auth/config";
import { evaluateAuthGate } from "@/lib/auth/gate";
import { ensureSession, useSession } from "@/lib/auth/session";
import {
  MessagingApiError,
  generateClientMessageId,
  getConversation,
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
  type MessagingConversation,
  type MessagingMessage,
} from "@/lib/messaging-api";

const MAX_BODY_LENGTH = 2000;
const MIN_BODY_LENGTH = 1;

type LoadState = "loading" | "ready" | "error";
type SendState = { status: "idle" } | { status: "sending" } | { status: "error"; message: string };

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
  }
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}

function formatPreviewDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const stamp = date.getTime();
  if (stamp >= startOfToday) {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
  }
  if (stamp >= startOfToday - 86_400_000 * 6) {
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
  }
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}

function summarizeError(error: unknown): string {
  if (error instanceof MessagingApiError) {
    switch (error.code) {
      case "UNAUTHORIZED":
        return "Please sign in to view your messages.";
      case "FORBIDDEN":
        return "You are not a member of this conversation.";
      case "CONVERSATION_NOT_FOUND":
        return "This conversation is no longer available.";
      case "INVALID_MESSAGE":
        return "Please type a message between 1 and 2000 characters.";
      case "MESSAGING_UNAVAILABLE":
        return "Messaging is temporarily unavailable. Please try again in a moment.";
      case "TIMEOUT":
      case "NETWORK_ERROR":
        return "We could not reach the server. Check your connection and try again.";
      default:
        return error.message || "Something went wrong.";
    }
  }
  return "Something went wrong.";
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const action = evaluateAuthGate(session.status, pathname);
    if (action.type === "redirect") {
      router.replace(action.to);
      return;
    }
    if (action.type === "authorize") {
      const frame = window.requestAnimationFrame(() => setAuthorized(true));
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [pathname, router, session.status]);

  if (!authorized) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#080809] px-6 text-[#f4f4f2]" aria-busy="true">
        <p className="text-sm text-[#9c9ca3]">Loading your messages…</p>
      </main>
    );
  }
  return <>{children}</>;
}

function ConversationList({
  conversations,
  activeId,
  onSelect,
}: {
  conversations: MessagingConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  if (conversations.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-sm text-[#a8a8ad]">No conversations yet.</p>
        <p className="mt-2 text-xs text-[#7a7a80]">
          Messages open when a learner books a session with a host. Open a booking to start a conversation.
        </p>
      </div>
    );
  }
  return (
    <ul className="flex h-full flex-col divide-y divide-[#1c1d20] overflow-y-auto" role="listbox" aria-label="Conversations">
      {conversations.map((conversation) => {
        const isActive = conversation.id === activeId;
        const preview = conversation.lastMessagePreview || (conversation.bookingContext ? "Booking confirmed" : "Conversation opened");
        return (
          <li key={conversation.id}>
            <button
              type="button"
              onClick={() => onSelect(conversation.id)}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                isActive ? "bg-[#15161a]" : "bg-transparent hover:bg-[#111114]"
              }`}
              aria-selected={isActive}
              role="option"
            >
              <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1c1d20] text-xs font-medium text-[#cfcfd4]">
                {conversation.participant.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-sm ${isActive ? "text-[#f4f4f2]" : "text-[#d8d8db]"}`}>{conversation.participant.displayName}</p>
                  <span className="shrink-0 text-[11px] text-[#7a7a80]">{formatPreviewDate(conversation.lastMessageAt)}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className={`truncate text-xs ${conversation.unreadCount > 0 ? "text-[#e8e8eb]" : "text-[#9c9ca3]"}`}>{preview}</p>
                  {conversation.unreadCount > 0 ? (
                    <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f4f4f2] px-1 text-[10px] font-semibold text-[#0b0b0c]">
                      {conversation.unreadCount}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-[#5f5f64]">
                  {conversation.participant.role === "host" ? "Host" : "Learner"}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function MessageList({ messages, viewerRole }: { messages: MessagingMessage[]; viewerRole: MessagingConversation["viewerRole"] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-sm text-[#9c9ca3]">No messages yet. Say hello to start the conversation.</p>
      </div>
    );
  }
  return (
    <div ref={scrollRef} className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite" aria-relevant="additions">
      {messages.map((message) => {
        const mine = message.mine;
        return (
          <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                mine ? "bg-[#f4f4f2] text-[#0b0b0c]" : "bg-[#15161a] text-[#e8e8eb]"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
              <p className={`mt-1 text-[10px] uppercase tracking-wide ${mine ? "text-[#5f5f64]" : "text-[#7a7a80]"}`}>
                {mine ? "You" : viewerRole === "host" ? "Learner" : "Host"} · {formatTimestamp(message.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Composer({
  conversationId,
  onSent,
}: {
  conversationId: string;
  onSent: (message: MessagingMessage, clientMessageId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sendState, setSendState] = useState<SendState>({ status: "idle" });
  const clientMessageIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = draft.trim();
  const tooLong = trimmed.length > MAX_BODY_LENGTH;
  const tooShort = trimmed.length < MIN_BODY_LENGTH;
  const disabled = tooShort || tooLong || sendState.status === "sending";

  const submit = useCallback(async () => {
    if (disabled) return;
    const body = trimmed;
    if (!clientMessageIdRef.current) clientMessageIdRef.current = generateClientMessageId();
    const clientMessageId = clientMessageIdRef.current;
    setSendState({ status: "sending" });
    try {
      const message = await sendMessage(conversationId, body, clientMessageId);
      onSent(message, clientMessageId);
      setDraft("");
      clientMessageIdRef.current = null;
      setSendState({ status: "idle" });
    } catch (error) {
      const message = summarizeError(error);
      setSendState({ status: "error", message });
    }
  }, [conversationId, disabled, onSent, trimmed]);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submit();
    },
    [submit],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void submit();
      }
    },
    [submit],
  );

  const remaining = MAX_BODY_LENGTH - trimmed.length;

  return (
    <form className="border-t border-[#1c1d20] bg-[#0b0b0c] px-4 py-3" onSubmit={onSubmit} aria-label="Send a message">
      <label htmlFor={`composer-${conversationId}`} className="sr-only">
        Message
      </label>
      <div className="flex items-end gap-3">
        <textarea
          id={`composer-${conversationId}`}
          ref={textareaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Write a message"
          rows={1}
          maxLength={MAX_BODY_LENGTH}
          aria-invalid={tooLong}
          aria-describedby={`composer-help-${conversationId}`}
          className="min-h-10 max-h-40 flex-1 resize-none rounded-xl border border-[#1c1d20] bg-[#111114] px-3 py-2 text-sm text-[#f4f4f2] placeholder:text-[#7a7a80] focus:border-[#3a3a3f] focus:outline-none"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-xl bg-[#f4f4f2] px-4 py-2 text-sm font-medium text-[#0b0b0c] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sendState.status === "sending" ? "Sending…" : "Send"}
        </button>
      </div>
      <p id={`composer-help-${conversationId}`} className="mt-2 flex items-center justify-between text-[11px] text-[#7a7a80]">
        <span>Enter to send · Shift+Enter for newline</span>
        <span aria-live="polite">
          {sendState.status === "error" ? (
            <span className="text-[#f4a8a8]">{sendState.message}</span>
          ) : tooLong ? (
            <span className="text-[#f4a8a8]">{remaining} over the limit</span>
          ) : (
            <span>{remaining} characters left</span>
          )}
        </span>
      </p>
    </form>
  );
}

function ConversationView({
  conversationId,
  onMessageSent,
}: {
  conversationId: string;
  onMessageSent?: (message: MessagingMessage) => void;
}) {
  const [conversation, setConversation] = useState<MessagingConversation | null>(null);
  const [messages, setMessages] = useState<MessagingMessage[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const lastReadAtRef = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lastReadAtRef.current = null;
    void (async () => {
      setState("loading");
      setError("");
      setConversation(null);
      setMessages([]);
      try {
        const [conv, list] = await Promise.all([
          getConversation(conversationId, controller.signal),
          listMessages(conversationId, 200, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setConversation(conv);
        setMessages(list);
        setState("ready");
      } catch (caught) {
        if (controller.signal.aborted) return;
        setState("error");
        setError(summarizeError(caught));
      }
    })();
    return () => controller.abort();
  }, [conversationId]);

  useEffect(() => {
    if (state !== "ready") return;
    if (!conversation) return;
    if (conversation.unreadCount === 0) return;
    if (lastReadAtRef.current === conversation.updatedAt) return;
    lastReadAtRef.current = conversation.updatedAt;
    void markConversationRead(conversationId).catch(() => undefined);
    setConversation((current) => (current ? { ...current, unreadCount: 0 } : current));
  }, [conversation, conversationId, state]);

  const handleMessageSent = useCallback(
    (message: MessagingMessage) => {
      setMessages((current) => [...current, message]);
      setConversation((current) =>
        current
          ? {
              ...current,
              lastMessageAt: message.createdAt,
              lastMessagePreview: message.body.slice(0, 280),
            }
          : current,
      );
      onMessageSent?.(message);
    },
    [onMessageSent],
  );

  if (state === "loading") {
    return (
      <div className="grid h-full place-items-center px-6" aria-busy="true">
        <p className="text-sm text-[#9c9ca3]">Loading conversation…</p>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
        <p className="text-sm text-[#f4f4f2]">Could not open this conversation.</p>
        <p className="text-xs text-[#9c9ca3]">{error}</p>
      </div>
    );
  }
  if (!conversation) return null;
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[#1c1d20] bg-[#0b0b0c] px-4 py-3">
        <p className="text-sm font-medium text-[#f4f4f2]">{conversation.participant.displayName}</p>
        <p className="text-[11px] uppercase tracking-wide text-[#7a7a80]">
          {conversation.participant.role === "host" ? "Host" : "Learner"}
          {conversation.bookingContext ? " · Booking in progress" : ""}
        </p>
      </header>
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} viewerRole={conversation.viewerRole} />
      </div>
      <Composer
        conversationId={conversationId}
        onSent={(message, clientMessageId) => {
          // Optimistic append is intentionally avoided: server-authoritative
          // returns the persisted message so the client cannot fabricate
          // membership or content (tutoria-server-authoritative-ui).
          handleMessageSent(message);
          void clientMessageId;
        }}
      />
    </div>
  );
}

export default function MessagesPage() {
  // In demo mode (no live config) the auth store stays in mock mode and the
  // gate resolves to authorize, so the page renders the production UI against
  // mock data without hitting the real backend.
  const demo = !isLiveMode();

  if (demo) {
    return <DemoMessages />;
  }
  return (
    <AuthGate>
      <LiveMessages />
    </AuthGate>
  );
}

function LiveMessages() {
  useEffect(() => {
    void ensureSession();
  }, []);
  const [conversations, setConversations] = useState<MessagingConversation[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const refreshConversations = useCallback(async () => {
    try {
      const list = await listConversations();
      setConversations(list);
      setLoadError("");
      setActiveId((current) => {
        if (current && list.some((conversation) => conversation.id === current)) return current;
        return list[0]?.id ?? null;
      });
    } catch (caught) {
      setLoadError(summarizeError(caught));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refreshConversations();
    })();
  }, [refreshConversations]);

  const showEmpty = conversations !== null && conversations.length === 0 && !loadError;
  const showError = conversations === null && loadError;
  const showList = conversations !== null && conversations.length > 0;

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#080809] text-[#f4f4f2]">
      <div className="border-b border-[#1c1d20] px-4 py-3">
        <p className="text-[11px] uppercase tracking-wide text-[#7a7a80]">Messages</p>
        <h1 className="mt-1 text-lg font-medium text-[#f4f4f2]">Direct conversations</h1>
        <p className="mt-1 text-xs text-[#9c9ca3]">
          Talk to the host or learner attached to a confirmed booking. Messages are private and read by both sides.
        </p>
      </div>
      <div className="grid flex-1 grid-cols-1 md:grid-cols-[minmax(260px,340px)_1fr]">
        <aside
          className={`${activeId ? "hidden md:flex" : "flex"} flex-col border-b border-[#1c1d20] md:border-b-0 md:border-r`}
          aria-label="Conversation list"
        >
          <header className="flex items-center justify-between px-4 py-2">
            <p className="text-xs uppercase tracking-wide text-[#7a7a80]">Conversations</p>
            <button
              type="button"
              onClick={() => void refreshConversations()}
              className="text-[11px] uppercase tracking-wide text-[#9c9ca3] hover:text-[#f4f4f2]"
              aria-label="Refresh conversations"
            >
              Refresh
            </button>
          </header>
          <div className="min-h-0 flex-1">
            {conversations === null && !loadError ? (
              <div className="grid h-full place-items-center" aria-busy="true">
                <p className="text-sm text-[#9c9ca3]">Loading conversations…</p>
              </div>
            ) : showError ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center" role="alert">
                <p className="text-sm text-[#f4f4f2]">Could not load conversations.</p>
                <p className="text-xs text-[#9c9ca3]">{loadError}</p>
                <button
                  type="button"
                  onClick={() => void refreshConversations()}
                  className="mt-2 rounded-lg border border-[#1c1d20] px-3 py-1 text-xs text-[#f4f4f2]"
                >
                  Try again
                </button>
              </div>
            ) : showEmpty ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <p className="text-sm text-[#f4f4f2]">No conversations yet.</p>
                <p className="mt-2 text-xs text-[#9c9ca3]">
                  Direct messaging opens when a learner has a confirmed booking with a host. Open a booking to start a conversation.
                </p>
              </div>
            ) : showList ? (
              <ConversationList conversations={conversations} activeId={activeId} onSelect={setActiveId} />
            ) : null}
          </div>
        </aside>
        <section
          className={`${activeId ? "flex" : "hidden md:flex"} min-h-0 flex-col`}
          aria-label="Active conversation"
        >
          {activeId ? (
            <>
              <div className="flex items-center justify-between border-b border-[#1c1d20] px-4 py-2 md:hidden">
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className="text-xs text-[#9c9ca3] hover:text-[#f4f4f2]"
                  aria-label="Back to conversation list"
                >
                  ← Back
                </button>
              </div>
              <ConversationView conversationId={activeId} onMessageSent={(message) => {
                setConversations((current) =>
                  current
                    ? current.map((c) => (c.id === activeId ? { ...c, lastMessageAt: message.createdAt, lastMessagePreview: message.body.slice(0, 280) } : c))
                    : current,
                );
              }} />
            </>
          ) : (
            <div className="hidden h-full place-items-center md:grid">
              <p className="text-sm text-[#7a7a80]">Select a conversation to start.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function DemoMessages() {
  const demoConversations: MessagingConversation[] = useMemo(
    () => [
      {
        id: "demo-conv-1",
        bookingId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: "Demo preview · this view is mock content in demo mode.",
        unreadCount: 0,
        viewerRole: "learner",
        participant: { userId: "demo-host", role: "host", displayName: "Demo host" },
        bookingContext: null,
        lastMessage: null,
      },
    ],
    [],
  );
  const [activeId, setActiveId] = useState<string | null>(demoConversations[0]?.id ?? null);
  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#080809] text-[#f4f4f2]">
      <div className="border-b border-[#1c1d20] px-4 py-3">
        <p className="text-[11px] uppercase tracking-wide text-[#7a7a80]">Messages · demo</p>
        <p className="mt-1 text-xs text-[#9c9ca3]">
          Live messaging requires real Supabase auth. This page is the production UI; the list is a stand-in.
        </p>
      </div>
      <div className="grid flex-1 grid-cols-1 md:grid-cols-[minmax(260px,340px)_1fr]">
        <aside className="flex flex-col border-b border-[#1c1d20] md:border-b-0 md:border-r" aria-label="Conversation list (demo)">
          <ConversationList conversations={demoConversations} activeId={activeId} onSelect={setActiveId} />
        </aside>
        <section className="hidden h-full place-items-center md:grid" aria-label="Active conversation (demo)">
          <p className="text-sm text-[#7a7a80]">Sign in with Supabase to send a real message.</p>
        </section>
      </div>
    </main>
  );
}