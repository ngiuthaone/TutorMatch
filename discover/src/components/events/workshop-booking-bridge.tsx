"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth/session";
import {
  getWorkshopOffering,
  getWorkshopSessions,
  createWorkshopBooking,
  startWorkshopPayment,
  type WorkshopOffering,
  type WorkshopSession,
} from "@/lib/workshop-booking-api";

interface WorkshopBookingBridgeProps {
  offeringId: string;
  className?: string;
}

interface BookingRequest {
  sessionId: string;
  participantCount: number;
}

interface BookingState {
  loading: boolean;
  error: string | null;
  bookingId: string | null;
}

/**
 * Workshop Booking Bridge
 *
 * Connects the static pizza-workshop.html iframe to the real backend.
 * Loads real offering/session data from the API and passes it to the iframe.
 * Handles booking requests from the iframe and routes them through the
 * authenticated booking API.
 */
export function WorkshopBookingBridge({ offeringId, className }: WorkshopBookingBridgeProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const session = useSession();
  const user = session.status === "authenticated" ? session.user : null;
  const [offering, setOffering] = useState<WorkshopOffering | null>(null);
  const [sessions, setSessions] = useState<WorkshopSession[]>([]);
  const [booking, setBooking] = useState<BookingState>({
    loading: false,
    error: null,
    bookingId: null,
  });

  // Load offering and sessions from API
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [offeringData, sessionsData] = await Promise.all([
          getWorkshopOffering(offeringId),
          getWorkshopSessions(offeringId),
        ]);
        if (!cancelled) {
          setOffering(offeringData);
          setSessions(sessionsData);
        }
      } catch (err) {
        console.error("Failed to load workshop data:", err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [offeringId]);

  // Send real data to iframe when it loads
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const handleLoad = () => {
      if (!frame.contentWindow) return;

      // Send auth state
      frame.contentWindow.postMessage({
        type: "tutoria-workshop-auth-state",
        authenticated: !!user,
      }, window.location.origin);

      // Send offering data
      if (offering) {
        frame.contentWindow.postMessage({
          type: "tutoria-workshop-offering",
          offering: {
            id: offering.id,
            title: offering.title,
            pricingModel: offering.pricingModel,
            pricePerParticipantVnd: offering.pricePerParticipantVnd,
            bookingMode: offering.bookingMode,
          },
        }, window.location.origin);
      }

      // Send sessions data
      if (sessions.length > 0) {
        frame.contentWindow.postMessage({
          type: "tutoria-workshop-sessions",
          sessions: sessions.map(s => ({
            id: s.id,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            minParticipants: s.minParticipants,
            maxParticipants: s.maxParticipants,
            spotsLeft: s.spotsLeft,
            status: s.status,
          })),
        }, window.location.origin);
      }
    };

    frame.addEventListener("load", handleLoad);
    return () => frame.removeEventListener("load", handleLoad);
  }, [offering, sessions, user]);

  // Send auth state changes to iframe
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({
      type: "tutoria-workshop-auth-state",
      authenticated: !!user,
    }, window.location.origin);
  }, [user]);

  const handlePaymentRequest = useCallback(async (bookingId: string) => {
    if (!user) {
      const returnUrl = window.location.href;
      window.parent.postMessage({
        type: "tutoria-auth-required",
        returnUrl,
      }, window.location.origin);
      return;
    }

    try {
      const { redirectUrl } = await startWorkshopPayment(bookingId);
      // Redirect to VNPay
      window.location.href = redirectUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      setBooking(prev => ({ ...prev, error: message }));

      frameRef.current?.contentWindow?.postMessage({
        type: "tutoria-workshop-pay-error",
        error: message,
      }, window.location.origin);
    }
  }, [user]);

  const handleBookingRequest = useCallback(async (request: BookingRequest) => {
    if (!user) {
      // Auth interception: redirect to sign-in with return URL
      const returnUrl = window.location.href;
      window.parent.postMessage({
        type: "tutoria-auth-required",
        returnUrl,
      }, window.location.origin);
      return;
    }

    setBooking({ loading: true, error: null, bookingId: null });

    try {
      const result = await createWorkshopBooking(request.sessionId, request.participantCount);

      setBooking({
        loading: false,
        error: null,
        bookingId: result.id,
      });

      // Notify iframe of successful booking
      frameRef.current?.contentWindow?.postMessage({
        type: "tutoria-workshop-booked",
        booking: {
          id: result.id,
          sessionId: result.sessionId,
          status: result.status,
          participantCount: result.participantCount,
          pricing: result.pricing,
          paymentReady: result.paymentReady,
        },
      }, window.location.origin);

      // If payment is ready (INSTANT booking), auto-start payment
      if (result.paymentReady && offering?.bookingMode === "instant") {
        handlePaymentRequest(result.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Booking failed";
      setBooking({ loading: false, error: message, bookingId: null });

      // Notify iframe of error
      frameRef.current?.contentWindow?.postMessage({
        type: "tutoria-workshop-book-error",
        error: message,
      }, window.location.origin);
    }
  }, [user, offering, handlePaymentRequest]);

  // Handle messages from iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;

      const data = event.data;
      if (!data || typeof data !== "object") return;

      // Auth required: redirect to sign-in
      if (data.type === "tutoria-workshop-auth-required") {
        const returnUrl = window.location.href;
        window.location.assign(`/auth/sign-in?next=${encodeURIComponent(returnUrl)}`);
        return;
      }

      // Email verification required
      if (data.type === "tutoria-workshop-verification-required") {
        const returnUrl = window.location.href;
        window.location.assign(`/auth/verify-email?next=${encodeURIComponent(returnUrl)}`);
        return;
      }

      // Booking request
      if (data.type === "tutoria-workshop-book") {
        handleBookingRequest(data as BookingRequest);
      }

      // Payment request
      if (data.type === "tutoria-workshop-pay") {
        handlePaymentRequest(data.bookingId);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleBookingRequest, handlePaymentRequest]);

  return (
    <div className={className}>
      <iframe
        ref={frameRef}
        title="Workshop Booking"
        src="/pizza-workshop.html"
        style={{ width: "100%", height: "100dvh", border: 0, display: "block", background: "#09090b" }}
      />
      {booking.error && (
        <div className="fixed bottom-4 right-4 bg-red-900/90 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-sm">
          <p className="text-sm">{booking.error}</p>
          <button
            onClick={() => setBooking(prev => ({ ...prev, error: null }))}
            className="text-xs underline mt-1 opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
