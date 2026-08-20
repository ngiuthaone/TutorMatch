"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconBookmark,
  IconCheck,
  IconClock,
  IconInfoCircle,
  IconMapPin,
  IconPlus,
  IconShare,
  IconWorld,
} from "@tabler/icons-react";
import { BookingApiError, createBooking, listBookableSessions, type BookableSession, type BookingRecord } from "@/lib/booking-api";
import { useSession, ensureSession } from "@/lib/auth/session";
import { SessionDatePicker } from "@/components/shared/session-date-picker";
import { ParticipantQuantity } from "@/components/shared/participant-quantity";
import { PriceSummary } from "@/components/shared/price-summary";
import { BookingCTA, MobileBookingBar } from "@/components/shared/booking-cta";
import { HostSummaryCard } from "@/components/shared/host-summary-card";
import styles from "./event-detail-page.module.css";

/* ── Helpers ── */

function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)} \u0111`;
}

function mapBookingError(error: unknown): string {
  if (!(error instanceof BookingApiError)) return "Something went wrong. Please try again.";
  switch (error.code) {
    case "SESSION_CAPACITY_EXHAUSTED":
      return "That session is full. Choose another.";
    case "BOOKING_CONFLICT":
      return "This conflicts with another booking.";
    case "UNAUTHORIZED":
      return "AUTH_REDIRECT_SIGN_IN";
    case "EMAIL_VERIFICATION_REQUIRED":
      return "AUTH_REDIRECT_VERIFY";
    default:
      return "Something went wrong. Please try again.";
  }
}

/* ── Types ── */

interface EventData {
  offeringId: string;
  title: string;
  hostName: string;
  hostId: string;
  unitPriceVnd: number | null;
  sessions: BookableSession[];
}

type PageState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "ready"; data: EventData };

/* ── Component ── */

interface EventDetailPageProps {
  slug: string;
}

export function EventDetailPage({ slug }: EventDetailPageProps) {
  const session = useSession();
  const [page, setPage] = useState<PageState>({ status: "loading" });
  const [selectedSession, setSelectedSession] = useState<BookableSession | null>(null);
  const [participants, setParticipants] = useState(1);
  const [saved, setSaved] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }, []);

  /* Fetch event sessions */
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let active = true;
    setPage({ status: "loading" });

    (async () => {
      try {
        const sessions = await listBookableSessions({ kind: "event", offeringId: slug });
        if (!active || controller.signal.aborted) return;
        if (sessions.length === 0) {
          setPage({ status: "not-found" });
          return;
        }
        /* Derive event info from the first session's offering data */
        const first = sessions[0];
        const data: EventData = {
          offeringId: first.offering?.id ?? slug,
          title: first.offering?.title ?? "Event",
          hostName: first.host?.displayName ?? "Host",
          hostId: first.host?.id ?? "",
          unitPriceVnd: first.unitPriceVnd ?? null,
          sessions,
        };
        setPage({ status: "ready", data });
      } catch {
        if (active && !controller.signal.aborted) setPage({ status: "not-found" });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [slug]);

  /* Reset session selection when data changes */
  useEffect(() => {
    setSelectedSession(null);
    setParticipants(1);
    setBookingError(null);
  }, [page]);

  /* Derived data */
  const data = page.status === "ready" ? page.data : null;

  const unitPrice = selectedSession?.unitPriceVnd ?? data?.unitPriceVnd ?? null;
  const isFree = unitPrice === 0;
  const isUnknownPrice = unitPrice === null;
  const spotsLeft = selectedSession?.spotsLeft ?? null;
  const maxParticipants = spotsLeft !== null ? Math.min(spotsLeft, 100) : 1;

  const priceLabel = useMemo(() => {
    if (isFree) return "Free";
    if (isUnknownPrice) return "\u2014";
    return formatVnd(unitPrice! * participants);
  }, [unitPrice, participants, isFree, isUnknownPrice]);

  const sessionLabel = useMemo(() => {
    if (!selectedSession) return "Choose a session";
    const start = new Date(selectedSession.startsAt);
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }) +
      " " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    return fmt(start);
  }, [selectedSession]);

  const ctaDisabled = !selectedSession || isUnknownPrice || bookingLoading;
  const ctaLabel = !selectedSession
    ? "Choose a session"
    : isUnknownPrice
      ? "Price to be confirmed"
      : isFree
        ? "Register"
        : "Continue";

  /* Auth gate */
  const isAuthenticated = session.status === "authenticated";
  const currentPath = typeof window !== "undefined" ? window.location.pathname : `/events-live/${slug}`;

  /* Booking handler */
  const handleBooking = useCallback(async () => {
    if (!selectedSession) return;

    /* Auth gate check */
    if (!isAuthenticated) {
      window.location.assign(`/auth/sign-in?next=${encodeURIComponent(currentPath)}`);
      return;
    }

    /* Email verification check */
    if (session.status === "authenticated" && session.profileErrorCode === "EMAIL_NOT_CONFIRMED") {
      window.location.assign(`/auth/verify-email?next=${encodeURIComponent(currentPath)}`);
      return;
    }

    setBookingLoading(true);
    setBookingError(null);

    try {
      await ensureSession();
      const booking: BookingRecord = await createBooking(selectedSession.id, participants);
      const serverTotal = booking.pricing?.amountVnd;
      showToast(
        isFree
          ? "Registration confirmed"
          : serverTotal != null
            ? `Booking created \u00B7 ${formatVnd(serverTotal)}`
            : "Booking created",
      );
      /* Redirect to booking detail */
      window.location.assign(`/bookings/${booking.id}`);
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
      setBookingError(message);
      setBookingLoading(false);
    }
  }, [selectedSession, isAuthenticated, session, participants, currentPath, isFree, showToast]);

  /* Share handler */
  const handleShare = async () => {
    const shareData = { title: data?.title ?? "Event", url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast("Link copied.");
      }
    } catch {
      showToast("The link is ready in your address bar.");
    }
  };

  /* ── Duration helper ── */
  const durationFromSession = (s: BookableSession): string => {
    const ms = Date.parse(s.endsAt) - Date.parse(s.startsAt);
    if (!Number.isFinite(ms) || ms <= 0) return "";
    const totalMinutes = Math.round(ms / 60_000);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  /* ── Loading skeleton ── */
  if (page.status === "loading") {
    return (
      <div className={styles.page} aria-busy="true">
        <header className={styles.topBar}>
          <div className={styles.topBarInner}>
            <Link href="/events-live" className={styles.backLink}>
              <IconArrowLeft size={16} /> Events
            </Link>
          </div>
        </header>
        <main className={styles.main}>
          <div className={styles.heroSection}>
            <div className={styles.heroGrid}>
              <div className={styles.heroContent}>
                <div className={`${styles.skeleton} h-12 w-3/4 mb-4`} />
                <div className={`${styles.skeleton} h-6 w-1/2 mb-6`} />
                <div className={`${styles.skeleton} h-16 w-full mt-8`} />
              </div>
              <div className={styles.bookingPanel}>
                <div className="p-6 space-y-4">
                  <div className={`${styles.skeleton} h-10 w-full`} />
                  <div className={`${styles.skeleton} h-16 w-full`} />
                  <div className={`${styles.skeleton} h-12 w-full`} />
                  <div className={`${styles.skeleton} h-12 w-full`} />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ── Not found ── */
  if (page.status === "not-found" || !data) {
    return (
      <div className={`${styles.page} ${styles.notFound}`}>
        <div>
          <h1>Event not found</h1>
          <p>This event is unavailable or has not been published.</p>
          <Link href="/events-live">Back to events</Link>
        </div>
      </div>
    );
  }

  /* ── Facts derived from session data ── */
  const duration = selectedSession ? durationFromSession(selectedSession) : null;
  const facts = [
    duration && { label: "Duration", value: duration },
    data.unitPriceVnd != null && { label: "Price", value: isFree ? "Free" : `${formatVnd(data.unitPriceVnd)} / attendee` },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  /* ── Good-to-know items ── */
  const goodToKnow = [
    "Arrive 5 minutes early for check-in.",
    "The host will share details after registration.",
    "Check your email for event updates.",
  ];

  return (
    <div className={styles.page}>
      {/* ── Top bar ── */}
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <Link href="/events-live" className={styles.backLink}>
            <IconArrowLeft size={16} /> Events
          </Link>
          <div className={styles.topTitle}>
            <span>Tutoria</span>
            <strong>Event</strong>
          </div>
          <div className={styles.topActions}>
            <button type="button" aria-label="Share event" onClick={handleShare}>
              <IconShare size={17} />
            </button>
            <button
              type="button"
              className={saved ? styles.savedAction : undefined}
              onClick={() => {
                setSaved((v) => !v);
                showToast(saved ? "Removed from saved events." : "Saved to your events.");
              }}
            >
              <IconBookmark size={17} fill={saved ? "currentColor" : "none"} />
              <span>Save</span>
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* ── Hero section ── */}
        <section className={styles.heroSection} aria-labelledby="event-title">
          <div className={styles.heroGrid}>
            <div className={styles.heroContent}>
              <span className={styles.categoryBadge}>Event</span>
              <h1 id="event-title">{data.title}</h1>

              <div className={styles.heroMeta}>
                {duration && (
                  <span>
                    <IconClock size={16} /> {duration}
                  </span>
                )}
                {spotsLeft != null && (
                  <span>
                    <IconMapPin size={16} /> {spotsLeft} spots available
                  </span>
                )}
              </div>
            </div>

            {/* ── Registration panel (desktop sticky) ── */}
            <aside className={styles.bookingPanel} aria-label="Registration summary">
              <div className={styles.bookingHead}>
                <div>
                  <strong>
                    {isFree ? "Free" : isUnknownPrice ? "\u2014" : formatVnd(unitPrice!)}
                  </strong>
                  {!isFree && !isUnknownPrice && <span>/ attendee</span>}
                </div>
                {spotsLeft != null && (
                  <em>{spotsLeft} spots</em>
                )}
              </div>

              <div className="space-y-0">
                {/* Session picker */}
                <div className="mx-4 mt-3">
                  <SessionDatePicker
                    offeringId={data.offeringId}
                    kind="event"
                    onSelect={setSelectedSession}
                    selected={selectedSession}
                  />
                </div>

                {/* Spots remaining */}
                {selectedSession && spotsLeft != null && spotsLeft > 0 && (
                  <p
                    className={`${styles.spotsRemaining} ${spotsLeft <= 3 ? styles.urgent : ""}`}
                  >
                    {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} remaining
                  </p>
                )}

                {/* Participant quantity */}
                {selectedSession && (
                  <div className="mx-4 mt-3">
                    <ParticipantQuantity
                      max={maxParticipants}
                      value={participants}
                      onChange={setParticipants}
                    />
                  </div>
                )}

                {/* Price summary */}
                <div className="mt-3 border-t border-[rgba(255,255,255,0.08)]">
                  <PriceSummary
                    unitPrice={unitPrice}
                    quantity={participants}
                    serverTotal={null}
                  />
                </div>

                {/* Desktop CTA */}
                <div className="p-5">
                  <BookingCTA
                    onClick={handleBooking}
                    loading={bookingLoading}
                    error={bookingError}
                    disabled={ctaDisabled}
                    label={ctaLabel}
                    mobileLabel={isFree ? "Register" : "Book event"}
                  />
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* ── Section nav ── */}
        <nav className={styles.sectionNav} aria-label="Event sections">
          <a href="#overview">Overview</a>
          <a href="#schedule">Schedule</a>
          {facts.length > 0 && <a href="#details">Details</a>}
          <a href="#host">Host</a>
          <a href="#good-to-know">Good to know</a>
        </nav>

        {/* ── Overview ── */}
        <section id="overview" className={styles.overviewSection}>
          <span className={styles.sectionLabel}>About this event</span>
          <h2>{data.title}</h2>
          <div>
            <p>
              Join {data.hostName}&apos;s event and connect with fellow attendees.
              This event is designed to bring people together around shared
              interests and learning goals.
            </p>
          </div>
        </section>

        {/* ── Details: facts ── */}
        {facts.length > 0 && (
          <section id="details" className={styles.detailsSection}>
            <div className="rounded-[32px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-8">
              <span className="block text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-[var(--quiet,#71717a)]">
                Event details
              </span>
              <dl className="mt-8 grid gap-6">
                {facts.map((fact, index) => (
                  <div
                    key={fact.label}
                    className={`pt-6 ${index === 0 ? "!border-t-0 !pt-0" : "border-t border-[rgba(255,255,255,0.08)]"}`}
                  >
                    <dt className="text-[0.625rem] font-extrabold uppercase tracking-[0.16em] text-[var(--quiet,#71717a)]">
                      {fact.label}
                    </dt>
                    <dd className="mt-2 text-[0.95rem] font-bold text-white">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className={styles.learningCards}>
              <section>
                <h3>What to expect</h3>
                <ul>
                  <li>
                    <IconCheck size={15} /> Engaging sessions from an expert host
                  </li>
                  <li>
                    <IconCheck size={15} /> Connect with like-minded attendees
                  </li>
                  <li>
                    <IconCheck size={15} /> Practical insights you can apply immediately
                  </li>
                </ul>
              </section>
            </div>
          </section>
        )}

        {/* ── Schedule ── */}
        <section id="schedule" className={styles.overviewSection}>
          <span className={styles.sectionLabel}>Schedule</span>
          <h2>Choose a session that works for you.</h2>
          <div>
            <p>
              Multiple sessions are available. Select a date and time from the
              registration panel above to reserve your spot.
            </p>
          </div>
        </section>

        {/* ── Host ── */}
        <section id="host" className={styles.hostLocationGrid}>
          <HostSummaryCard
            name={data.hostName}
            profileUrl={data.hostId ? `/tutor/${encodeURIComponent(data.hostId)}` : undefined}
          />

          <div className={styles.locationCard}>
            <span className="block text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-[var(--quiet)]">
              Location
            </span>
            <h2 className="mt-5 text-[1.65rem] font-semibold tracking-tight text-white">
              Event location
            </h2>
            <p className="mt-1 text-[var(--muted)]">
              Exact entrance details are provided after registration.
            </p>
            <div className={styles.onlineVenue}>
              <IconWorld size={44} />
              <strong className="mt-2 text-white">Join from anywhere</strong>
            </div>
          </div>
        </section>

        {/* ── Good to know ── */}
        <section id="good-to-know" className={styles.goodToKnowSection}>
          <span className={styles.sectionLabel}>Good to know</span>
          <h2>Before you register.</h2>
          <ul className={styles.goodToKnowList}>
            {goodToKnow.map((item) => (
              <li key={item}>
                <IconInfoCircle size={18} />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </main>

      {/* ── Mobile bottom bar ── */}
      <MobileBookingBar
        onClick={handleBooking}
        loading={bookingLoading}
        disabled={ctaDisabled}
        priceLabel={priceLabel}
        sessionLabel={sessionLabel}
        label={isFree ? "Register" : "Book event"}
      />

      {/* ── Status toast ── */}
      <p className={styles.status} role="status" aria-live="polite">
        {toast}
      </p>
    </div>
  );
}
