"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconArrowLeft,
  IconBookmark,
  IconCheck,
  IconClock,
  IconMapPin,
  IconPlus,
  IconShare,
  IconStarFilled,
  IconWorld,
} from "@tabler/icons-react";
import { type BookableSession, type BookingRecord } from "@/lib/booking-api";
import { getMarketplaceListing, type MarketplaceListing } from "@/lib/marketplace-api";
import { useSession } from "@/lib/auth/session";
import { SessionDatePicker } from "@/components/shared/session-date-picker";
import { ParticipantQuantity } from "@/components/shared/participant-quantity";
import { PriceSummary } from "@/components/shared/price-summary";
import { BookingCTA, MobileBookingBar } from "@/components/shared/booking-cta";
import { HostSummaryCard } from "@/components/shared/host-summary-card";
import { WorkshopFactsCard } from "@/components/shared/workshop-facts-card";
import { WorkshopBookingSheet } from "./workshop-booking-sheet";
import styles from "./workshop-detail-page.module.css";

/* ── Types ── */

interface WorkshopPayload {
  subtitle?: string;
  description?: string;
  about?: string[];
  image?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  duration?: string;
  languages?: string[];
  level?: string;
  location?: string;
  format?: string;
  host?: {
    name?: string;
    avatarUrl?: string;
    role?: string;
    bio?: string;
    profileUrl?: string;
  };
  cancellation?: string[];
  whatYouWillLearn?: string[];
  whatIsIncluded?: string[];
  faqs?: Array<{ question: string; answer: string }>;
}

type PageState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "ready"; listing: MarketplaceListing; payload: WorkshopPayload };

/* ── Helpers ── */

function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)} \u0111`;
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
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }, []);

  /* Fetch marketplace listing */
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const cancelled = { current: false };
    queueMicrotask(() => setPage({ status: "loading" }));

    (async () => {
      try {
        const listing = await getMarketplaceListing("event", slug);
        if (cancelled.current || controller.signal.aborted) return;
        if (!listing) {
          setPage({ status: "not-found" });
          return;
        }
        const payload = (listing.payload ?? {}) as WorkshopPayload;
        if (!cancelled.current) setPage({ status: "ready", listing, payload });
        if (!cancelled.current && payload.faqs?.length) setOpenFaq(payload.faqs[0].question);
      } catch {
        if (!cancelled.current && !controller.signal.aborted) setPage({ status: "not-found" });
      }
    })();

    return () => {
      cancelled.current = true;
      controller.abort();
    };
  }, [slug]);

  /* Reset session selection when listing changes */
  useEffect(() => {
    queueMicrotask(() => {
      setSelectedSession(null);
      setParticipants(1);
    });
  }, [page]);

  /* Derived data */
  const payload = page.status === "ready" ? page.payload : null;
  const listing = page.status === "ready" ? page.listing : null;

  const unitPrice = selectedSession?.unitPriceVnd ?? null;
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

  const ctaLabel = "Book this workshop";

  const cancellationPolicy = payload?.cancellation?.[0] ?? null;

  /* Auth gate */
  const isAuthenticated = session.status === "authenticated";
  const currentPath = typeof window !== "undefined" ? window.location.pathname : `/workshops/${slug}`;

  /* Booking flow */
  const openBookingFlow = useCallback(() => {
    /* Auth gate: keep the existing sign-in / verify redirect behavior. */
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
      // The booking sheet renders the in-sheet receipt; we only toast here and do
      // not navigate away (there is no /bookings/[id] page to land on).
      showToast(
        serverTotal != null ? `Booking request sent \u00B7 ${formatVnd(serverTotal)}` : "Booking request sent",
      );
    },
    [showToast],
  );

  /* Share handler */
  const handleShare = async () => {
    const shareData = { title: listing?.title ?? "Workshop", url: window.location.href };
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
            <Link href="/events" className={styles.backLink}>
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
  if (page.status === "not-found" || !payload || !listing) {
    return (
      <div className={`${styles.page} ${styles.notFound}`}>
        <div>
          <h1>Workshop not found</h1>
          <p>This workshop is unavailable or has not been published.</p>
          <Link href="/events">Back to workshops</Link>
        </div>
      </div>
    );
  }

  /* ── Workshop facts ── */
  const facts = [
    payload.format && { label: "Format", value: payload.format },
    payload.duration && { label: "Duration", value: payload.duration },
    payload.level && { label: "Level", value: payload.level },
    payload.languages?.length && { label: "Languages", value: payload.languages.join(", ") },
    payload.location && { label: "Location", value: payload.location },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  /* ── FAQs ── */
  const faqs = payload.faqs ?? [];

  return (
    <div className={styles.page}>
      {/* ── Top bar ── */}
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <Link href="/events" className={styles.backLink}>
            <IconArrowLeft size={16} /> Explore
          </Link>
          <div className={styles.topTitle}>
            <span>Tutoria</span>
            <strong>{payload.category || "Workshop"}</strong>
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
              {payload.category && (
                <span className={styles.categoryBadge}>{payload.category}</span>
              )}
              <h1 id="workshop-title">{listing.title}</h1>
              {payload.subtitle && <p>{payload.subtitle}</p>}

              <div className={styles.heroMeta}>
                {payload.rating != null && (
                  <span>
                    <IconStarFilled size={16} /> <strong>{payload.rating}</strong>
                    {payload.reviewCount != null && ` (${payload.reviewCount} reviews)`}
                  </span>
                )}
                {payload.duration && (
                  <span>
                    <IconClock size={16} /> {payload.duration}
                  </span>
                )}
                {payload.location && (
                  <span>
                    <IconMapPin size={16} /> {payload.location}
                  </span>
                )}
              </div>

              {/* Cover image */}
              {payload.image && (
                <div className={styles.coverImage}>
                  <Image
                    src={payload.image}
                    alt={listing.title}
                    fill
                    priority
                    unoptimized={payload.image.startsWith("http")}
                    sizes="(max-width: 1100px) 100vw, 820px"
                  />
                </div>
              )}
            </div>

            {/* ── Booking panel (desktop sticky) ── */}
            <aside className={styles.bookingPanel} aria-label="Booking summary">
              <div className={styles.bookingHead}>
                <div>
                  <strong>
                    {isFree ? "Free" : isUnknownPrice ? "\u2014" : formatVnd(unitPrice!)}
                  </strong>
                  {!isFree && !isUnknownPrice && <span>/ participant</span>}
                </div>
                {spotsLeft != null && (
                  <em>{spotsLeft} spots</em>
                )}
              </div>

              <div className="space-y-0">
                {/* Session picker */}
                <div className="mx-4 mt-3">
                  <SessionDatePicker
                    offeringId={listing.id}
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
                    policy={cancellationPolicy ?? undefined}
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
          </div>
        </section>

        {/* ── Section nav ── */}
        <nav className={styles.sectionNav} aria-label="Workshop sections">
          <a href="#about">About</a>
          {facts.length > 0 && <a href="#details">Details</a>}
          {payload.whatYouWillLearn?.length || payload.whatIsIncluded?.length ? (
            <a href="#whats-included">What&apos;s included</a>
          ) : null}
          <a href="#host">Host</a>
          {faqs.length > 0 && <a href="#faq">FAQ</a>}
        </nav>

        {/* ── About ── */}
        <section id="about" className={styles.overviewSection}>
          <span className={styles.sectionLabel}>About this workshop</span>
          <h2>{payload.subtitle || listing.title}</h2>
          {(payload.about ?? [payload.description].filter(Boolean) as string[]).length > 0 && (
            <div>
              {(payload.about ?? [payload.description].filter(Boolean) as string[]).map(
                (paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ),
              )}
            </div>
          )}
        </section>

        {/* ── Details: facts + learning cards ── */}
        {(facts.length > 0 || payload.whatYouWillLearn?.length || payload.whatIsIncluded?.length) && (
          <section id="details" className={styles.detailsSection}>
            {facts.length > 0 && <WorkshopFactsCard facts={facts} />}

            {(payload.whatYouWillLearn?.length || payload.whatIsIncluded?.length) && (
              <div id="whats-included" className={styles.learningCards}>
                {payload.whatYouWillLearn?.length && payload.whatYouWillLearn.length > 0 && (
                  <section>
                    <h3>What you will learn</h3>
                    <ul>
                      {payload.whatYouWillLearn.map((item) => (
                        <li key={item}>
                          <IconCheck size={15} /> {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {payload.whatIsIncluded?.length && payload.whatIsIncluded.length > 0 && (
                  <section>
                    <h3>What is included</h3>
                    <ul>
                      {payload.whatIsIncluded.map((item) => (
                        <li key={item}>
                          <IconCheck size={15} /> {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Host & location ── */}
        <section id="host" className={styles.hostLocationGrid}>
          {payload.host && (
            <HostSummaryCard
              name={payload.host.name ?? "Host"}
              avatarUrl={payload.host.avatarUrl}
              role={payload.host.role}
              bio={payload.host.bio}
              profileUrl={payload.host.profileUrl}
            />
          )}

          <div className={styles.locationCard}>
            <span className="block text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-[var(--quiet)]">
              Location
            </span>
            <h2 className="mt-5 text-[1.65rem] font-semibold tracking-tight text-white">
              {payload.location || "Online"}
            </h2>
            {payload.format?.toLowerCase().includes("online") ? (
              <>
                <p className="mt-1 text-[var(--muted)]">Join from anywhere</p>
                <div className={styles.onlineVenue}>
                  <IconWorld size={44} />
                  <strong className="mt-2 text-white">Join from anywhere</strong>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-[var(--muted)]">
                  Exact entrance details are provided after booking.
                </p>
              </>
            )}
          </div>
        </section>

        {/* ── FAQ ── */}
        {faqs.length > 0 && (
          <section id="faq" className={styles.faqSection}>
            <span className={styles.sectionLabel}>FAQ</span>
            <h2>Practical details before you book.</h2>
            <div className={styles.faqList}>
              {faqs.map((faq, index) => {
                const isOpen = openFaq === faq.question;
                const answerId = `workshop-faq-${index}`;
                return (
                  <article className={isOpen ? styles.faqOpen : undefined} key={faq.question}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={answerId}
                      onClick={() => setOpenFaq(isOpen ? null : faq.question)}
                    >
                      <span>{faq.question}</span>
                      <IconPlus size={19} />
                    </button>
                    {isOpen && (
                      <div id={answerId} role="region" aria-label={faq.question}>
                        <p>{faq.answer}</p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}
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

      {/* ── Stepped booking sheet (mounted per open so state resets) ── */}
      {bookingOpen && (
        <WorkshopBookingSheet
          open
          onClose={() => setBookingOpen(false)}
          offeringId={listing.id}
          kind="event"
          listingTitle={listing.title}
          selectedSession={selectedSession}
          onSelectSession={setSelectedSession}
          participants={participants}
          onParticipants={setParticipants}
          onBooked={handleBooked}
        />
      )}

      {/* ── Status toast ── */}
      <p className={styles.status} role="status" aria-live="polite">
        {toast}
      </p>
    </div>
  );
}
