"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { EventDetail } from "@/lib/event-data";
import { allEvents, getEventBySlug } from "@/lib/event-data";
import { getSharedEventBySlug, readSharedEvents } from "@/lib/published-event-store";
import { toWorkshopData, type WorkshopData, type WorkshopDataRecommendation } from "@/lib/workshop-payload";
import { isLiveMode } from "@/lib/auth/config";
import { BookingApiError, createBooking } from "@/lib/booking-api";
import { ensureSession, signOutLive, useSession } from "@/lib/auth/session";

interface PizzaWorkshopFrameProps {
  event: EventDetail;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const unwrapVnd = (price?: string | number): number => {
  if (typeof price === "number") return price;
  if (typeof price === "string") {
    const digits = price.replace(/[^0-9]/g, "");
    return digits ? Number(digits) : 0;
  }
  return 0;
};

async function buildRecommendations(slug: string, host: string): Promise<WorkshopDataRecommendation[]> {
  const recs: WorkshopDataRecommendation[] = [];
  const seen = new Set<string>([slug]);
  const push = (e: { slug: string; title: string; host: string; price: string; duration?: string; location: string; image?: string; topic: string; rating: number; reviewCount: number }) => {
    if (seen.has(e.slug)) return;
    seen.add(e.slug);
    recs.push({
      slug: e.slug,
      title: e.title,
      category: e.topic || "Workshop",
      host: e.host,
      rating: e.rating ?? 0,
      reviewCount: e.reviewCount ?? 0,
      duration: e.duration || "2 hours",
      location: e.location,
      priceFrom: unwrapVnd(e.price),
      image: e.image,
      priority: e.host === host ? "host" : "default",
    });
  };
  allEvents.forEach((e) => {
    const detail = getEventBySlug(e.slug);
    if (detail) push(detail);
  });
  const shared = await readSharedEvents();
  shared.forEach((e) => {
    const detail = e as unknown as EventDetail;
    push(detail);
  });
  return recs.slice(0, 6);
}

export function PizzaWorkshopFrame({ event }: PizzaWorkshopFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const payloadRef = useRef<WorkshopData | null>(null);
  const live = isLiveMode();
  const session = useSession();
  const accountSnapshot = useSyncExternalStore(subscribeToAccount, getAccountSnapshot, () => "");
  const currentAccountId = useMemo(() => accountIdFromSnapshot(accountSnapshot), [accountSnapshot]);
  const isOwner = Boolean(event.creatorId && String(event.creatorId).trim().toLowerCase() === currentAccountId);
  const iframeSrc = useMemo(() => {
    const sessionIds = event.sessions?.map((s) => s.id).join(",") || "";
    return `/pizza-workshop.html${sessionIds ? `?sessionIds=${encodeURIComponent(sessionIds)}` : ""}`;
  }, [event.sessions]);

  const sendData = useCallback(() => {
    const win = frameRef.current?.contentWindow;
    const payload = payloadRef.current;
    if (!win || !payload) return;
    win.postMessage({ type: "tutoria-workshop-data", payload }, window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void buildRecommendations(event.slug, event.host).then((recs) => {
      if (cancelled) return;
      const next = toWorkshopData(event, recs);
      payloadRef.current = next;
      sendData();
    });
    return () => {
      cancelled = true;
    };
  }, [event]);


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
      if (data.type === "tutoria-iframe-ready") {
        sendData();
        return;
      }
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
  }, [live, sendData]);

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
      onLoad={() => {
        syncEditControls();
        sendData();
      }}
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
