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
  type WorkshopRecommendation,
  type WorkshopPublishedContent,
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
  | {
      status: "ready";
      offering: WorkshopOffering;
      sessions: BookableSession[];
      content?: WorkshopPublishedContent;
      recommendations: WorkshopRecommendation[];
    };

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
              const full = (item.spotsLeft ?? 0) <= 0;
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

function MediaGallery({
  title,
  images,
}: {
  title: string;
  images: string[];
}) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const safeImages = images.filter(Boolean).slice(0, 5);

  if (!safeImages.length) {
    return (
      <div className={styles.galleryEmpty}>
        <span>{title}</span>
        <small>Workshop media will appear here after the creator adds it.</small>
      </div>
    );
  }

  return (
    <>
      <div className={styles.gallery}>
        <button
          type="button"
          className={styles.galleryTile + " " + styles.galleryPrimary}
          onClick={() => setOpen(true)}
          aria-label={"Open gallery for " + title}
          style={{ backgroundImage: `url("${safeImages[0]}")` }}
        >
          <span>{title}</span>
          <small>View gallery</small>
        </button>

        {safeImages.slice(1, 5).map((image, index) => (
          <button
            type="button"
            key={image + index}
            className={styles.galleryTile}
            onClick={() => {
              setActive(index + 1);
              setOpen(true);
            }}
            aria-label={"Open workshop image " + (index + 2)}
            style={{ backgroundImage: `url("${image}")` }}
          >
            <span>{index + 2}</span>
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

            <div
              className={styles.galleryFocus}
              style={{ backgroundImage: `url("${safeImages[active] ?? safeImages[0]}")` }}
            />

            <div className={styles.galleryThumbs}>
              {safeImages.map((image, index) => (
                <button
                  type="button"
                  key={image + index}
                  className={styles.galleryThumb + (active === index ? " " + styles.galleryThumbActive : "")}
                  onClick={() => setActive(index)}
                  aria-label={"View image " + (index + 1)}
                  style={{ backgroundImage: `url("${image}")` }}
                />
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
  const [selectedBranchId, setSelectedBranchId] = useState("");
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

        setPage({
          status: "ready",
          offering,
          sessions: bookableSessions,
          content: result.content,
          recommendations: result.recommendations,
        });
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
    const branches = page.status === "ready" ? page.content?.branches ?? [] : [];
    setSelectedBranchId(branches[0]?.id ?? "");
  }, [page]);

  const offering = page.status === "ready" ? page.offering : null;
  const sessions = page.status === "ready" ? page.sessions : [];
  const content = page.status === "ready" ? page.content : undefined;
  const recommendations = page.status === "ready" ? page.recommendations : [];
  const branches = content?.branches ?? [];
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];
  const safeMapUrl =
    selectedBranch?.mapUrl && /^https:\/\//i.test(selectedBranch.mapUrl)
      ? selectedBranch.mapUrl
      : undefined;
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

  const descriptionParagraphs = content?.about?.length
    ? content.about
    : offering.description
      ? offering.description
          .split(/\n{2,}/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  const mediaImages = [
    content?.image,
    content?.galleryImage,
    ...(content?.plan ?? []).map((item) => item.image),
  ].filter((value): value is string => Boolean(value));

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

                {content?.subtitle ? (
                  <p className={styles.heroDescription}>{content.subtitle}</p>
                ) : (
                  <p className={styles.heroDescription}>
                    {offering.description || "A host-led learning experience on Tutoria."}
                  </p>
                )}

                <div className={styles.heroMeta}>
                  <span>
                    <IconClock size={14} />
                    {content?.duration || (visibleSessions.length ? "Scheduled sessions" : "Flexible schedule")}
                  </span>
                  {content?.minimumAge ? (
                    <span><IconUsers size={14} /> {content.minimumAge}</span>
                  ) : null}
                  {content?.location ? (
                    <span><IconMapPin size={14} /> {content.location}</span>
                  ) : null}
                </div>

                <MediaGallery title={offering.title} images={mediaImages} />
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
                      {(() => {
                        const spotsLeft = selectedSession.spotsLeft ?? 0;
                        return spotsLeft <= 3 ? (
                          <p className={styles.urgency}>
                            {spotsLeft === 0
                              ? "This session is full."
                              : spotsLeft + " spot" + (spotsLeft === 1 ? "" : "s") + " remaining"}
                          </p>
                        ) : null;
                      })()}

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

        {content?.highlights?.length ? (
          <section className={styles.contentSection}>
            <SectionHeader
              eyebrow="Highlights"
              title="What makes this workshop special."
            />
            <div className={styles.highlightGrid}>
              {content.highlights.map((item) => (
                <article className={styles.highlightCard} key={item.title}>
                  <div className={styles.highlightIcon}><IconSparkles size={17} /></div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {content?.plan?.length ? (
          <section className={styles.contentSection}>
            <SectionHeader
              eyebrow="Workshop plan"
              title="How the experience flows."
              description="The published plan comes directly from the creator's structured workshop content."
            />
            <div className={styles.planList}>
              {content.plan.map((step, index) => (
                <article className={styles.planRow} key={step.title + index}>
                  <div className={styles.planIndex}>{String(index + 1).padStart(2, "0")}</div>
                  <div className={styles.planCopy}>
                    <div className={styles.planTopline}>
                      <h3>{step.title}</h3>
                      {step.duration ? <span>{step.duration}</span> : null}
                    </div>
                    <p>{step.description}</p>
                  </div>
                  {step.image ? (
                    <div className={styles.planImage} style={{ backgroundImage: `url("${step.image}")` }} />
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {content?.learn?.length || content?.included?.length || content?.bring?.length ? (
          <section className={styles.contentSection}>
            <SectionHeader
              eyebrow="Good to know"
              title="Everything you need before you arrive."
            />
            <div className={styles.goodToKnowGrid}>
              {content.learn?.length ? (
                <article className={styles.checklistCard}>
                  <span className={styles.cardLabel}>You’ll learn</span>
                  <ul>{content.learn.map((item) => <li key={item}>{item}</li>)}</ul>
                </article>
              ) : null}
              {content.included?.length ? (
                <article className={styles.checklistCard}>
                  <span className={styles.cardLabel}>Included</span>
                  <ul>{content.included.map((item) => <li key={item}>{item}</li>)}</ul>
                </article>
              ) : null}
              {content.bring?.length ? (
                <article className={styles.checklistCard}>
                  <span className={styles.cardLabel}>Bring</span>
                  <ul>{content.bring.map((item) => <li key={item}>{item}</li>)}</ul>
                </article>
              ) : null}
            </div>
          </section>
        ) : null}

        {content?.beforeYouAttend?.length ? (
          <section className={styles.contentSection}>
            <SectionHeader
              eyebrow="Before you attend"
              title="A few practical details."
            />
            <div className={styles.beforeAttendGrid}>
              {content.beforeYouAttend.map((group) => (
                <article className={styles.beforeAttendCard} key={group.title}>
                  <span className={styles.cardLabel}>{group.title}</span>
                  <ul>
                    {group.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        ) : null}

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
                  const full = (item.spotsLeft ?? 0) <= 0;
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
            title={content?.host ? `Meet ${content.host}.` : "Meet your workshop host."}
            description={content?.hostBio || "Host and venue information published with the workshop."}
          />

          <div className={styles.hostLocationGrid}>
            <article className={styles.hostCard}>
              <div
                className={styles.hostAvatarImage}
                style={content?.hostImage ? { backgroundImage: `url("${content.hostImage}")` } : undefined}
              >
                {!content?.hostImage ? "T" : null}
              </div>
              <div>
                <span className={styles.cardLabel}>Workshop host</span>
                <h3>{content?.host || "Tutoria host"}</h3>
                {content?.hostRole ? <strong className={styles.hostRole}>{content.hostRole}</strong> : null}
                {content?.hostExperience ? <span className={styles.hostExperience}>{content.hostExperience}</span> : null}
                {content?.hostBio ? <p>{content.hostBio}</p> : null}
                {content?.hostRecommendation ? (
                  <span className={styles.recommendationBadge}>{content.hostRecommendation}</span>
                ) : null}
              </div>
            </article>

            <article className={styles.locationCard}>
              <div className={styles.locationIcon}><IconMapPin size={18} /></div>
              <div className={styles.locationContent}>
                <span className={styles.cardLabel}>Location</span>

                {branches.length > 1 ? (
                  <div className={styles.branchPicker}>
                    {branches.map((branch) => (
                      <button
                        type="button"
                        key={branch.id}
                        className={selectedBranch?.id === branch.id ? styles.branchActive : styles.branch}
                        onClick={() => setSelectedBranchId(branch.id)}
                      >
                        {branch.name}
                      </button>
                    ))}
                  </div>
                ) : null}

                <h3>{selectedBranch?.name || content?.studioName || content?.location || "Location provided after booking"}</h3>
                {selectedBranch?.address || content?.address ? (
                  <p>{selectedBranch?.address || content?.address}</p>
                ) : (
                  <p>Location details will appear here when supplied by the creator.</p>
                )}
                {safeMapUrl ? (
                  <a className={styles.mapLink} href={safeMapUrl} target="_blank" rel="noreferrer">
                    Open map
                    <IconChevronRight size={14} />
                  </a>
                ) : null}
                {selectedBranch?.note ? <span className={styles.accessibilityLine}>{selectedBranch.note}</span> : null}
                {content?.accessibility ? <span className={styles.accessibilityLine}>{content.accessibility}</span> : null}
                {branches.length > 1 ? (
                  <span className={styles.branchCount}>{branches.length} branches</span>
                ) : null}
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
            items={
              content?.faqs?.length
                ? content.faqs
                : [
                    {
                      question: "How do I choose a session?",
                      answer: "Select a published date and time in the booking card or Schedule section.",
                    },
                    {
                      question: "How does booking work?",
                      answer:
                        offering.bookingMode === "instant"
                          ? "Your selected session can be booked immediately once you complete the booking flow."
                          : "Tutoria sends the booking request to the host, who then approves or rejects it.",
                    },
                  ]
            }
          />
          {content?.cancellation?.length ? (
            <div className={styles.cancellationCard}>
              <span className={styles.cardLabel}>Cancellation</span>
              <ul>{content.cancellation.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : null}
        </section>

        <section id="reviews" className={styles.contentSection}>
          <SectionHeader
            eyebrow="Reviews"
            title={
              content?.rating
                ? `${content.rating.toFixed(1)} · ${content.reviewCount || 0} reviews`
                : "What participants say."
            }
            description="Reviews are published separately from the booking engine so the page can stay focused on the experience."
          />

          {content?.reviews?.length ? (
            <div className={styles.reviewGrid}>
              {content.reviews.slice(0, 6).map((review) => (
                <article className={styles.reviewCard} key={review.name + review.attended}>
                  <div className={styles.reviewTop}>
                    <div
                      className={styles.reviewAvatar}
                      style={
                        review.avatar
                          ? { backgroundImage: `url("${review.avatar}")` }
                          : undefined
                      }
                    />
                    <div>
                      <strong>{review.name}</strong>
                      <span>{review.attended}</span>
                    </div>
                    <b>{"★".repeat(Math.max(0, Math.min(5, Math.round(review.rating))))}</b>
                  </div>
                  <p>{review.body}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.reviewEmpty}>
              <div>
                <strong>No published reviews yet.</strong>
                <p>Reviews from completed participants will appear here.</p>
              </div>
            </div>
          )}
        </section>

        <section
          id="recommendations"
          className={styles.contentSection + " " + styles.recommendationSection}
        >
          <SectionHeader
            eyebrow="Recommendations"
            title="You may also like"
            description="Recommendations are drawn from Tutoria's published event catalogue."
          />

          {recommendations.length ? (
            <div className={styles.recommendationRail}>
              {recommendations.slice(0, 6).map((item) => (
                <Link
                  href={"/workshops/" + item.slug}
                  className={styles.recommendationCard}
                  key={item.slug}
                >
                  <div
                    className={styles.recommendationImage}
                    style={item.image ? { backgroundImage: `url("${item.image}")` } : undefined}
                  />
                  <div className={styles.recommendationCopy}>
                    <span>{item.topic || "Workshop"}</span>
                    <strong>{item.title}</strong>
                    <p>{item.host}{item.location ? " · " + item.location : ""}</p>
                    {item.rating ? <small>★ {item.rating.toFixed(1)}{item.reviewCount ? " · " + item.reviewCount : ""}</small> : null}
                  </div>
                  <IconChevronRight size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.reviewEmpty}>
              <div>
                <strong>More workshops are coming.</strong>
                <p>Once the published workshop catalogue is available, related experiences will appear here.</p>
              </div>
            </div>
          )}

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

      <p className={toast ? styles.toast : styles.toastHidden} role="status" aria-live="polite">
        {toast}
      </p>
    </div>
  );
}
