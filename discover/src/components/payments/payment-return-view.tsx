"use client";

import { useEffect, useState } from "react";
import { getLearnerBooking, type BookingRecord } from "@/lib/booking-api";
import { ensureSession, useSession } from "@/lib/auth/session";
import { paymentReturnState } from "@/lib/booking-payment-state";
import Link from "next/link";

type ViewState = "checking" | "pending" | "success" | "compensation" | "failed" | "missing" | "error";

export default function PaymentReturnView({ bookingId }: { bookingId: string }) {
  const session = useSession();
  const [state, setState] = useState<ViewState>(bookingId ? "checking" : "missing");
  const [booking, setBooking] = useState<BookingRecord | null>(null);

  useEffect(() => {
    if (!bookingId || session.status !== "authenticated") return;
    let cancelled = false;
    let timer: number | null = null;
    let attempts = 0;
    const check = async () => {
      try {
        await ensureSession();
        const next = await getLearnerBooking(bookingId);
        if (cancelled) return;
        setBooking(next);
        const nextState = paymentReturnState(next);
        setState(nextState);
        if (nextState === "pending" && attempts < 5) {
          attempts += 1;
          timer = window.setTimeout(() => void check(), 2000);
        }
      } catch {
        if (!cancelled) setState("error");
      }
    };
    void check();
    return () => { cancelled = true; if (timer !== null) window.clearTimeout(timer); };
  }, [bookingId, session.status]);

  if (session.status === "initializing" || state === "checking") return <main className="grid min-h-[100dvh] place-items-center bg-[#101011] px-6 text-center"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Payment</p><h1 className="mt-4 text-3xl font-semibold text-[#e8e6df]">Checking your payment…</h1><p className="mt-3 text-sm text-white/55">We&apos;re confirming the result with the payment provider.</p></div></main>;
  if (session.status !== "authenticated") return <main className="grid min-h-[100dvh] place-items-center bg-[#101011] px-6 text-center"><div><h1 className="text-2xl font-semibold text-[#e8e6df]">Sign in to check your payment</h1><Link className="mt-5 inline-block text-sm text-white/70 underline" href={`/auth/sign-in?next=${encodeURIComponent(`/payments/return?bookingId=${bookingId}`)}`}>Continue to sign in</Link></div></main>;
  if (state === "missing") return <ReturnMessage title="Payment return could not be matched" body="Open My bookings to check the authoritative state of your lesson." />;
  if (state === "error") return <ReturnMessage title="We couldn&apos;t check this payment" body="Refresh the page or open My bookings to check the authoritative state." />;
  if (state === "success" && booking) return <ReturnMessage title="Payment complete" body="Your session is confirmed." booking={booking} />;
  if (state === "compensation" && booking) return <ReturnMessage title="Payment received" body={booking.refund?.status === "processing" ? "We couldn't confirm this session. A refund is being processed." : "We couldn't confirm this session. Tutoria is checking the booking state."} booking={booking} />;
  if (state === "failed") return <ReturnMessage title="Payment wasn&apos;t completed" body="The payment provider did not complete this attempt. Retry only when My bookings shows payment is ready." />;
  return <ReturnMessage title="We&apos;re still confirming your payment" body="Do not pay again yet. We&apos;ll keep checking the authoritative Tutoria state for a short time." />;
}

function ReturnMessage({ title, body, booking }: { title: string; body: string; booking?: BookingRecord }) {
  return <main className="grid min-h-[100dvh] place-items-center bg-[#101011] px-6 text-center text-[#e8e6df]"><div className="max-w-lg"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Payment</p><h1 className="mt-4 text-3xl font-semibold">{title}</h1><p className="mt-4 text-sm leading-6 text-white/60">{body}</p>{booking && <p className="mt-5 text-sm text-white/75">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(booking.session.startsAt))}{booking.payment?.amountVnd ? ` · ${new Intl.NumberFormat("vi-VN").format(booking.payment.amountVnd)}₫` : ""}</p>}<Link href="/bookings" className="mt-8 inline-block rounded-xl bg-[#e8e6df] px-5 py-3 text-sm font-semibold text-[#101011]">View bookings</Link></div></main>;
}
