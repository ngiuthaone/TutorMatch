"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconBookmark,
  IconCalendar,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconMapPin,
  IconMessageCircle,
  IconShare,
  IconSparkles,
  IconUsers,
} from "@tabler/icons-react";
import { type BookableSession, type BookingRecord } from "@/lib/booking-api";
import {
  getWorkshopBySlug,
  type WorkshopOffering,
  type WorkshopSession,
} from "@/lib/workshop-booking-api";
import { useSession } from "@/lib/auth/session";
import { ParticipantQuantity } from "@/components/shared/participant-quantity";
import { PriceSummary } from "@/components/shared/price-summary";
import { BookingCTA, MobileBookingBar } from "@/components/shared/booking-cta";
import { WorkshopBookingSheet } from "./workshop-booking-sheet";
import styles from "./workshop-detail-template-page.module.css";

type PageState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "ready"; offering: WorkshopOffering; sessions: BookableSession[] };

interface WorkshopDetailTemplatePageProps {
  slug: string;
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

function formatSession(session: BookableSession) {
  const start = new Date(session.startsAt);
  const end = new Date(session.endsAt);
  const date = start.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time =
    start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) +
    "–" +
    end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return { date, time, full: date + " · " + time };
}

function SessionPicker({
  sessions,
  selected,
  onSelect,
}: {
  sessions: BookableSession[];
  selected: BookableSession | null;
  onSelect: (session: BookableSession) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.picker}>
      <button
        type="button"
        className={styles.pickerButton}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className={styles.pickerIcon}>
          <IconCalendar size={16} />
        </span>
        <span className={styles.pickerCopy}>
          <span>Date and time</span>
          <strong>{selected ? formatSession(selected).full : "Choose a session"}</strong>
        </span>
        <IconChevronDown className={open ? styles.rotated : ""} size={16} />
      </button>

      {open ? (
        <div className={styles.pickerMenu}>
          {sessions.length === 0 ? (
            <p className={styles.emptyText}>No published sessions are available yet.</p>
          ) : (
            sessions.map((item) => {
              const full = item.spotsLeft <= 0;
              const active = selected?.id === item.id;
              const info = formatSession(item);

              return (
                <button
                  type="button"
                  key={item.id}
                  disabled={full}
                  className={styles.sessionOption + (active ? " " + styles.sessionOptionActive : "")}
                  onClick={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <span>
                    <strong>{info.date}</strong>
                    <small>{info.time}</small>
                  </span>
                  <span className={full ? styles.full : styles.availability}>
                    {full ? "Full" : item.spotsLeft + " left"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className={styles.sectionHeader}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

function MediaGallery({ title }: { title: string }) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={styles.gallery}>
        <button
          type="button"
          className={styles.galleryTile + " " + styles.galleryPrimary}
          onClick={() => setOpen(true)}
          aria-label={"Open gallery for " + title}
        >
          <span>{title}</span>
          <small>Workshop media</small>
        </button>

        {[1, 2, 3, 4].map((index) => (
          <button
            type="button"
            key={index}
            className={styles.galleryTile}
            onClick={() => {
              setActive(index);
              setOpen(true);
            }}
            aria-label={"Open workshop image " + (index + 1)}
          >
            <span>{index + 1}</span>
          </button>
        ))}
      </div>

      {open ? (
        <div className={styles.galleryModal} role="dialog" aria-modal="true" aria-label="Workshop gallery">
          <button
            type="button"
            className={styles.galleryBackdrop}
            onClick={() => setOpen(false)}
            aria-label="Close gallery"
          />
          <div className={styles.galleryPanel}>
            <div className={styles.galleryPanelHead}>
              <div>
                <p className={styles.eyebrow}>Gallery</p>
                <strong>{title}</strong>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setOpen(false)}>
                ×
              </button>
            </div>

            <div className={styles.galleryFocus}>
              <span>{active + 1}</span>
            </div>

            <div className={styles.galleryThumbs}>
              {[0, 1, 2, 3, 4].map((index) => (
                <button
                  type="button"
                  key={index}
                  className={styles.galleryThumb + (active === index ? " " + styles.galleryThumbActive : "")}
                  onClick={() => setActive(index)}
                  aria-label={"View image " + (index + 1)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FaqItems({
  items,
}: {
  items: Array<{ question: string; answer: string }>;
}) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className={styles.faqList}>
      {items.map((item, index) => {
        const active = open === index;
        return (
          <div className={styles.faqItem} key={item.question}>
            <button
              type="button"
              onClick={() => setOpen(active ? null : index)}
              aria-expanded={active}
            >
              <span>{item.question}</span>
              <span className={active ? styles.faqMinus : styles.faqPlus}>
                {active ? "−" : "+"}
              </span>
            </button>
            {active ? <p>{item.answer}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

export function WorkshopDetailTemplatePage({ slug }: WorkshopDetailTemplatePageProps) {
  const session = useSession();
  const [page, setPage] = useState<PageState>({ status: "loading" });
  const [selectedSession, setSelectedSession] = useState<BookableSession | null>(null);
  const [participants, setParticipants] = useState(1);
  const [saved, setSaved] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 3600);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const result = await getWorkshopBySlug(slug);
        if (cancelled || controller.signal.aborted) return;

        if (!result) {
          setPage({ status: "not-found" });
          return;
        }

        const { offering, sessions } = result;
        const bookableSessions: BookableSession[] = sessions.map((item: WorkshopSession) => ({
          id: item.id,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          status: item.status as BookableSession["status"],
          minParticipants: item.minParticipants,
          maxParticipants: item.maxParticipants,
          spotsLeft: item.spotsLeft,
          unitPriceVnd: offering.pricePerParticipantVnd ?? null,
          host: undefined,
          offering: {
            id: offering.id,
            title: offering.title,
            kind: offering.kind,
          },
          hardReservedCapacity: 0,
          version: offering.version,
        }));

        setPage({ status: "ready", offering, sessions: bookableSessions });
      } catch {
        if (!cancelled && !controller.signal.aborted) setPage({ status: "not-found" });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [slug]);

  useEffect(() => {
    setSelectedSession(null);
    setParticipants(1);
  }, [page]);

  const offering = page.status === "ready" ? page.offering : null;
  const sessions = page.status === "ready" ? page.sessions : [];
  const unitPrice = offering?.pricePerParticipantVnd ?? null;
  const selectedSpots = selectedSession?.spotsLeft ?? null;
  const maxParticipants =
    selectedSpots == null ? 1 : Math.max(1, Math.min(selectedSpots, 50));
  const isFree = unitPrice === 0;
  const isUnknownPrice = unitPrice == null;

  const priceLabel = useMemo(() => {
    if (isFree) return "Free";
    if (isUnknownPrice) return "Price on request";
    return formatVnd(unitPrice * participants);
  }, [isFree, isUnknownPrice, participants, unitPrice]);

  const sessionLabel = selectedSession
    ? formatSession(selectedSession).full
    : "Choose a session";

  const isAuthenticated = session.status === "authenticated";
  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "/workshops/" + slug;

  const openBookingFlow = useCallback(() => {
    if (!isAuthenticated) {
      window.location.assign(
        "/auth/sign-in?next=" + encodeURIComponent(currentPath),
      );
      return;
    }

    if (
      session.status === "authenticated" &&
      session.profileErrorCode === "EMAIL_NOT_CONFIRMED"
    ) {
      window.location.assign(
        "/auth/verify-email?next=" + encodeURIComponent(currentPath),
      );
      return;
    }

    setBookingOpen(true);
  }, [currentPath, isAuthenticated, session]);

  const handleBooked = useCallback(
    (booking: BookingRecord) => {
      const total = booking.pricing?.amountVnd;
      showToast(
        total != null
          ? "Booking request sent · " + formatVnd(total)
          : "Booking request sent",
      );
    },
    [showToast],
  );

  const handleShare = async () => {
    const shareData = {
      title: offering?.title ?? "Workshop",
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast("Link copied.");
      }
    } catch {
      // Native share sheet was dismissed.
    }
  };

  if (page.status === "loading") {
    return (
      <div className={styles.page} aria-busy="true">
        <div className={styles.skeletonBar} />
        <main className={styles.loadingMain}>
          <div className={styles.skeletonHero} />
          <div className={styles.skeletonContent}>
            <div />
            <div />
            <div />
          </div>
        </main>
      </div>
    );
  }

  if (page.status === "not-found" || !offering) {
    return (
      <div className={styles.page + " " + styles.notFound}>
        <div>
          <p className={styles.eyebrow}>Workshop</p>
          <h1>Workshop not found</h1>
          <p>This workshop is unavailable or has not been published.</p>
          <Link href="/workshops" className={styles.primaryLink}>
            <IconArrowLeft size={16} />
            Back to workshops
          </Link>
        </div>
      </div>
    );
  }

  const descriptionParagraphs = offering.description
    ? offering.description
        .split(/\n{2,}/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  const visibleSessions = sessions.slice(0, 4);
  const bookingModeLabel =
    offering.bookingMode === "instant" ? "Instant booking" : "Host approval";
  const pricingLabel = isFree
    ? "Free"
    : isUnknownPrice
      ? "Price on request"
      : formatVnd(unitPrice) + " / participant";

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <Link href="/workshops" className={styles.backLink}>
            <IconArrowLeft size={16} />
            Explore workshops
          </Link>

          <div className={styles.topTitle}>
            <span>Tutoria</span>
            <strong>Workshop</strong>
          </div>

          <div className={styles.topActions}>
            <button type="button" onClick={handleShare} aria-label="Share workshop">
              <IconShare size={17} />
            </button>
            <button
              type="button"
              onClick={() => {
                setSaved((value) => !value);
                showToast(
                  !saved
                    ? "Saved to your workshops."
                    : "Removed from saved workshops.",
                );
              }}
              className={saved ? styles.savedAction : undefined}
            >
              <IconBookmark size={17} fill={saved ? "currentColor" : "none"} />
              <span>Save</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.heroSection}>
          <div className={styles.heroInner}>
            <div className={styles.breadcrumbs}>
              <span>Discover</span>
              <IconChevronRight size={13} />
              <span>Workshops</span>
              <IconChevronRight size={13} />
              <strong>{offering.title}</strong>
            </div>

            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <div className={styles.badgeRow}>
                  <span className={styles.badge}>Workshop</span>
                  <span className={styles.softBadge}>{bookingModeLabel}</span>
                </div>

                <h1>{offering.title}</h1>

                <p className={styles.heroDescription}>
                  {offering.description ||
                    "A host-led learning experience on Tutoria."}
                </p>

                <div className={styles.heroMeta}>
                  <span>
                    <IconClock size={14} />
                    {visibleSessions.length
                      ? "Scheduled sessions"
                      : "Flexible schedule"}
                  </span>
                  <span>
                    <IconUsers size={14} />
                    Participant booking
                  </span>
                  <span>
                    <IconSparkles size={14} />
                    Hosted on Tutoria
                  </span>
                </div>

                <MediaGallery title={offering.title} />
              </div>

              <aside className={styles.bookingCard} aria-label="Book workshop">
                <div className={styles.bookingCardTop}>
                  <div>
                    <span className={styles.cardLabel}>From</span>
                    <strong>{pricingLabel}</strong>
                  </div>
                  {selectedSession?.spotsLeft != null ? (
                    <span className={styles.spotsPill}>
                      {selectedSession.spotsLeft} left
                    </span>
                  ) : null}
                </div>

                <div className={styles.bookingCardBody}>
                  <SessionPicker
                    sessions={sessions}
                    selected={selectedSession}
                    onSelect={setSelectedSession}
                  />

                  {selectedSession ? (
                    <>
                      {selectedSession.spotsLeft <= 3 ? (
                        <p className={styles.urgency}>
                          {selectedSession.spotsLeft === 0
                            ? "This session is full."
                            : selectedSession.spotsLeft +
                              " spot" +
                              (selectedSession.spotsLeft === 1 ? "" : "s") +
                              " remaining"}
                        </p>
                      ) : null}

                      <ParticipantQuantity
                        max={maxParticipants}
                        value={participants}
                        onChange={setParticipants}
                      />

                      <div className={styles.priceDivider}>
                        <PriceSummary
                          unitPrice={unitPrice}
                          quantity={participants}
                          serverTotal={null}
                        />
                      </div>
                    </>
                  ) : (
                    <p className={styles.selectionHint}>
                      Choose a date and time to see the booking total.
                    </p>
                  )}
                </div>

                <div className={styles.bookingCardFooter}>
                  <BookingCTA
                    onClick={openBookingFlow}
                    loading={false}
                    error={null}
                    disabled={!selectedSession}
                    label="Book this workshop"
                  />
                  <small>
                    Booking is completed securely through Tutoria.
                  </small>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <nav className={styles.sectionNav} aria-label="Workshop sections">
          {[
            ["overview", "Overview"],
            ["details", "Details"],
            ["schedule", "Schedule"],
            ["host", "Host & location"],
            ["faq", "FAQ"],
            ["reviews", "Reviews"],
            ["recommendations", "You may also like"],
          ].map(([id, label]) => (
            <a href={"#" + id} key={id}>
              {label}
            </a>
          ))}
        </nav>

        <section id="overview" className={styles.contentSection}>
          <SectionHeader
            eyebrow="Overview"
            title={offering.title}
            description={
              descriptionParagraphs.length
                ? undefined
                : "About this workshop"
            }
          />

          <div className={styles.overviewGrid}>
            <article className={styles.proseCard}>
              {descriptionParagraphs.length ? (
                descriptionParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))
              ) : (
                <p>
                  The host has not added a longer workshop description yet.
                </p>
              )}
            </article>

            <aside className={styles.infoCard}>
              <div>
                <span>Booking mode</span>
                <strong>{bookingModeLabel}</strong>
              </div>
              <div>
                <span>Pricing</span>
                <strong>{pricingLabel}</strong>
              </div>
              <div>
                <span>Participants</span>
                <strong>Per participant</strong>
              </div>
            </aside>
          </div>
        </section>

        <section id="details" className={styles.contentSection}>
          <SectionHeader
            eyebrow="Details"
            title="What you should know"
            description="The core workshop information is kept here so the booking card stays focused."
          />

          <div className={styles.detailGrid}>
            {[
              {
                Icon: IconCalendar,
                title: "Schedule",
                copy: sessions.length
                  ? sessions.length +
                    " published session" +
                    (sessions.length === 1 ? "" : "s")
                  : "Sessions will appear here once published.",
              },
              {
                Icon: IconUsers,
                title: "Capacity",
                copy:
                  sessions[0]?.maxParticipants != null
                    ? "Up to " +
                      sessions[0].maxParticipants +
                      " participants per session."
                    : "Capacity is set by the host per session.",
              },
              {
                Icon: IconMessageCircle,
                title: "Booking",
                copy:
                  offering.bookingMode === "instant"
                    ? "Your booking can be confirmed immediately."
                    : "Your request is sent to the host for approval.",
              },
            ].map((item) => (
              <article className={styles.detailCard} key={item.title}>
                <item.Icon size={19} />
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="schedule" className={styles.contentSection}>
          <SectionHeader
            eyebrow="Schedule"
            title="Find a session that fits your week."
            description="Published sessions are connected directly to the real Tutoria booking engine."
          />

          <div className={styles.scheduleCard}>
            {sessions.length === 0 ? (
              <div className={styles.emptyPanel}>
                <IconCalendar size={22} />
                <strong>No sessions published yet</strong>
                <p>
                  The host can add available dates and times from the creator.
                </p>
              </div>
            ) : (
              <div className={styles.sessionList}>
                {sessions.map((item) => {
                  const sessionInfo = formatSession(item);
                  const full = item.spotsLeft <= 0;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={
                        styles.sessionRow +
                        (selectedSession?.id === item.id
                          ? " " + styles.sessionRowActive
                          : "")
                      }
                      disabled={full}
                      onClick={() => {
                        setSelectedSession(item);
                        document
                          .getElementById("overview")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      <span className={styles.sessionDate}>
                        <strong>{sessionInfo.date}</strong>
                        <small>{sessionInfo.time}</small>
                      </span>
                      <span className={styles.sessionCapacity}>
                        {full ? "Full" : item.spotsLeft + " spots left"}
                      </span>
                      <IconChevronRight size={16} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section id="host" className={styles.contentSection}>
          <SectionHeader
            eyebrow="Host & location"
            title="Meet your workshop host."
            description="Host and venue content can be expanded here as the published offering schema gains those fields."
          />

          <div className={styles.hostLocationGrid}>
            <article className={styles.hostCard}>
              <div className={styles.avatar}>T</div>
              <div>
                <span className={styles.cardLabel}>Workshop host</span>
                <h3>Tutoria host</h3>
                <p>
                  The published workshop is managed through Tutoria's creator
                  tools.
                </p>
              </div>
            </article>

            <article className={styles.locationCard}>
              <div className={styles.locationIcon}>
                <IconMapPin size={18} />
              </div>
              <div>
                <span className={styles.cardLabel}>Location</span>
                <h3>Shared after booking</h3>
                <p>
                  The current workshop API does not expose a venue address, so
                  the page does not invent one.
                </p>
              </div>
            </article>
          </div>
        </section>

        <section id="faq" className={styles.contentSection}>
          <SectionHeader
            eyebrow="FAQ"
            title="Practical details to help you prepare."
          />
          <FaqItems
            items={[
              {
                question: "How do I choose a session?",
                answer:
                  "Select a published date and time in the booking card or Schedule section.",
              },
              {
                question: "How does booking work?",
                answer:
                  offering.bookingMode === "instant"
                    ? "Your selected session can be booked immediately once you complete the booking flow."
                    : "Tutoria sends the booking request to the host, who then approves or rejects it.",
              },
              {
                question: "How is the price calculated?",
                answer:
                  unitPrice == null
                    ? "The workshop has not published a participant price yet."
                    : "The current participant price is " +
                      formatVnd(unitPrice) +
                      " per participant, with the final total based on your selected quantity.",
              },
            ]}
          />
        </section>

        <section id="reviews" className={styles.contentSection}>
          <SectionHeader
            eyebrow="Reviews"
            title="What participants say."
            description="Reviews will populate here from the workshop review data once they are available to this native route."
          />

          <div className={styles.reviewEmpty}>
            <div className={styles.reviewScore}>—</div>
            <div>
              <strong>No published reviews yet</strong>
              <p>
                Participant reviews are kept on the workshop page rather than
                in the booking card.
              </p>
            </div>
          </div>
        </section>

        <section
          id="recommendations"
          className={styles.contentSection + " " + styles.recommendationSection}
        >
          <SectionHeader
            eyebrow="Recommendations"
            title="You may also like"
            description="The visual recommendation rail is in place; the next step is wiring it to Tutoria discovery data."
          />

          <div className={styles.recommendationRail}>
            {[
              ["01", "More workshops", "Explore other experiences on Tutoria."],
              [
                "02",
                "Learn something new",
                "Discover classes, courses, events and workshops.",
              ],
              [
                "03",
                "For you",
                "Personalized recommendations will appear here.",
              ],
            ].map(([number, title, copy]) => (
              <article className={styles.recommendationCard} key={number}>
                <span>{number}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{copy}</p>
                </div>
                <IconChevronRight size={16} />
              </article>
            ))}
          </div>

          <Link href="/workshops" className={styles.exploreLink}>
            Explore more workshops
            <IconChevronRight size={16} />
          </Link>
        </section>
      </main>

      <MobileBookingBar
        onClick={openBookingFlow}
        loading={false}
        disabled={!selectedSession}
        priceLabel={priceLabel}
        sessionLabel={sessionLabel}
        label="Book this workshop"
      />

      {bookingOpen ? (
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
      ) : null}

      <p className={styles.toast} role="status" aria-live="polite">
        {toast}
      </p>
    </div>
  );
}
