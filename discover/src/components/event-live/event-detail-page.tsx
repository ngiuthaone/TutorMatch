"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconBookmark,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconMapPin,
  IconShare,
  IconShieldCheck,
  IconUsers,
  IconWorld,
} from "@tabler/icons-react";
import type { EventOffering, EventSession } from "@/lib/event-booking-api";
import {
  isFreeEvent,
  formatEventPriceVnd,
  formatDuration,
  formatDateShort,
  formatTimeShort,
} from "@/lib/event-booking-api";
import styles from "./event-detail-page.module.css";

interface EventDetailPageProps {
  offering: EventOffering;
  sessions: EventSession[];
  hostDisplayName: string;
}

export function EventDetailPage({ offering, sessions, hostDisplayName }: EventDetailPageProps) {
  const free = isFreeEvent(offering);
  const priceLabel = formatEventPriceVnd(offering);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(sessions[0]?.id ?? null);
  const [participants, setParticipants] = useState(1);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [sessions],
  );

  const selectedSession = useMemo(
    () => sortedSessions.find((s) => s.id === selectedSessionId) ?? sortedSessions[0] ?? null,
    [sortedSessions, selectedSessionId],
  );

  const totalSpotsLeft = useMemo(
    () => sortedSessions.reduce((sum, s) => sum + s.spotsLeft, 0),
    [sortedSessions],
  );

  const handleShare = async () => {
    const shareData = { title: offering.title, text: offering.description || offering.title, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setStatus("Share options opened.");
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setStatus("Event link copied.");
      }
    } catch {
      setStatus("The event link is ready in your address bar.");
    }
  };

  const handleBooking = useCallback(async () => {
    if (!selectedSession) {
      setStatus("Choose a session to continue.");
      return;
    }
    setBookingLoading(true);
    setStatus("");
    try {
      const { createEventBooking } = await import("@/lib/event-booking-api");
      const result = await createEventBooking(selectedSession.id, participants);

      if (free || !result.paymentRequired) {
        setStatus("You're registered! Check your email for confirmation.");
      } else {
        setStatus("Booking confirmed. Proceeding to payment...");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Booking failed";
      setStatus(message);
    } finally {
      setBookingLoading(false);
    }
  }, [selectedSession, participants, free]);

  const ctaLabel = free ? "Register" : "Book event";

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <Link href="/events-live" className={styles.backLink}><IconArrowLeft size={16} /> Events</Link>
          <div className={styles.topTitle}><span>Tutoria Events</span><strong>{offering.title}</strong></div>
          <div className={styles.topActions}>
            <button type="button" aria-label="Share event" onClick={handleShare}><IconShare size={17} /></button>
            <button type="button" className={saved ? styles.savedAction : undefined} onClick={() => { setSaved((c) => !c); setStatus(saved ? "Removed from saved events." : "Saved to your events."); }}><IconBookmark size={17} fill={saved ? "currentColor" : "none"} /><span>Save</span></button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.heroSection} aria-labelledby="event-title">
          <div className={styles.heroGrid}>
            <div className={styles.heroContent}>
              <div className={styles.badges}>
                <span className={styles.formatBadge}>{offering.bookingMode === "instant" ? "Open registration" : "Host approval"}</span>
                {free && <span className={styles.freeBadge}>Free event</span>}
              </div>
              <h1 id="event-title">{offering.title}</h1>
              {offering.description && <p className={styles.subtitle}>{offering.description}</p>}
              <div className={styles.heroMeta}>
                <span><IconUsers size={16} /> {totalSpotsLeft} spots left</span>
                {selectedSession && (
                  <>
                    <span><IconClock size={16} /> {formatDuration(selectedSession.startsAt, selectedSession.endsAt)}</span>
                  </>
                )}
                <span><IconWorld size={16} /> Online</span>
              </div>
            </div>

            <aside className={styles.bookingPanel} aria-label="Booking summary">
              <div className={styles.bookingHead}>
                <div>
                  <strong className={free ? styles.freePrice : undefined}>{priceLabel}</strong>
                  {!free && <span>/ participant</span>}
                </div>
                <em>{totalSpotsLeft} spots left</em>
              </div>

              {selectedSession && (
                <div className={styles.sessionSummary}>
                  <span><IconClock size={17} /></span>
                  <div>
                    <small>Date and time</small>
                    <strong>{formatDateShort(selectedSession.startsAt)}</strong>
                    <p>{formatTimeShort(selectedSession.startsAt)} – {formatTimeShort(selectedSession.endsAt)}</p>
                  </div>
                </div>
              )}

              <details className={styles.sessionPicker}>
                <summary>Change session <IconChevronDown size={15} /></summary>
                <div>
                  {sortedSessions.filter((s) => s.status === "scheduled").map((session) => (
                    <button
                      type="button"
                      className={selectedSessionId === session.id ? styles.selectedSession : undefined}
                      key={session.id}
                      onClick={() => setSelectedSessionId(session.id)}
                    >
                      <span>{formatDateShort(session.startsAt)}</span>
                      <span>{formatTimeShort(session.startsAt)} – {formatTimeShort(session.endsAt)}</span>
                      <span>{session.spotsLeft} spots</span>
                    </button>
                  ))}
                </div>
              </details>

              <div className={styles.participantsRow}>
                <span><IconUsers size={17} /></span>
                <div><small>Participants</small><strong>{participants} guest{participants === 1 ? "" : "s"}</strong></div>
                <div className={styles.stepper}>
                  <button type="button" aria-label="Remove participant" onClick={() => setParticipants((v) => Math.max(1, v - 1))} disabled={participants === 1}>-</button>
                  <output aria-live="polite">{participants}</output>
                  <button type="button" aria-label="Add participant" onClick={() => setParticipants((v) => Math.min(selectedSession?.spotsLeft ?? 1, v + 1))} disabled={participants >= (selectedSession?.spotsLeft ?? 1)}>+</button>
                </div>
              </div>

              {!free && (
                <div className={styles.totalBox}>
                  <span>Total for {participants} guest{participants === 1 ? "" : "s"}</span>
                  <strong>{priceLabel === "Free" ? "Free" : `${new Intl.NumberFormat("vi-VN").format((offering.pricePerParticipantVnd ?? 0) * participants)} đ`}</strong>
                </div>
              )}

              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleBooking}
                disabled={bookingLoading || !selectedSession}
              >
                {bookingLoading ? "Processing..." : ctaLabel}
              </button>

              {free ? (
                <p className={styles.noCharge}>No payment required</p>
              ) : (
                <p className={styles.noCharge}>You won&apos;t be charged yet</p>
              )}

              <p className={styles.protection}><IconShieldCheck size={16} /> {free ? "Free cancellation at any time." : "Free cancellation up to 24 hours before the start."}</p>
            </aside>
          </div>
        </section>

        <nav className={styles.sectionNav} aria-label="Event sections">
          <a href="#overview">Overview</a>
          <a href="#details">Details</a>
          <a href="#schedule">Schedule</a>
          <a href="#host">Host</a>
          <a href="#reviews">Reviews</a>
        </nav>

        <section id="overview" className={styles.overviewSection}>
          <span>About this event</span>
          <h2>{offering.description || offering.title}</h2>
          <div>
            <p>Join {hostDisplayName} for this live event. Whether you&apos;re looking to learn, connect, or experience something new, this session is designed to be engaging and practical.</p>
            <p>Registration is {free ? "free" : `priced at ${priceLabel} per participant`}. Spaces are limited — reserve your spot today.</p>
          </div>
        </section>

        <section id="details" className={styles.detailsSection}>
          <div className={styles.factCard}>
            <span>Event facts</span>
            <dl>
              <div><dt>Format</dt><dd>Online</dd><small>Join from any device</small></div>
              <div><dt>Duration</dt><dd>{selectedSession ? formatDuration(selectedSession.startsAt, selectedSession.endsAt) : "TBD"}</dd></div>
              <div><dt>Price</dt><dd>{priceLabel}</dd>{!free && <small>Per participant</small>}</div>
              <div><dt>Registration</dt><dd>{offering.bookingMode === "instant" ? "Instant confirmation" : "Host approval required"}</dd></div>
            </dl>
          </div>

          <div className={styles.learningCards}>
            <section>
              <h3>What you will experience</h3>
              <ul>
                <li><IconCheck size={15} /> Live interactive session with the host</li>
                <li><IconCheck size={15} /> Practical insights and hands-on activities</li>
                <li><IconCheck size={15} /> Q&A and networking opportunities</li>
                <li><IconCheck size={15} /> Community connection with fellow attendees</li>
              </ul>
            </section>
            <section>
              <h3>Good to know</h3>
              <ul>
                <li><IconCheck size={15} /> Join from any device with internet</li>
                <li><IconCheck size={15} /> {free ? "No payment required" : "Secure payment processing"}</li>
                <li><IconCheck size={15} /> Booking confirmation sent by email</li>
                <li><IconCheck size={15} /> {free ? "Cancel anytime" : "Free cancellation up to 24h before"}</li>
              </ul>
            </section>
          </div>
        </section>

        <section id="schedule" className={styles.scheduleSection}>
          <div className={styles.planCard}>
            <header>
              <div>
                <span>Schedule</span>
                <h2>Upcoming sessions</h2>
                <p>Choose the session that works best for you.</p>
              </div>
            </header>
            <div className={styles.sessionList}>
              {sortedSessions.filter((s) => s.status === "scheduled").map((session) => (
                <button
                  type="button"
                  className={`${styles.sessionCard} ${selectedSessionId === session.id ? styles.sessionCardActive : ""}`}
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                >
                  <div className={styles.sessionCardDate}>
                    <strong>{formatDateShort(session.startsAt)}</strong>
                    <span>{formatTimeShort(session.startsAt)} – {formatTimeShort(session.endsAt)}</span>
                  </div>
                  <div className={styles.sessionCardMeta}>
                    <span>{session.spotsLeft} spots left</span>
                    {session.spotsLeft <= 5 && <span className={styles.lowSpots}>Almost full</span>}
                  </div>
                </button>
              ))}
              {sortedSessions.filter((s) => s.status === "scheduled").length === 0 && (
                <p className={styles.noSessions}>No upcoming sessions. Check back soon.</p>
              )}
            </div>
          </div>
        </section>

        <section id="host" className={styles.hostSection}>
          <div className={styles.hostCard}>
            <span>Host</span>
            <div className={styles.hostHeader}>
              <div className={styles.hostAvatar}><IconUsers size={24} /></div>
              <div>
                <h2>{hostDisplayName}</h2>
                <p>Event host</p>
              </div>
            </div>
            <p>This event is hosted by {hostDisplayName}. Registered attendees will receive all joining details after {free ? "registration" : "booking"}.</p>
          </div>

          <div className={styles.locationCard}>
            <span>Location</span>
            <h2>Online event</h2>
            <p>Join from anywhere with an internet connection.</p>
            <small>Joining details are sent after {free ? "registration" : "booking"}.</small>
            <div className={styles.onlineVenue}><IconWorld size={44} /><strong>Join from anywhere</strong></div>
          </div>
        </section>

        <section id="reviews" className={styles.reviewsSection}>
          <div className={styles.sectionHeading}>
            <span>Reviews</span>
            <h2>Attendee feedback</h2>
          </div>
          <div className={styles.reviewPlaceholder}>
            <p>Reviews will appear here after attendees complete this event.</p>
          </div>
        </section>

        <section className={styles.goodToKnow}>
          <span>Good to know</span>
          <h2>Before you register</h2>
          <div className={styles.goodToKnowGrid}>
            <div>
              <h3>Registration</h3>
              <ul>
                <li><IconCheck size={14} /> {free ? "Free — no payment required" : "Secure payment at checkout"}</li>
                <li><IconCheck size={14} /> {offering.bookingMode === "instant" ? "Instant confirmation" : "Host reviews your request"}</li>
                <li><IconCheck size={14} /> Confirmation sent by email</li>
              </ul>
            </div>
            <div>
              <h3>Cancellation</h3>
              <ul>
                <li><IconCheck size={14} /> {free ? "Cancel anytime" : "Free cancellation up to 24 hours before"}</li>
                <li><IconCheck size={14} /> {free ? "No questions asked" : "Full refund if cancelled in time"}</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <div className={styles.mobileBookingBar}>
        <div>
          <strong className={free ? styles.freePrice : undefined}>{priceLabel}</strong>
          <span>{selectedSession ? formatDateShort(selectedSession.startsAt) : "Choose a session"}</span>
        </div>
        <button type="button" onClick={handleBooking} disabled={bookingLoading || !selectedSession}>
          {bookingLoading ? "Processing..." : ctaLabel}
        </button>
      </div>

      <p className={styles.status} role="status" aria-live="polite">{status}</p>
    </div>
  );
}
