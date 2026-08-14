"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isLiveMode } from "@/lib/auth/config";
import { ensureSession, useSession } from "@/lib/auth/session";
import { getLearnerBooking, listLearnerBookings, type BookingRecord } from "@/lib/booking-api";
import { PaymentApiError, startPayment } from "@/lib/payment-api";
import { bookingAmount, canStartPayment } from "@/lib/booking-payment-state";

function formatMoney(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}₫`;
}

function formatSchedule(booking: BookingRecord): string {
  const start = new Date(booking.session.startsAt);
  const end = new Date(booking.session.endsAt);
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(start);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(start)
    + "–"
    + new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(end);
  return `${date} · ${time}`;
}

function statusCopy(booking: BookingRecord): string {
  if (booking.status === "confirmed") return "Confirmed";
  if (booking.status === "rejected") return "Request declined";
  if (booking.payment?.status === "succeeded" && booking.refund?.status === "processing") return "Payment received · confirmation needs attention";
  if (booking.paymentReady) return "Payment required";
  return "Waiting for tutor response";
}

function BookingCard({ booking, onRefresh }: { booking: BookingRecord; onRefresh: (bookingId: string) => Promise<void> }) {
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const [error, setError] = useState("");
  const amount = bookingAmount(booking);
  const canPay = canStartPayment(booking);

  const pay = async () => {
    if (!canPay || amount === null || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError("");
    try {
      const result = await startPayment(booking.id);
      window.location.assign(result.redirectUrl);
    } catch (cause) {
      startingRef.current = false;
      setStarting(false);
      if (cause instanceof PaymentApiError && ["PAYMENT_NOT_READY", "PAYMENT_NOT_RETRYABLE", "INVALID_LIFECYCLE_TRANSITION", "FORBIDDEN"].includes(cause.code)) {
        await onRefresh(booking.id);
      }
      setError(cause instanceof Error ? cause.message : "Payment could not be started. Refresh and try again.");
    }
  };

  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Tutor session</p>
          <h2 className="mt-2 text-xl font-semibold text-[#e8e6df]">Your one-to-one lesson</h2>
          <p className="mt-2 text-sm text-white/60">{formatSchedule(booking)}</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70">{statusCopy(booking)}</span>
      </div>

      <div className="mt-7 grid gap-3 text-sm text-white/65 sm:grid-cols-3">
        <div><p className="text-xs uppercase tracking-[0.14em] text-white/35">Format</p><p className="mt-1 text-white/80">Online</p></div>
        <div><p className="text-xs uppercase tracking-[0.14em] text-white/35">Duration</p><p className="mt-1 text-white/80">{booking.pricing?.durationMinutes ?? Math.round((new Date(booking.session.endsAt).getTime() - new Date(booking.session.startsAt).getTime()) / 60000)} minutes</p></div>
        <div><p className="text-xs uppercase tracking-[0.14em] text-white/35">Amount</p><p className="mt-1 text-white/80">{amount === null ? "—" : formatMoney(amount)}</p></div>
      </div>

      <div className="mt-7 border-t border-white/10 pt-5">
        <div className="grid gap-3 text-sm sm:grid-cols-4">
          <span className="text-white/75">✓ Request submitted</span>
          <span className={booking.paymentReady || booking.status === "confirmed" ? "text-white/75" : "text-white/35"}>{booking.paymentReady || booking.status === "confirmed" ? "✓" : "○"} Tutor accepted</span>
          <span className={booking.payment?.status === "succeeded" || booking.paymentReady ? "text-white/75" : "text-white/35"}>{booking.payment?.status === "succeeded" ? "✓" : booking.paymentReady ? "●" : "○"} {booking.payment?.status === "succeeded" ? "Payment complete" : "Payment required"}</span>
          <span className={booking.status === "confirmed" ? "text-white/75" : "text-white/35"}>{booking.status === "confirmed" ? "✓" : "○"} Booking confirmed</span>
        </div>
      </div>

      {canPay && amount !== null && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/[0.05] p-4">
          <div><p className="text-xs uppercase tracking-[0.14em] text-white/40">Amount due</p><p className="mt-1 text-lg font-semibold text-[#e8e6df]">{formatMoney(amount)}</p></div>
          <button type="button" onClick={() => void pay()} disabled={starting} className="rounded-xl bg-[#e8e6df] px-5 py-3 text-sm font-semibold text-[#101011] disabled:cursor-wait disabled:opacity-50">
            {starting ? "Starting payment…" : booking.payment?.status === "pending" ? `Continue payment · ${formatMoney(amount)}` : `Pay ${formatMoney(amount)}`}
          </button>
        </div>
      )}

      {booking.payment?.status === "succeeded" && booking.status !== "confirmed" && (
        <p className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100">Payment received, but this session could not be confirmed. {booking.refund?.status === "processing" ? "A refund is being processed." : "Tutoria is checking the booking state."}</p>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    </article>
  );
}

export default function BookingsPage() {
  const session = useSession();
  const live = isLiveMode();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      await ensureSession();
      setBookings(await listLearnerBookings());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  const refreshOne = useCallback(async (bookingId: string) => {
    const next = await getLearnerBooking(bookingId);
    setBookings((current) => current.map((item) => item.id === bookingId ? next : item));
  }, []);

  useEffect(() => {
    if (live && session.status === "authenticated") {
      const timer = window.setTimeout(() => void load(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [live, load, session.status]);

  if (!live) return <main className="grid min-h-[100dvh] place-items-center bg-[#101011] px-6 text-center text-white/70">Bookings are available in live mode.</main>;
  if (session.status === "initializing" || status === "loading") return <main className="min-h-[100dvh] bg-[#101011] px-5 py-16 text-white/50">Loading your bookings…</main>;
  if (session.status !== "authenticated") return <main className="grid min-h-[100dvh] place-items-center bg-[#101011] px-6 text-center"><div><h1 className="text-2xl font-semibold text-[#e8e6df]">Sign in to view your bookings</h1><a className="mt-5 inline-block text-sm text-white/70 underline" href="/auth/sign-in?next=%2Fbookings">Continue to sign in</a></div></main>;
  if (status === "error") return <main className="grid min-h-[100dvh] place-items-center bg-[#101011] px-6 text-center"><div><h1 className="text-2xl font-semibold text-[#e8e6df]">Bookings are temporarily unavailable</h1><button type="button" onClick={() => void load()} className="mt-5 rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80">Try again</button></div></main>;
  return <main className="min-h-[100dvh] bg-[#101011] px-5 py-12 text-[#e8e6df] sm:px-10"><div className="mx-auto max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Your learning</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">My bookings</h1><p className="mt-3 max-w-xl text-sm leading-6 text-white/55">Keep your Tutor requests and confirmed lessons in one place.</p><div className="mt-10 grid gap-5">{bookings.length ? bookings.map((booking) => <BookingCard key={booking.id} booking={booking} onRefresh={refreshOne} />) : <div className="rounded-3xl border border-white/10 p-8 text-sm text-white/55">You have no Tutor bookings yet.</div>}</div></div></main>;
}
