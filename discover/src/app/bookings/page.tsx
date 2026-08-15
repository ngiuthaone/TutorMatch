"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isLiveMode } from "@/lib/auth/config";
import { ensureSession, useSession } from "@/lib/auth/session";
import { getLearnerBooking, listLearnerBookings, type BookingRecord } from "@/lib/booking-api";
import { PaymentApiError, startPayment } from "@/lib/payment-api";
import { bookingAmount, bookingApprovalLabel, bookingPaymentLabel, bookingSubtitle, bookingTitle, canStartPayment } from "@/lib/booking-payment-state";

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

  const duration = booking.pricing?.durationMinutes ?? Math.round((new Date(booking.session.endsAt).getTime() - new Date(booking.session.startsAt).getTime()) / 60000);
  const accepted = booking.paymentReady || booking.status === "confirmed";
  const paid = booking.payment?.status === "succeeded";
  const confirmed = booking.status === "confirmed" && paid;
  const title = bookingTitle(booking);
  const subtitle = bookingSubtitle(booking);

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/[0.13] bg-[#171717] shadow-[0_28px_100px_rgba(0,0,0,.42)]">
      <div className="border-b border-white/[0.12] px-5 py-6 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">Booking</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h2 className="text-[30px] font-semibold tracking-[-.035em] text-white">{title}</h2>
          {(confirmed || booking.status === "rejected") && <span className="rounded-full border border-white/[0.16] px-3 py-1 text-[10px] tracking-[.14em]">{confirmed ? "CONFIRMED" : "REJECTED"}</span>}
        </div>
        <p className="mt-3 text-sm text-white/45">{subtitle}</p>
      </div>

      <div className="grid gap-5 p-5 sm:p-8 md:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-2xl border border-white/[0.12] bg-white/[0.025] p-5">
          <p className="text-[11px] font-semibold tracking-[.18em] text-white/38">SESSION DETAILS</p>
          <p className="mt-4 text-lg font-semibold text-white">{formatSchedule(booking)}</p>
          <p className="mt-2 text-sm text-white/60">Online · {duration} minutes</p>
          <div className="mt-7 grid grid-cols-2 gap-5 border-t border-white/[0.12] pt-5">
            <div><p className="text-[11px] text-white/36">Tutor</p><p className="mt-1 text-sm text-white/80">{booking.tutor.displayName}</p></div>
            <div><p className="text-[11px] text-white/36">Price</p><p className="mt-1 text-sm text-white/80">{amount === null ? "—" : formatMoney(amount)}</p></div>
          </div>
          <div className="mt-5 border-t border-white/[0.12] pt-5">
            <p className="text-[11px] text-white/36">Payment</p>
            <p className="mt-1 text-sm text-white/80">{bookingPaymentLabel(booking)}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.12] bg-[#111111] p-5">
          <p className="text-[11px] font-semibold tracking-[.18em] text-white/38">TIMELINE</p>
          <div className="mt-6 space-y-4 text-sm">
            <p className="text-white">✓ Request submitted</p>
            <p className={accepted ? "text-white" : "text-white/35"}>{accepted ? "✓" : "●"} {bookingApprovalLabel(booking)}</p>
            <p className={paid || accepted ? "text-white" : "text-white/35"}>{paid ? "✓ Payment complete" : accepted ? "● Payment required" : "○ Payment"}</p>
            <p className={confirmed ? "text-white" : "text-white/35"}>{confirmed ? "✓" : "○"} Booking confirmed</p>
          </div>
        </section>
      </div>

      {canPay && amount !== null && (
        <div className="mx-5 mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.10] bg-white/[0.025] p-5 sm:mx-8 sm:mb-8">
          <div><p className="text-[10px] tracking-[.18em] text-white/36">AMOUNT DUE</p><p className="mt-2 text-2xl font-semibold text-white">{formatMoney(amount)}</p><p className="mt-2 text-xs text-white/40">Your booking will be confirmed after payment is verified.</p></div>
          <button type="button" onClick={() => void pay()} disabled={starting} className="rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-black disabled:cursor-wait disabled:opacity-50">
            {starting ? "Starting payment…" : booking.payment?.status === "pending" ? `Continue payment · ${formatMoney(amount)}` : `Pay ${formatMoney(amount)}`}
          </button>
        </div>
      )}

      {booking.payment?.status === "succeeded" && booking.status !== "confirmed" && <p className="mx-5 mb-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100 sm:mx-8 sm:mb-8">Payment received, but this session could not be confirmed. {booking.refund?.status === "processing" ? "A refund is being processed." : "Tutoria is checking the booking state."}</p>}
      {error && <p role="alert" className="mx-5 mb-5 text-sm text-red-300 sm:mx-8 sm:mb-8">{error}</p>}
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
