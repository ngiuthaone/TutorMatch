"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconLoader2,
  IconShieldCheck,
  IconX,
} from "@tabler/icons-react";
import { BookingApiError, createBooking, type BookableSession, type BookingRecord } from "@/lib/booking-api";
import { useSession, ensureSession } from "@/lib/auth/session";
import { SessionDatePicker } from "@/components/shared/session-date-picker";
import { ParticipantQuantity } from "@/components/shared/participant-quantity";

/* ── Constants ── */

const STEPS = ["When", "Guests", "Contact", "Review"] as const;
type Step = (typeof STEPS)[number];
const STEP_INDEX: Record<Step, number> = { When: 0, Guests: 1, Contact: 2, Review: 3 };
const LAST_STEP: Step = "Review";

const VN_PHONE_RE = /^(\+84|0)\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ── Helpers ── */

function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)} \u0111`;
}

function phoneToInput(value: string): string {
  return value.replace(/[^0-9+]/g, "").slice(0, 14);
}

function mapBookingError(error: unknown): string {
  if (!(error instanceof BookingApiError)) return "Something went wrong. Please try again.";
  switch (error.code) {
    case "SESSION_CAPACITY_EXHAUSTED":
      return "That session just filled up. Choose another or try again.";
    case "BOOKING_CONFLICT":
      return "You already have a booking for this session.";
    case "LEARNER_PHONE_INVALID":
      return "Enter a valid Vietnamese phone number (+84 or starting 0).";
    case "LEARNER_NAME_REQUIRED":
      return "Please enter your full name.";
    case "LEARNER_EMAIL_INVALID":
      return "Enter a valid email address.";
    case "UNAUTHORIZED":
      return "AUTH_REDIRECT_SIGN_IN";
    case "EMAIL_VERIFICATION_REQUIRED":
      return "AUTH_REDIRECT_VERIFY";
    default:
      return "Something went wrong. Please try again.";
  }
}

/* ── Props ── */

interface WorkshopBookingSheetProps {
  open: boolean;
  onClose: () => void;
  offeringId?: string;
  kind?: string;
  listingTitle: string;
  selectedSession: BookableSession | null;
  onSelectSession: (session: BookableSession) => void;
  participants: number;
  onParticipants: (qty: number) => void;
  onBooked: (booking: BookingRecord) => void;
}

/* ── Component ── */

export function WorkshopBookingSheet({
  open,
  onClose,
  offeringId,
  kind,
  listingTitle,
  selectedSession,
  onSelectSession,
  participants,
  onParticipants,
  onBooked,
}: WorkshopBookingSheetProps) {
  const session = useSession();
  const sessionUser = session.status === "authenticated" ? session.user : null;
  const [step, setStep] = useState<Step>("When");

  /* Prefill contact from the live session identity at mount (sheet mounts per
     open, so this reflects the current signed-in user each time). */
  const [name, setName] = useState(() =>
    sessionUser && sessionUser.name !== "Tutoria member" ? sessionUser.name : "",
  );
  const [email, setEmail] = useState(() => sessionUser?.email ?? "");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverTotal, setServerTotal] = useState<number | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = session.status === "authenticated";
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";

  /* Scroll lock + Escape to close (matches app overlay convention). */
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  /* Locked/modal content: focus the first step control after open. */
  useEffect(() => {
    if (open && overlayRef.current) {
      const first = overlayRef.current.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex="0"]',
      );
      first?.focus();
    }
  }, [open]);

  const stepNumber = STEP_INDEX[step] + 1;
  const isLast = step === LAST_STEP;
  const stepCount = STEPS.length;

  const spotsLeft = selectedSession?.spotsLeft ?? null;
  const maxParticipants = spotsLeft !== null ? Math.min(spotsLeft, 100) : 1;
  const unitPrice = selectedSession?.unitPriceVnd ?? null;
  const isFree = unitPrice === 0;
  const isUnknownPrice = unitPrice === null;

  const hasSession = selectedSession !== null;

  /* Validators per step. */
  const whenValid = hasSession;
  const guestsValid = hasSession;
  const contactValid =
    name.trim().length > 0 &&
    EMAIL_RE.test(email.trim()) &&
    VN_PHONE_RE.test(phone.trim()) &&
    note.length <= 500;

  const canContinue = useCallback(
    (s: Step) => {
      switch (s) {
        case "When":
          return whenValid;
        case "Guests":
          return guestsValid;
        case "Contact":
          return contactValid;
        default:
          return true;
      }
    },
    [whenValid, guestsValid, contactValid],
  );

  const goNext = () => {
    const idx = STEP_INDEX[step];
    if (idx < stepCount - 1) setStep(STEPS[idx + 1]);
  };

  const goBack = () => {
    const idx = STEP_INDEX[step];
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  /* Final submit: auth gate -> createBooking(contact) -> onBooked. */
  const handleSubmit = useCallback(async () => {
    if (!selectedSession) return;
    if (!isAuthenticated) {
      window.location.assign(`/auth/sign-in?next=${encodeURIComponent(currentPath)}`);
      return;
    }
    if (session.status === "authenticated" && session.profileErrorCode === "EMAIL_NOT_CONFIRMED") {
      window.location.assign(`/auth/verify-email?next=${encodeURIComponent(currentPath)}`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await ensureSession();
      const booking = await createBooking(selectedSession.id, participants, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setServerTotal(booking.pricing?.amountVnd ?? null);
      onBooked(booking);
    } catch (error) {
      const message = mapBookingError(error);
      if (message === "AUTH_REDIRECT_SIGN_IN") {
        window.location.assign(`/auth/sign-in?next=${encodeURIComponent(currentPath)}`);
        return;
      }
      if (message === "AUTH_REDIRECT_VERIFY") {
        window.location.assign(`/auth/verify-email?next=${encodeURIComponent(currentPath)}`);
        return;
      }
      setSubmitError(message);
      setSubmitting(false);
    }
  }, [
    selectedSession,
    isAuthenticated,
    session,
    currentPath,
    participants,
    name,
    email,
    phone,
    note,
    onBooked,
  ]);

  if (!open) return null;

  const timeLabel = selectedSession
    ? (() => {
        const d = new Date(selectedSession.startsAt);
        return (
          d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }) +
          " \u00B7 " +
          d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
        );
      })()
    : "Pick a date and time";

  const totalLabel = isFree
    ? "Free"
    : isUnknownPrice
      ? "\u2014"
      : formatVnd(unitPrice! * participants);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Book ${listingTitle}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[6px]"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Sheet / modal panel */}
      <div
        ref={overlayRef}
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-[rgba(255,255,255,0.08)] bg-[#17171a] shadow-2xl sm:max-w-[520px] sm:rounded-[28px]"
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-[rgba(255,255,255,0.15)]" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          {step !== "When" && (
            <button
              type="button"
              onClick={goBack}
              aria-label="Go back"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--muted,#a1a1aa)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
            >
              <IconArrowLeft size={18} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.9rem] font-bold text-white">{listingTitle}</p>
            <p className="text-[0.72rem] text-[var(--quiet,#71717a)]">
              Step {stepNumber} of {stepCount} \u00B7 {step}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close booking"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--muted,#a1a1aa)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-2">
          <div
            className="h-1 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((STEP_INDEX[step] / (stepCount - 1)) * 100)}
          >
            <div
              className="h-full rounded-full bg-white transition-all duration-300"
              style={{ width: `${(STEP_INDEX[step] / (stepCount - 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === "When" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight text-white">Choose a date and time</h2>
              <p className="text-[0.85rem] text-[var(--muted,#a1a1aa)]">
                Sessions fill up \u2014 pick a slot to continue. Only open slots appear.
              </p>
              <SessionDatePicker
                offeringId={offeringId}
                kind={kind}
                onSelect={onSelectSession}
                selected={selectedSession}
              />
            </div>
          )}

          {step === "Guests" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight text-white">How many people?</h2>
              <p className="text-[0.85rem] text-[var(--muted,#a1a1aa)]">
                Each participant pays separately. Remaining spots: {spotsLeft ?? "\u2014"}.
              </p>
              <ParticipantQuantity
                max={maxParticipants}
                value={participants}
                onChange={onParticipants}
              />
              {selectedSession && (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-[0.82rem] text-[var(--muted,#a1a1aa)]">
                  {timeLabel}
                </div>
              )}
            </div>
          )}

          {step === "Contact" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight text-white">Your details</h2>
              <p className="text-[0.85rem] text-[var(--muted,#a1a1aa)]">
                The host uses this to confirm your seat. Your number is only shared with the host for this workshop.
              </p>

              <label className="block">
                <span className="mb-1.5 block text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[var(--quiet,#71717a)]">
                  Full name
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Linh Tran"
                  className="w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-[0.95rem] text-white placeholder:text-[var(--quiet,#71717a)] outline-none transition-colors focus:border-[rgba(255,255,255,0.28)]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[var(--quiet,#71717a)]">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-[0.95rem] text-white placeholder:text-[var(--quiet,#71717a)] outline-none transition-colors focus:border-[rgba(255,255,255,0.28)]"
                />
                {email.trim().length > 0 && !EMAIL_RE.test(email.trim()) && (
                  <span className="mt-1.5 block text-[0.75rem] text-[#f87171]">Enter a valid email</span>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[var(--quiet,#71717a)]">
                  Phone <span className="normal-case">(VN)</span>
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(phoneToInput(e.target.value))}
                  placeholder="e.g. 0912345678"
                  inputMode="tel"
                  className="w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-[0.95rem] text-white placeholder:text-[var(--quiet,#71717a)] outline-none transition-colors focus:border-[rgba(255,255,255,0.28)]"
                />
                {phone.trim().length > 0 && !VN_PHONE_RE.test(phone.trim()) && (
                  <span className="mt-1.5 block text-[0.75rem] text-[#f87171]">
                    Use 0xxxxxxxxx or +84xxxxxxxxx
                  </span>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[var(--quiet,#71717a)]">
                  Note <span className="normal-case text-[var(--quiet,#71717a)]">(optional)</span>
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="Anything the host should know?"
                  className="w-full resize-none rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-[0.95rem] text-white placeholder:text-[var(--quiet,#71717a)] outline-none transition-colors focus:border-[rgba(255,255,255,0.28)]"
                />
                <span className="mt-1.5 block text-right text-[0.7rem] text-[var(--quiet,#71717a)]">
                  {note.length}/500
                </span>
              </label>
            </div>
          )}

          {step === "Review" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight text-white">Review and book</h2>

              <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)]">
                <div className="space-y-3 bg-[rgba(255,255,255,0.02)] px-4 py-4 text-[0.85rem]">
                  <Row label="Workshop" value={listingTitle} />
                  <Row label="Date & time" value={timeLabel} />
                  <Row label="Participants" value={`${participants} guest${participants === 1 ? "" : "s"}`} />
                  <Row label="Contact" value={`${name.trim()} \u00B7 ${email.trim()} \u00B7 ${phone.trim()}`} />
                  {note.trim() && <Row label="Note" value={note.trim()} />}
                </div>
                <div className="flex items-end justify-between gap-4 border-t border-[rgba(255,255,255,0.08)] px-4 py-4">
                  <span className="text-[0.9rem] font-semibold text-white">
                    {isFree
                      ? "Total (free)"
                      : isUnknownPrice
                        ? "Total"
                        : `Total for ${participants} guest${participants === 1 ? "" : "s"}`}
                  </span>
                  <span className="text-[1.3rem] font-bold tracking-tight text-white">
                    {isFree ? "Free" : isUnknownPrice ? "\u2014" : serverTotal != null ? formatVnd(serverTotal) : totalLabel}
                  </span>
                </div>
              </div>

              <div className="flex gap-2.5 rounded-2xl bg-[rgba(0,0,0,0.2)] px-4 py-3 text-[0.78rem] leading-relaxed text-[var(--muted,#a1a1aa)]">
                <IconShieldCheck size={16} className="mt-0.5 shrink-0 text-[var(--accent,#d6c1ad)]" />
                <span>
                  You won&apos;t be charged yet. The host confirms your request; payment happens later in a secure step.
                </span>
              </div>

              {submitError && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-xl bg-[rgba(248,113,113,0.08)] px-3.5 py-2.5 text-[0.82rem] text-[#f87171]"
                >
                  {submitError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div
          className="border-t border-[rgba(255,255,255,0.08)] p-4"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          {!isLast ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canContinue(step)}
              className="flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-[14px] bg-white text-[#09090b] font-extrabold transition-colors hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue
              <IconArrowRight size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-[14px] bg-white text-[#09090b] font-extrabold transition-colors hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <IconLoader2 size={18} className="animate-spin" />
                  Booking\u2026
                </>
              ) : (
                <>
                  <IconCheck size={18} />
                  Confirm booking
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-[var(--quiet,#71717a)]">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  );
}
