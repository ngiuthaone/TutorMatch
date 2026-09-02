"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { isLiveMode } from "@/lib/auth/config";
import { ensureSession, useSession } from "@/lib/auth/session";
import { BookingApiError, cancelLearnerBooking, createLearnerRescheduleRequest, getCancellationPreview, getLearnerBooking, listBookableSessions, type BookableSession, type BookingRecord, type CancellationPreview } from "@/lib/booking-api";
import { PaymentApiError, startPayment } from "@/lib/payment-api";
import { bookingAmount, bookingPaymentLabel, bookingSubtitle, bookingTitle, canCancelBooking, canStartPayment, refundAmount, refundStatusLabel } from "@/lib/booking-payment-state";
import { getOrCreateBookingConversation } from "@/lib/messaging-api";
import { submitTutorReview, TutorDashboardApiError } from "@/lib/tutor-dashboard-api";
import { RatingStars } from "@/components/rating-stars";

function money(amount: number): string { return `${new Intl.NumberFormat("vi-VN").format(amount)}₫`; }
function schedule(booking: BookingRecord): string {
  const start = new Date(booking.session.startsAt); const end = new Date(booking.session.endsAt);
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(start);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(start) + "–" + new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(end);
  return `${date} · ${time}`;
}

function cancellationCopy(preview: CancellationPreview): string {
  if (preview.paymentInFlight) return "A payment attempt is still processing. Cancelling now stops this booking; if a late payment succeeds, Tutoria will handle the resulting compensation automatically.";
  if (preview.refundMode === "FULL") return `Your payment of ${money(preview.refundAmountVnd)} will be refunded.`;
  return preview.policyCode === "ATTENDEE_CANCEL_CONFIRMED_PAID_INSIDE_CUTOFF" ? "This cancellation is not eligible for a refund." : "No payment will be refunded for this cancellation.";
}


function ReviewDialog({ booking, onClose, onSubmitted }: { booking: BookingRecord; onClose: () => void; onSubmitted: () => Promise<void> }) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [onClose]);
  const submit = async () => {
    if (state === "submitting") return;
    if (body.trim().length < 10) { setError("Review body must be at least 10 characters."); return; }
    setState("submitting"); setError("");
    try {
      await submitTutorReview({ bookingId: booking.id, rating, body: body.trim() });
      setState("idle");
      await onSubmitted();
      onClose();
    } catch (cause) {
      setState("error");
      if (cause instanceof TutorDashboardApiError) {
        setError(cause.message || "Could not submit review.");
      } else {
        setError("Could not submit review. Try again later.");
      }
    }
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="review-title" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5">
      <div ref={dialogRef} tabIndex={-1} className="w-full max-w-md rounded-3xl border border-white/15 bg-[#191919] p-6 text-[#e8e6df] shadow-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-white/40">Leave a review</p>
        <h2 id="review-title" className="mt-3 text-2xl font-semibold">How was your lesson?</h2>
        <p className="mt-2 text-xs text-white/55">Reviews help other learners choose the right tutor.</p>
        <div className="mt-3"><RatingStars value={rating} size="sm" /></div>
        <fieldset className="mt-5 flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`Rate ${value} of 5`}
              className={`h-9 w-9 rounded-full border text-lg ${rating >= value ? "border-amber-300/60 bg-amber-300/10 text-amber-300" : "border-white/15 text-white/45"}`}
            >★</button>
          ))}
        </fieldset>
        <label className="mt-5 block text-xs text-white/55">
          Your review
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            minLength={10}
            maxLength={2000}
            className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 p-3 text-sm text-white outline-none focus:border-white/30"
            placeholder="What worked well? Anything to know?"
          />
        </label>
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-4 py-3 text-sm text-white/70">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={state === "submitting"} className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black disabled:cursor-wait disabled:opacity-50">
            {state === "submitting" ? "Submitting…" : "Submit review"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CancelDialog({ booking, onClose, onCancelled, onConflict }: { booking: BookingRecord; onClose: () => void; onCancelled: (booking: BookingRecord) => Promise<void>; onConflict: () => Promise<void> }) {
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "submitting" | "error">("loading");
  const [error, setError] = useState("");
  const loadedFor = useRef("");
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (loadedFor.current === booking.id) return;
    loadedFor.current = booking.id;
    void getCancellationPreview(booking.id).then((value) => { setPreview(value); setState(value.allowed ? "ready" : "error"); if (!value.allowed) setError("This booking can no longer be cancelled."); }).catch(() => { setState("error"); setError("Cancellation details are temporarily unavailable. Refresh and try again."); });
  }, [booking.id]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const items = focusable(); if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [onClose]);
  const confirm = async () => {
    if (!preview?.allowed || state === "submitting") return;
    setState("submitting"); setError("");
    try { await onCancelled(await cancelLearnerBooking(booking.id, preview.expectedVersion)); }
    catch (cause) { if (cause instanceof BookingApiError && cause.status === 409) { await onConflict(); setError("This booking changed. Review the latest status."); } else setError("Cancellation could not be completed. Refresh and try again."); setState("error"); }
  };
  return <div role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5">
    <div ref={dialogRef} tabIndex={-1} className="w-full max-w-md rounded-3xl border border-white/15 bg-[#191919] p-6 text-[#e8e6df] shadow-2xl">
      <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-white/40">Cancel booking</p>
      <h2 id="cancel-title" className="mt-3 text-2xl font-semibold">Cancel this lesson?</h2>
      <p className="mt-3 text-sm leading-6 text-white/60">{schedule(booking)} with {booking.host?.displayName ?? booking.tutor?.displayName ?? "Tutor"}</p>
      {state === "loading" && <p className="mt-6 text-sm text-white/55">Checking the latest cancellation details…</p>}
      {state !== "loading" && preview && <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-sm leading-6 text-white/70"><p>{cancellationCopy(preview)}</p><p className="mt-3 text-xs text-white/45">The server will confirm the final result when you submit.</p></div>}
      {error && <p role="alert" className="mt-5 text-sm leading-6 text-red-300">{error}</p>}
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-4 py-3 text-sm text-white/70">Keep booking</button><button type="button" onClick={() => void confirm()} disabled={state !== "ready"} className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">{state === "submitting" ? "Cancelling…" : "Confirm cancellation"}</button></div>
    </div>
  </div>;
}
function RescheduleDialog({ booking, onClose, onRescheduled }: { booking: BookingRecord; onClose: () => void; onRescheduled: (booking: BookingRecord) => Promise<void> }) {
  const tutorProfileId = booking.session.tutorProfileId ?? null;
  const [sessions, setSessions] = useState<BookableSession[] | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const loadSessions = useCallback(async () => {
    if (!tutorProfileId) { setSessions([]); return; }
    listBookableSessions({ tutorProfileId }).then((rows) => setSessions(rows.filter((row) => new Date(row.startsAt).getTime() > now))).catch(() => setSessions([]));
  }, [tutorProfileId, now]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSessions();
  }, [loadSessions]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [onClose]);
  const pick = async (session: BookableSession) => {
    if (submitting) return;
    setSubmitting(session.id); setError("");
    try {
      await createLearnerRescheduleRequest(booking.id, session.id, booking.version);
      await onRescheduled(booking);
      onClose();
    } catch (cause) {
      setError(cause instanceof BookingApiError ? cause.message : "Could not create reschedule request. Try again later.");
      setSubmitting(null);
    }
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="reschedule-title" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5">
      <div ref={dialogRef} tabIndex={-1} className="w-full max-w-md rounded-3xl border border-white/15 bg-[#191919] p-6 text-[#e8e6df] shadow-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-white/40">Reschedule</p>
        <h2 id="reschedule-title" className="mt-3 text-2xl font-semibold">Pick a new time</h2>
        <p className="mt-2 text-xs text-white/55">Choose a session from this tutor. The tutor will confirm or decline.</p>
        <div className="mt-5 max-h-72 space-y-2 overflow-y-auto">
          {sessions === null && <p className="text-sm text-white/55">Loading available times…</p>}
          {sessions !== null && sessions.length === 0 && <p className="text-sm text-white/55">No upcoming times available.</p>}
          {sessions?.map((row) => (
            <button key={row.id} type="button" disabled={submitting !== null} onClick={() => void pick(row)} className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-black/30 p-3 text-left text-sm text-white/85 hover:border-white/40 disabled:opacity-50">
              <span>{new Date(row.startsAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" })}</span>
              <span className="text-xs text-white/45">{submitting === row.id ? "Requesting…" : "Request"}</span>
            </button>
          ))}
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-4 py-3 text-sm text-white/70">Close</button>
        </div>
      </div>
    </div>
  );
}




function BookingCard({ booking, onRefresh }: { booking: BookingRecord; onRefresh: (bookingId: string) => Promise<void> }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false); const [error, setError] = useState(""); const [cancelOpen, setCancelOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const canReview = booking.status === "completed"; const startingRef = useRef(false);
  const [messaging, setMessaging] = useState<"idle" | "opening" | "error">("idle");
  const amount = bookingAmount(booking); const canPay = canStartPayment(booking); const accepted = booking.paymentReady || booking.status === "confirmed"; const paid = booking.payment?.status === "succeeded"; const confirmed = booking.status === "confirmed" && paid;
  const pay = async () => { if (!canPay || amount === null || startingRef.current) return; startingRef.current = true; setStarting(true); setError(""); try { const result = await startPayment(booking.id); window.location.assign(result.redirectUrl); } catch (cause) { startingRef.current = false; setStarting(false); if (cause instanceof PaymentApiError) await onRefresh(booking.id); setError(cause instanceof Error ? cause.message : "Payment could not be started. Refresh and try again."); } };
  const openConversation = async () => {
    if (messaging === "opening") return;
    setMessaging("opening"); setError("");
    try {
      const conversation = await getOrCreateBookingConversation(booking.id);
      router.push(`/messages?conversationId=${encodeURIComponent(conversation.id)}`);
    } catch (cause) {
      setMessaging("error");
      setError(cause instanceof Error ? cause.message : "Messaging is temporarily unavailable. Please try again.");
    }
  };
  const duration = booking.pricing?.durationMinutes ?? Math.round((new Date(booking.session.endsAt).getTime() - new Date(booking.session.startsAt).getTime()) / 60000);
  return <article className="overflow-hidden rounded-[28px] border border-white/[.13] bg-[#171717] shadow-[0_28px_100px_rgba(0,0,0,.42)]">
    <div className="border-b border-white/[.12] px-5 py-6 sm:px-8"><p className="text-[11px] font-semibold uppercase tracking-[.22em] text-white/40">Booking</p><div className="mt-3 flex flex-wrap items-center gap-3"><h2 className="text-[30px] font-semibold tracking-[-.035em] text-white">{bookingTitle(booking)}</h2><span className="rounded-full border border-white/[.16] px-3 py-1 text-[10px] tracking-[.14em]">{booking.status === "cancelled" ? "CANCELLED" : booking.status === "rejected" ? "REJECTED" : confirmed ? "CONFIRMED" : booking.paymentReady ? "PAYMENT REQUIRED" : "REQUESTED"}</span></div><p className="mt-3 text-sm text-white/45">{bookingSubtitle(booking)}</p></div>
    <div className="grid gap-5 p-5 sm:p-8 md:grid-cols-[1.2fr_.8fr]"><section className="rounded-2xl border border-white/[.12] bg-white/[.025] p-5"><p className="text-[11px] font-semibold tracking-[.18em] text-white/38">SESSION DETAILS</p><p className="mt-4 text-lg font-semibold text-white">{schedule(booking)}</p><p className="mt-2 text-sm text-white/60">Online · {duration} minutes</p><div className="mt-7 grid grid-cols-2 gap-5 border-t border-white/[.12] pt-5">        <div><p className="text-[11px] text-white/36">Host</p><p className="mt-1 text-sm text-white/80">{booking.host?.displayName ?? booking.tutor?.displayName ?? "Tutor"}</p></div><div><p className="text-[11px] text-white/36">Price</p><p className="mt-1 text-sm text-white/80">{amount === null ? "—" : money(amount)}</p></div></div><div className="mt-5 border-t border-white/[.12] pt-5"><p className="text-[11px] text-white/36">Payment</p><p className="mt-1 text-sm text-white/80">{bookingPaymentLabel(booking)}</p>{booking.paymentInFlight && <p className="mt-2 text-xs text-amber-200/80">Payment is still processing. Refresh for the latest result.</p>}</div>{refundStatusLabel(booking) && <p className="mt-5 rounded-xl border border-white/10 bg-white/[.03] p-3 text-sm text-white/70">{refundStatusLabel(booking)}{refundAmount(booking) !== null && refundAmount(booking)! > 0 ? ` · ${money(refundAmount(booking)!)}` : ""}</p>}</section>
      <section className="rounded-2xl border border-white/[.12] bg-[#111111] p-5"><p className="text-[11px] font-semibold tracking-[.18em] text-white/38">TIMELINE</p><div className="mt-6 space-y-4 text-sm"><p className="text-white">✓ Request submitted</p><p className={accepted ? "text-white" : booking.status === "cancelled" || booking.status === "rejected" ? "text-white/55" : "text-white/35"}>{accepted ? "✓ Tutor accepted" : booking.status === "rejected" ? "✓ Tutor declined" : booking.status === "cancelled" ? "✓ Booking cancelled" : "● Waiting for tutor approval"}</p><p className={paid || accepted ? "text-white" : "text-white/35"}>{paid ? "✓ Payment complete" : accepted ? "● Payment required" : "○ Payment"}</p><p className={confirmed ? "text-white" : "text-white/35"}>{confirmed ? "✓ Booking confirmed" : "○ Booking confirmed"}</p></div></section></div>
    {canPay && amount !== null && <div className="mx-5 mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[.10] bg-white/[.025] p-5 sm:mx-8 sm:mb-8"><div><p className="text-[10px] tracking-[.18em] text-white/36">AMOUNT DUE</p><p className="mt-2 text-2xl font-semibold text-white">{money(amount)}</p><p className="mt-2 text-xs text-white/40">Your booking will be confirmed after payment is verified.</p></div><button type="button" onClick={() => void pay()} disabled={starting || booking.paymentInFlight} className="rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-black disabled:cursor-wait disabled:opacity-50">{booking.paymentInFlight ? "Payment processing…" : starting ? "Starting payment…" : booking.payment?.status === "pending" ? `Continue payment · ${money(amount)}` : `Pay ${money(amount)}`}</button></div>}
    {canCancelBooking(booking) && (<div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[.1] px-5 py-4 sm:px-8"><p className="text-xs text-white/45">Need a different time?</p><button type="button" onClick={() => setCancelOpen(true)} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm text-white/80">{booking.status === "requested" && !booking.paymentReady ? "Cancel request" : "Cancel booking"}</button></div>)}
    {(booking.status === "requested" || booking.status === "confirmed") && (<div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[.1] px-5 py-4 sm:px-8"><p className="text-xs text-white/45">Need a different time?</p><button type="button" onClick={() => setRescheduleOpen(true)} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm text-white/80">Reschedule</button></div>)}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[.1] px-5 py-4 sm:px-8"><p className="text-xs text-white/45">Need to send a note to {booking.host?.displayName ?? booking.tutor?.displayName ?? "the host"}?</p><button type="button" onClick={() => void openConversation()} disabled={messaging === "opening"} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm text-white/80 disabled:cursor-wait disabled:opacity-50">{messaging === "opening" ? "Opening…" : messaging === "error" ? "Try again" : "Message"}</button></div>
    {booking.payment?.status === "succeeded" && booking.status !== "confirmed" && <p className="mx-5 mb-5 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] p-4 text-sm leading-6 text-amber-100 sm:mx-8 sm:mb-8">Payment received, but this session could not be confirmed. {booking.refund?.status === "processing" ? "A refund is being processed." : "Tutoria is checking the booking state."}</p>}
    {canReview && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[.1] px-5 py-4 sm:px-8"><p className="text-xs text-white/55">This lesson is complete.</p><button type="button" onClick={() => setReviewOpen(true)} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black">Leave a review</button></div>}
    {error && <p role="alert" className="mx-5 mb-5 text-sm text-red-300 sm:mx-8 sm:mb-8">{error}</p>}{cancelOpen && <CancelDialog booking={booking} onClose={() => setCancelOpen(false)} onConflict={() => onRefresh(booking.id)} onCancelled={async (next) => { setCancelOpen(false); await onRefresh(next.id); }} />}{rescheduleOpen && <RescheduleDialog booking={booking} onClose={() => setRescheduleOpen(false)} onRescheduled={async (next) => { setRescheduleOpen(false); await onRefresh(next.id); }} />}{reviewOpen && <ReviewDialog booking={booking} onClose={() => setReviewOpen(false)} onSubmitted={async () => { await onRefresh(booking.id); }} />}
  </article>;
}

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = typeof params.id === "string" ? params.id : "";
  const session = useSession();
  const live = isLiveMode();
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "not-found">("loading");

  const cancelled = useRef(false);

  const refresh = useCallback(async () => {
    cancelled.current = false;
    if (!bookingId) return;
    if (cancelled.current) return;
    setStatus("loading");
    try {
      await ensureSession();
      const result = await getLearnerBooking(bookingId);
      setBooking(result);
      setStatus("ready");
    } catch (cause) {
      if (cause instanceof BookingApiError && cause.status === 404) {
        if (cancelled.current) return;
        setStatus("not-found");
      } else {
        if (cancelled.current) return;
        setStatus("error");
      }
    }
  }, [bookingId]);

  useEffect(() => {
    cancelled.current = false;
  }, [bookingId]);

  useEffect(() => {
    if (session.status === "authenticated") {
      startTransition(() => { void refresh(); });
    }
  }, [session.status, refresh]);

  useEffect(() => {
    if (session.status === "anonymous") {
      router.replace(`/auth/sign-in?next=%2Fbookings%2F${encodeURIComponent(bookingId)}`);
    }
  }, [session.status, router, bookingId]);

  if (!live) {
    return <main className="grid min-h-[100dvh] place-items-center bg-[#101011] px-6 text-center text-white/70">Bookings are available in live mode.</main>;
  }

  if (session.status === "initializing" || session.status === "anonymous") {
    return <main className="min-h-[100dvh] bg-[#101011] px-5 py-16 text-white/50">Loading…</main>;
  }

  if (status === "loading") {
    return <main className="min-h-[100dvh] bg-[#101011] px-5 py-16 text-white/50">Loading your booking…</main>;
  }

  if (status === "not-found") {
    return <main className="grid min-h-[100dvh] place-items-center bg-[#101011] px-6 text-center"><div><h1 className="text-2xl font-semibold text-[#e8e6df]">Booking not found</h1><p className="mt-3 text-sm text-white/55">This booking may have been removed or you may not have access to it.</p><Link className="mt-5 inline-block text-sm text-white/70 underline" href="/bookings">Back to bookings</Link></div></main>;
  }

  if (status === "error") {
    return <main className="grid min-h-[100dvh] place-items-center bg-[#101011] px-6 text-center"><div><h1 className="text-2xl font-semibold text-[#e8e6df]">Booking details are temporarily unavailable</h1><button type="button" onClick={() => void refresh()} className="mt-5 rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80">Try again</button></div></main>;
  }

  return <main className="min-h-[100dvh] bg-[#101011] px-5 py-12 text-[#e8e6df] sm:px-10"><div className="mx-auto max-w-4xl"><Link className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 mb-8" href="/bookings">← Back to bookings</Link><p className="text-xs font-semibold uppercase tracking-[.18em] text-white/40">Your learning</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Booking details</h1>{booking && <><div className="mt-10"><BookingCard key={booking.id} booking={booking} onRefresh={async (id) => { await refresh(); }} /></div>{booking.status === "cancelled" && <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm text-white/70">This booking has been cancelled.</div>}</>}</div></main>;
}
