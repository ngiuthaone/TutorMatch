"use client";

import { useEffect, useRef } from "react";
import { ensureSession, getSessionAccessToken, getSessionSnapshot } from "@/lib/auth/session";
import { isLiveMode } from "@/lib/auth/config";
import { cancelHostBooking, cancelTutorBooking, decideTutorBooking, listHostBookings, listTutorBookings, TutorBookingApiError } from "@/lib/tutor-booking-api";

export default function CenterPage() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const notifyFrameReady = () => frameRef.current?.contentWindow?.postMessage({ type: "tutoria-center-parent-ready" }, window.location.origin);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Tutoria Center"]');
      if (!frame || event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
      const message = event.data as { type?: unknown; requestId?: unknown; bookingId?: unknown; action?: unknown; expectedVersion?: unknown; reason?: unknown } | null;
      if (!message || typeof message.type !== "string") return;
      if (message.type === "tutoria-center-load-tutor-bookings") {
        const requestId = typeof message.requestId === "string" ? message.requestId : "";
        if (!isLiveMode()) { frame.contentWindow?.postMessage({ type: "tutoria-center-demo", requestId }, window.location.origin); return; }
        try { await ensureSession(); if (!getSessionAccessToken()) throw new TutorBookingApiError("UNAUTHORIZED", 401, "Sign in to manage tutor bookings."); const bookings = await listTutorBookings(); const sessionState = getSessionSnapshot(); const tutor = sessionState.status === "authenticated" ? { name: sessionState.user.name, role: sessionState.user.role } : null; frame.contentWindow?.postMessage({ type: "tutoria-center-tutor-bookings", requestId, bookings, tutor }, window.location.origin); }
        catch (error) { const apiError = error instanceof TutorBookingApiError ? error : new TutorBookingApiError("TUTOR_BOOKING_UNAVAILABLE", 503, "Tutor bookings are temporarily unavailable."); frame.contentWindow?.postMessage({ type: "tutoria-center-tutor-bookings-error", requestId, code: apiError.code, message: apiError.message }, window.location.origin); }
        return;
      }
      if (message.type === "tutoria-center-decide-tutor-booking" && typeof message.bookingId === "string" && (message.action === "accept" || message.action === "reject")) {
        const requestId = typeof message.requestId === "string" ? message.requestId : "";
        try { await ensureSession(); if (!getSessionAccessToken()) throw new TutorBookingApiError("UNAUTHORIZED", 401, "Sign in to manage tutor bookings."); const booking = await decideTutorBooking(message.bookingId, message.action, typeof message.expectedVersion === "number" ? message.expectedVersion : undefined); frame.contentWindow?.postMessage({ type: "tutoria-center-tutor-booking-decision", requestId, booking }, window.location.origin); }
        catch (error) { const apiError = error instanceof TutorBookingApiError ? error : new TutorBookingApiError("TUTOR_BOOKING_UNAVAILABLE", 503, "This booking could not be updated. Reload and try again."); frame.contentWindow?.postMessage({ type: "tutoria-center-tutor-booking-decision-error", requestId, code: apiError.code, message: apiError.message }, window.location.origin); }
      }
      if (message.type === "tutoria-center-cancel-tutor-booking" && typeof message.bookingId === "string" && typeof message.expectedVersion === "number") {
        const requestId = typeof message.requestId === "string" ? message.requestId : "";
        try { await ensureSession(); if (!getSessionAccessToken()) throw new TutorBookingApiError("UNAUTHORIZED", 401, "Sign in to manage tutor bookings."); const booking = await cancelTutorBooking(message.bookingId, message.expectedVersion, typeof message.reason === "string" ? message.reason : undefined); frame.contentWindow?.postMessage({ type: "tutoria-center-tutor-booking-cancellation", requestId, booking }, window.location.origin); }
        catch (error) { const apiError = error instanceof TutorBookingApiError ? error : new TutorBookingApiError("TUTOR_BOOKING_UNAVAILABLE", 503, "This booking could not be cancelled. Reload and try again."); frame.contentWindow?.postMessage({ type: "tutoria-center-tutor-booking-cancellation-error", requestId, code: apiError.code, message: apiError.message }, window.location.origin); }
      }
      if (message.type === "tutoria-center-load-host-bookings") {
        const requestId = typeof message.requestId === "string" ? message.requestId : "";
        if (!isLiveMode()) { frame.contentWindow?.postMessage({ type: "tutoria-center-demo", requestId }, window.location.origin); return; }
        try { await ensureSession(); if (!getSessionAccessToken()) throw new TutorBookingApiError("UNAUTHORIZED", 401, "Sign in to manage host bookings."); const bookings = await listHostBookings(); const sessionState = getSessionSnapshot(); const tutor = sessionState.status === "authenticated" ? { name: sessionState.user.name, role: sessionState.user.role } : null; frame.contentWindow?.postMessage({ type: "tutoria-center-host-bookings", requestId, bookings, tutor }, window.location.origin); }
        catch (error) { const apiError = error instanceof TutorBookingApiError ? error : new TutorBookingApiError("HOST_BOOKING_UNAVAILABLE", 503, "Host bookings are temporarily unavailable."); frame.contentWindow?.postMessage({ type: "tutoria-center-host-bookings-error", requestId, code: apiError.code, message: apiError.message }, window.location.origin); }
        return;
      }
      if (message.type === "tutoria-center-cancel-host-booking" && typeof message.bookingId === "string" && typeof message.expectedVersion === "number") {
        const requestId = typeof message.requestId === "string" ? message.requestId : "";
        try { await ensureSession(); if (!getSessionAccessToken()) throw new TutorBookingApiError("UNAUTHORIZED", 401, "Sign in to manage host bookings."); const booking = await cancelHostBooking(message.bookingId, message.expectedVersion, typeof message.reason === "string" ? message.reason : undefined); frame.contentWindow?.postMessage({ type: "tutoria-center-host-booking-cancellation", requestId, booking }, window.location.origin); }
        catch (error) { const apiError = error instanceof TutorBookingApiError ? error : new TutorBookingApiError("HOST_BOOKING_UNAVAILABLE", 503, "This booking could not be cancelled. Reload and try again."); frame.contentWindow?.postMessage({ type: "tutoria-center-host-booking-cancellation-error", requestId, code: apiError.code, message: apiError.message }, window.location.origin); }
      }
      if (message.type === "tutoria-center-decide-host-booking" && typeof message.bookingId === "string" && (message.action === "accept" || message.action === "reject")) {
        const requestId = typeof message.requestId === "string" ? message.requestId : "";
        try { await ensureSession(); if (!getSessionAccessToken()) throw new TutorBookingApiError("UNAUTHORIZED", 401, "Sign in to manage host bookings."); const booking = await decideTutorBooking(message.bookingId, message.action, typeof message.expectedVersion === "number" ? message.expectedVersion : undefined); frame.contentWindow?.postMessage({ type: "tutoria-center-host-booking-decision", requestId, booking }, window.location.origin); }
        catch (error) { const apiError = error instanceof TutorBookingApiError ? error : new TutorBookingApiError("HOST_BOOKING_UNAVAILABLE", 503, "This booking could not be updated. Reload and try again."); frame.contentWindow?.postMessage({ type: "tutoria-center-host-booking-decision-error", requestId, code: apiError.code, message: apiError.message }, window.location.origin); }
      }
    };
    window.addEventListener("message", handleMessage);
    notifyFrameReady();
    return () => window.removeEventListener("message", handleMessage);
  }, []);
  return <iframe ref={frameRef} src="/center.html" title="Tutoria Center" onLoad={notifyFrameReady} style={{ width: "100%", height: "100dvh", border: 0, display: "block" }} />;
}
