"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconBookmark,
  IconCalendar,
  IconChevronDown,
  IconShare,
} from "@tabler/icons-react";
import { type BookableSession, type BookingRecord } from "@/lib/booking-api";
import { getWorkshopBySlug, type WorkshopOffering, type WorkshopSession } from "@/lib/workshop-booking-api";
import { useSession } from "@/lib/auth/session";
import { ParticipantQuantity } from "@/components/shared/participant-quantity";
import { PriceSummary } from "@/components/shared/price-summary";
import { BookingCTA, MobileBookingBar } from "@/components/shared/booking-cta";
import { WorkshopBookingSheet } from "./workshop-booking-sheet";
import styles from "./workshop-detail-page.module.css";

/* ── Types ── */

type PageState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "ready"; offering: WorkshopOffering; sessions: BookableSession[] };

/* ── Helpers ── */

function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)} \u0111`;
}

/* ── Session Selector (inline — uses pre-fetched sessions) ── */

function SessionSelector({
  sessions,
  selected,
  onSelect,
}: {
  sessions: BookableSession[];
  selected: BookableSession | null;
  onSelect: (s: BookableSession) => void;
}) {
  const [open, setOpen] = useState(false);

  const summaryText = !selected
    ? "Choose a date and time"
    : (() => {
        const d = new Date(selected.startsAt);
        const fmtTime = (dt: Date) =>
          dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
        return (
          d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }) +
          "  ·  " +
          fmtTime(new Date(selected.startsAt)) +
          "–" +
          fmtTime(new Date(selected.endsAt))
        );
      })();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 text-left transition-colors hover:border-[rgba(255,255,255,0.15)]"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgba(255,255,255,0.05)] text-[var(--muted,#a1a1aa)]">
            <IconCalendar size={17} />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.625rem] font-extrabold uppercase tracking-[0.14em] text-[var(--quiet,#71717a)]">
              Date and time
            </span>
            <span className="mt-0.5 block truncate text-[0.9rem] font-semibold text-white">
              {summaryText}
            </span>
          </span>
        </span>
        <IconChevronDown
          size={15}
          className={`shrink-0 text-[var(--muted,#a1a1aa)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-2 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[var(--panel-2,#1b1b1e)] p-3 shadow-2xl">
          {sessions.length === 0 ? (
            <p className="py-4 text-center text-[0.82rem] text-[var(--muted,#a1a1aa)]">
              No sessions available yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sessions.map((session) => {
                const isSelected = selected?.id === session.id;
                const isFull = session.spotsLeft !== null && session.spotsLeft <= 0;
                const d = new Date(session.startsAt);
                const timeLabel =
                  d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }) +
                  " · " +
                  new Date(session.startsAt).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  });
                return (
                  <button
                    key={session.id}
                    type="button"
                    disabled={isFull}
                    onClick={() => {
                      onSelect(session);
                      setOpen(false);
                    }}
                    className={`min-h-[34px] rounded-full border px-3 text-[0.75rem] font-semibold transition-colors ${
                      isSelected
                        ? "border-[rgba(255,255,255,0.28)] bg-white text-[#09090b]"
                        : isFull
                          ? "cursor-not-allowed border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] text-[var(--quiet,#71717a)] opacity-50 line-through"
                          : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] text-[var(--muted,#a1a1aa)] hover:border-[rgba(255,255,255,0.2)] hover:text-white"
                    }`}
                  >
                    {timeLabel}
                    {isFull ? " Full" : ""}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Component ── */

interface WorkshopDetailPageProps {
  slug: string;
}

export function WorkshopDetailPage({ slug }: WorkshopDetailPageProps) {
  const session = useSession();
  const [page, setPage] = useState<PageState>({ status: "loading" });
  const [selectedSession, setSelectedSession] = useState<BookableSession | null>(null);
  const [participants, setParticipants] = useState(1);
  const [saved, setSaved] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }, []);

  /* Fetch workshop offering + sessions */
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const cancelled = { current: false };
    queueMicrotask(() => setPage({ status: "loading" }));

    (async () => {
      try {
        const result = await getWorkshopBySlug(slug);
        if (cancelled.current || controller.signal.aborted) return;
        if (!result) {
          setPage({ status: "not-found" });
          return;
        }
        const { offering, sessions } = result;

        // Map WorkshopSession[] to BookableSession[] for the picker
        const bookableSessions: BookableSession[] = sessions.map((s: WorkshopSession) => ({
          id: s.id,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          status: s.status as BookableSession["status"],
          minParticipants: s.minParticipants,
          maxParticipants: s.maxParticipants,
          spotsLeft: s.spotsLeft,
          unitPriceVnd: offering.pricePerParticipantVnd ?? null,
          host: undefined,
          offering: {
            id: offering.id,
            title: offering.title,
            kind: offering.kind,
          },
          hardReservedCapacity: 0,
          version: 1,
        }));

        if (!cancelled.current) setPage({ status: "ready", offering, sessions: bookableSessions });
      } catch {
        if (!cancelled.current && !controller.signal.aborted) setPage({ status: "not-found" });
      }
    })();

    return () => {
      cancelled.current = true;
      controller.abort();
    };
  }, [slug]);

  /* Reset session selection when page changes */
  useEffect(() => {
    queueMicrotask(() => setSelectedSession(null));
  }, [page]);

  /* Derived data */
  const offering = page.status === "ready" ? page.offering : null;
  const unitPrice = offering?.pricePerParticipantVnd ?? null;
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
    const d = new Date(selectedSession.startsAt);
    return (
      d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }) +
      " · " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    );
  }, [selectedSession]);

  const ctaLabel = "Book this workshop";

  /* Auth gate */
  const isAuthenticated = session.status === "authenticated";
  const currentPath = typeof window !== "undefined" ? window.location.pathname : `/workshops/${slug}`;

  /* Booking flow */
  const openBookingFlow = useCallback(() => {
    if (!isAuthenticated) {
      window.location.assign(`/auth/sign-in?next=${encodeURIComponent(currentPath)}`);
      return;
    }
    if (session.status === "authenticated" && session.profileErrorCode === "EMAIL_NOT_CONFIRMED") {
      window.location.assign(`/auth/verify-email?next=${encodeURIComponent(currentPath)}`);
      return;
    }
    setBookingOpen(true);
  }, [isAuthenticated, session, currentPath]);

  const handleBooked = useCallback(
    (booking: BookingRecord) => {
      const serverTotal = booking.pricing?.amountVnd;
      showToast(
        serverTotal != null ? `Booking request sent \u00B7 ${formatVnd(serverTotal)}` : "Booking request sent",
      );
    },
    [showToast],
  );

  /* Share handler */
  const handleShare = async () => {
    const shareData = { title: offering?.title ?? "Workshop", url: window.location.href };
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

  /* ── Loading skeleton ── */
  if (page.status === "loading") {
    return (
      <div className={styles.page} aria-busy="true">
        <header className={styles.topBar}>
          <div className={styles.topBarInner}>
            <Link href="/workshops" className={styles.backLink}>
              <IconArrowLeft size={16} /> Explore
            </Link>
          </div>
        </header>
        <main className={styles.main}>
          <div className={styles.heroSection}>
            <div className={styles.heroGrid}>
              <div className={styles.heroContent}>
                <div className={`${styles.skeleton} h-12 w-3/4 mb-4`} />
                <div className={`${styles.skeleton} h-6 w-1/2 mb-6`} />
                <div className={`${styles.skeleton} h-[400px] w-full mt-8 rounded-[32px]`} />
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
  if (page.status === "not-found" || !offering) {
    return (
      <div className={`${styles.page} ${styles.notFound}`}>
        <div>
          <h1>Workshop not found</h1>
          <p>This workshop is unavailable or has not been published.</p>
          <Link href="/workshops">Back to workshops</Link>
        </div>
      </div>
    );
  }

  const sessions = page.sessions;

  return (
    <div className={styles.page}>
      {/* ── Top bar ── */}
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <Link href="/workshops" className={styles.backLink}>
            <IconArrowLeft size={16} /> Explore
          </Link>
          <div className={styles.topTitle}>
            <span>Tutoria</span>
            <strong>{offering.kind === "workshop" ? "Workshop" : offering.kind}</strong>
          </div>
          <div className={styles.topActions}>
            <button type="button" aria-label="Share workshop" onClick={handleShare}>
              <IconShare size={17} />
            </button>
            <button
              type="button"
              className={saved ? styles.savedAction : undefined}
              onClick={() => {
                setSaved((v) => !v);
                showToast(saved ? "Removed from saved workshops." : "Saved to your workshops.");
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
        <section className={styles.heroSection} aria-labelledby="workshop-title">
          <div className={styles.heroGrid}>
            <div className={styles.heroContent}>
              <span className={styles.categoryBadge}>
                {offering.kind === "workshop" ? "Workshop" : offering.kind}
              </span>
              <h1 id="workshop-title">{offering.title}</h1>

              {/* ── Booking panel (desktop sticky) ── */}
              <aside className={styles.bookingPanel} aria-label="Booking summary">
                <div className={styles.bookingHead}>
                  <div>
                    <strong>
                      {isFree ? "Free" : isUnknownPrice ? "\u2014" : formatVnd(unitPrice!)}
                    </strong>
                    {!isFree && !isUnknownPrice && <span>/ participant</span>}
                  </div>
                  {spotsLeft != null && <em>{spotsLeft} spots</em>}
                </div>

                <div className="space-y-0">
                  {/* Session selector */}
                  <div className="mx-4 mt-3">
                    <SessionSelector
                      sessions={sessions}
                      selected={selectedSession}
                      onSelect={setSelectedSession}
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
                      onClick={openBookingFlow}
                      loading={false}
                      error={null}
                      disabled={false}
                      label={ctaLabel}
                    />
                  </div>
                </div>
              </aside>

              {/* ── Description ── */}
              {offering.description && (
                <div className={styles.descriptionSection}>
                  <p>{offering.description}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ── Mobile bottom bar ── */}
      <MobileBookingBar
        onClick={openBookingFlow}
        loading={false}
        disabled={false}
        priceLabel={priceLabel}
        sessionLabel={sessionLabel}
        label="Book this workshop"
      />

      {/* ── Booking sheet ── */}
      {bookingOpen && (
        <WorkshopBookingSheet
          open
          onClose={() => setBookingOpen(false)}
          offeringId={offering.id}
          listingTitle={offering.title}
          selectedSession={selectedSession}
          onSelectSession={setSelectedSession}
          participants={participants}
          onParticipants={setParticipants}
          onBooked={handleBooked}
          sessions={sessions}
        />
      )}

      {/* ── Status toast ── */}
      <p className={styles.status} role="status" aria-live="polite">
        {toast}
      </p>
    </div>
  );
}
