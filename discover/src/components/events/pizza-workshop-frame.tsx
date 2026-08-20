"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { EventDetail } from "@/lib/event-data";
import { isLiveMode } from "@/lib/auth/config";
import { BookingApiError, createBooking } from "@/lib/booking-api";
import { ensureSession, signOutLive, useSession } from "@/lib/auth/session";

interface PizzaWorkshopFrameProps {
  event: EventDetail;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function PizzaWorkshopFrame({ event }: PizzaWorkshopFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const live = isLiveMode();
  const session = useSession();
  const accountSnapshot = useSyncExternalStore(subscribeToAccount, getAccountSnapshot, () => "");
  const currentAccountId = useMemo(() => accountIdFromSnapshot(accountSnapshot), [accountSnapshot]);
  const isOwner = Boolean(event.creatorId && String(event.creatorId).trim().toLowerCase() === currentAccountId);
  const iframeSrc = useMemo(() => {
    const sessionIds = event.sessions?.map((s) => s.id).join(",") || "";
    return `/pizza-workshop.html${sessionIds ? `?sessionIds=${encodeURIComponent(sessionIds)}` : ""}`;
  }, [event.sessions]);
  const syncEditControls = useCallback(() => {
    const document = frameRef.current?.contentDocument;
    if (!document?.head) return;

    let style = document.getElementById("tutoria-owner-edit-visibility");
    if (isOwner) {
      style?.remove();
      return;
    }

    if (!style) {
      style = document.createElement("style");
      style.id = "tutoria-owner-edit-visibility";
      document.head.append(style);
    }
    style.textContent = `
      [data-edit-section],
      #advancedEditorModal,
      #contentEditorModal {
        display: none !important;
      }
    `;
  }, [isOwner]);

  useEffect(() => {
    syncEditControls();
  }, [syncEditControls]);

  useEffect(() => {
    if (!live) return;
    const onBookingMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: unknown; requestId?: unknown; sessionId?: unknown; participantCount?: unknown } | null;
      if (!data) return;
      if (data.type === "tutoria-auth-sign-out") {
        void signOutLive().finally(() => window.location.assign("/auth/sign-in"));
        return;
      }
      const bookingReturnPath = () => {
        const url = new URL(window.location.href);
        if (typeof data.sessionId === "string" && UUID.test(data.sessionId)) {
          url.searchParams.set("bookingSessionId", data.sessionId);
          url.searchParams.set("bookingStep", "review");
        }
        return `${url.pathname}${url.search}`;
      };
      if (data.type === "tutoria-booking-auth-required") {
        const returnPath = bookingReturnPath();
        window.location.assign(`/auth/sign-in?next=${encodeURIComponent(returnPath)}`);
        return;
      }
      if (data.type === "tutoria-booking-verification-required") {
        const returnPath = bookingReturnPath();
        window.location.assign(`/auth/verify-email?next=${encodeURIComponent(returnPath)}`);
        return;
      }
      if (typeof data.requestId !== "string") return;
      const respond = (payload: Record<string, unknown>) => {
        frameRef.current?.contentWindow?.postMessage({ ...payload, requestId: data.requestId }, window.location.origin);
      };
      if (data.type === "tutoria-booking-create" && typeof data.sessionId === "string") {
        const sessionId = data.sessionId;
        void ensureSession()
          .then(() => createBooking(sessionId, typeof data.participantCount === "number" ? data.participantCount : 1))
          .then((booking) => respond({ type: "tutoria-booking-created", booking }))
          .catch((error: unknown) => {
            const code = error instanceof BookingApiError ? error.code : "BOOKING_SERVICE_UNAVAILABLE";
            if (code === "UNAUTHORIZED") respond({ type: "tutoria-booking-auth-required", sessionId });
            else if (code === "EMAIL_VERIFICATION_REQUIRED") respond({ type: "tutoria-booking-verification-required", sessionId });
            else respond({ type: "tutoria-booking-error", code, sessionId });
          });
      }
    };
    window.addEventListener("message", onBookingMessage);
    return () => window.removeEventListener("message", onBookingMessage);
  }, [live]);

  useEffect(() => {
    if (!live) return;
    frameRef.current?.contentWindow?.postMessage({
      type: "tutoria-booking-auth-state",
      authenticated: session.status === "authenticated",
    }, window.location.origin);
  }, [live, session.status]);

  return (
    <iframe
      ref={frameRef}
      title={event.title}
      src={iframeSrc}
      onLoad={syncEditControls}
      style={{ width: "100%", height: "100dvh", border: 0, display: "block", background: "#09090b" }}
    />
  );
}

function getAccountSnapshot() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("tutoria_signup") || "";
}

function subscribeToAccount(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function accountIdFromSnapshot(snapshot: string) {
  try {
    const account = JSON.parse(snapshot || "{}");
    return account.completed && account.email ? String(account.email).trim().toLowerCase() : "";
  } catch {
    return "";
  }
}
