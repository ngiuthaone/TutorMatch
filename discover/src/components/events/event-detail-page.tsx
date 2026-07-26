"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconArrowLeft,
  IconBookmark,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconMapPin,
  IconMessageCircle,
  IconMinus,
  IconPhoto,
  IconPlus,
  IconShare,
  IconShieldCheck,
  IconStarFilled,
  IconUsers,
  IconWorld,
} from "@tabler/icons-react";
import type { EventDetail, EventListing } from "@/lib/event-data";
import styles from "./event-detail-page.module.css";

interface EventDetailPageProps {
  event: EventDetail;
  similarEvents: EventListing[];
}

const formatTotal = (price: string, participants: number) => {
  if (price === "Free") return "Free";
  const amount = Number(price.replace(/[^0-9]/g, ""));
  return `${new Intl.NumberFormat("vi-VN").format(amount * participants)} đ`;
};

function uniqueImages(images: Array<string | undefined>) {
  return images.filter((image): image is string => Boolean(image)).filter((image, index, list) => list.indexOf(image) === index);
}

export function EventDetailPage({ event, similarEvents }: EventDetailPageProps) {
  const defaultSelection = `${event.sessions[0]?.id}|${event.sessions[0]?.times[0]}`;
  const [selectedSlot, setSelectedSlot] = useState(defaultSelection);
  const [participants, setParticipants] = useState(1);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(event.faqs[0]?.question || null);
  const [activePlanIndex, setActivePlanIndex] = useState(0);

  const selectedSession = useMemo(() => {
    const [sessionId, time] = selectedSlot.split("|");
    const session = event.sessions.find((item) => item.id === sessionId);
    return session ? { date: session.date, time } : null;
  }, [event.sessions, selectedSlot]);

  const galleryImages = useMemo(() => uniqueImages([event.image, event.galleryImage, ...event.plan.map((item) => item.image)]), [event.galleryImage, event.image, event.plan]);
  const activePlan = event.plan[activePlanIndex] || event.plan[0];
  const activePlanImage = activePlan?.image || event.galleryImage || event.image;

  const handleShare = async () => {
    const shareData = { title: event.title, text: event.subtitle, url: window.location.href };
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

  const handleBooking = () => {
    if (!selectedSession) {
      setStatus("Choose a date and time to continue.");
      return;
    }
    setStatus(`Selected ${selectedSession.date} at ${selectedSession.time} for ${participants} participant${participants === 1 ? "" : "s"}.`);
  };

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <Link href="/events" className={styles.backLink}><IconArrowLeft size={16} /> Explore</Link>
          <div className={styles.topTitle}><span>Tutoria Experiences</span><strong>{event.type}</strong></div>
          <div className={styles.topActions}>
            <button type="button" aria-label="Share event" onClick={handleShare}><IconShare size={17} /></button>
            <button type="button" className={saved ? styles.savedAction : undefined} onClick={() => { setSaved((current) => !current); setStatus(saved ? "Removed from saved events." : "Saved to your events."); }}><IconBookmark size={17} fill={saved ? "currentColor" : "none"} /><span>Save</span></button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.heroSection} aria-labelledby="event-title">
          <div className={styles.heroGrid}>
            <div className={styles.heroContent}>
              <h1 id="event-title">{event.title}</h1>
              <p>{event.subtitle}</p>
              <div className={styles.heroMeta}>
                <span><IconStarFilled size={16} /> <strong>{event.rating}</strong> ({event.reviewCount} reviews)</span>
                <span><IconClock size={16} /> {event.duration}</span>
                <span><IconMapPin size={16} /> {event.location}</span>
                <button type="button" onClick={() => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" })}><IconPhoto size={16} /> View photos</button>
              </div>

              <div id="gallery" className={`${styles.galleryGrid} ${galleryImages.length === 1 ? styles.gallerySingle : ""}`}>
                <button type="button" className={styles.galleryMain} onClick={() => document.getElementById("workshop-plan")?.scrollIntoView({ behavior: "smooth" })}>
                  <Image src={galleryImages[0] || event.image} alt={`Hands-on moment from ${event.title}`} fill priority unoptimized={(galleryImages[0] || event.image).startsWith("http")} sizes="(max-width: 900px) 100vw, 820px" />
                  <span className={styles.galleryBadges}><em>{event.type}</em><em>{event.level}</em></span>
                </button>
                {galleryImages.length > 1 && <div className={styles.gallerySide}>
                  {galleryImages.slice(1, 4).map((image, index) => (
                    <button type="button" key={image} onClick={() => document.getElementById("workshop-plan")?.scrollIntoView({ behavior: "smooth" })}>
                      <Image src={image} alt={`${event.title} gallery ${index + 2}`} fill unoptimized={image.startsWith("http")} sizes="(max-width: 900px) 50vw, 360px" />
                      {index === 2 && <span>View photos</span>}
                    </button>
                  ))}
                </div>}
              </div>
            </div>

            <aside className={styles.bookingPanel} aria-label="Booking summary">
              <div className={styles.bookingHead}>
                <div><strong>{event.price}</strong><span>/ participant</span></div>
                <em>{event.spotsLeft} spots</em>
              </div>

              <div className={styles.sessionSummary}>
                <span><IconClock size={17} /></span>
                <div><small>Date and time</small><strong>{selectedSession?.date || "Choose a date"}</strong><p>{selectedSession?.time || "Select a session"}</p><p>{event.studioName}</p></div>
              </div>

              <details className={styles.sessionPicker}>
                <summary>Change session <IconChevronDown size={15} /></summary>
                <div>
                  {event.sessions.map((session) => (
                    <section key={session.id}>
                      <strong>{session.date}</strong>
                      <div>
                        {session.times.map((time) => {
                          const value = `${session.id}|${time}`;
                          return <button type="button" className={selectedSlot === value ? styles.selectedSession : undefined} key={time} onClick={() => setSelectedSlot(value)}>{time}</button>;
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </details>

              <div className={styles.participantsRow}>
                <span><IconUsers size={17} /></span>
                <div><small>Participants</small><strong>{participants} guest{participants === 1 ? "" : "s"}</strong></div>
                <div className={styles.stepper}>
                  <button type="button" aria-label="Remove participant" onClick={() => setParticipants((value) => Math.max(1, value - 1))} disabled={participants === 1}><IconMinus size={15} /></button>
                  <output aria-live="polite">{participants}</output>
                  <button type="button" aria-label="Add participant" onClick={() => setParticipants((value) => Math.min(Math.max(event.spotsLeft, 1), value + 1))} disabled={participants >= event.spotsLeft}><IconPlus size={15} /></button>
                </div>
              </div>

              <div className={styles.totalBox}>
                <span>Total for {participants} guest{participants === 1 ? "" : "s"}</span>
                <strong>{formatTotal(event.price, participants)}</strong>
              </div>
              <button type="button" className={styles.primaryButton} onClick={handleBooking}>Continue</button>
              <p className={styles.noCharge}>You won&apos;t be charged yet</p>
              <p className={styles.protection}><IconShieldCheck size={16} /> Free cancellation up to 24 hours before the start.</p>
            </aside>
          </div>
        </section>

        <nav className={styles.sectionNav} aria-label="Workshop sections">
          <a href="#overview">Overview</a>
          <a href="#details">Details</a>
          <a href="#workshop-plan">Schedule</a>
          <a href="#host-location">Host and location</a>
          <a href="#faq">FAQ</a>
          <a href="#reviews">Reviews</a>
        </nav>

        <section id="overview" className={styles.overviewSection}>
          <span>About this workshop</span>
          <h2>{event.note || event.subtitle}</h2>
          <div>{event.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
        </section>

        <section id="details" className={styles.detailsSection}>
          <div className={styles.factCard}>
            <span>Workshop facts</span>
            <dl>
              <div><dt>Format</dt><dd>{event.type}</dd><small>{event.studioName}</small></div>
              <div><dt>Duration</dt><dd>{event.duration}</dd><small>Includes a short break</small></div>
              <div><dt>Languages</dt><dd>{event.languages.join(", ")}</dd></div>
              <div><dt>Minimum age</dt><dd>{event.minimumAge}</dd><small>{event.accessibility}</small></div>
            </dl>
          </div>

          <div className={styles.learningCards}>
            <section><h3>What you will learn</h3><ul>{event.learn.map((item) => <li key={item}><IconCheck size={15} />{item}</li>)}</ul></section>
            <section><h3>What is included</h3><ul>{event.included.map((item) => <li key={item}><IconCheck size={15} />{item}</li>)}</ul></section>
            <section><h3>What to bring</h3><ul>{event.bring.map((item) => <li key={item}>{item}</li>)}</ul></section>
          </div>
        </section>

        <section id="workshop-plan" className={styles.planSection}>
          <div className={styles.planCard}>
            <header>
              <div><span>Workshop plan</span><h2>How the experience unfolds.</h2><p>The flow stays guided, beginner-friendly, and paced so every participant can follow along.</p></div>
              <em><IconClock size={16} /> {event.duration}</em>
            </header>
            <div className={styles.planGrid}>
              <div className={styles.planList}>
                {event.plan.map((item, index) => (
                  <button type="button" className={index === activePlanIndex ? styles.activePlan : undefined} key={item.title} onMouseEnter={() => setActivePlanIndex(index)} onFocus={() => setActivePlanIndex(index)} onClick={() => setActivePlanIndex(index)}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div><h3>{item.title}</h3><p>{item.description}</p></div>
                    <small>{item.duration}</small>
                  </button>
                ))}
              </div>
              <div className={styles.planImage}>
                <Image src={activePlanImage} alt={`${activePlan?.title || "Workshop activity"} during ${event.title}`} fill unoptimized={activePlanImage.startsWith("http")} sizes="(max-width: 900px) 100vw, 420px" />
              </div>
            </div>
          </div>
        </section>

        <section id="host-location" className={styles.hostLocationGrid}>
          <section className={styles.hostCard}>
            <span>Host</span>
            <div className={styles.hostHeader}>
              <Image src={event.hostImage} alt={event.host} width={76} height={76} unoptimized={event.hostImage.startsWith("http")} />
              <div><h2>{event.host}</h2><p>{event.hostRole}</p><p>{event.hostExperience}</p></div>
            </div>
            <p>{event.hostBio}</p>
            <div className={styles.hostStats}><span><IconStarFilled size={15} /> {event.rating} ({event.reviewCount})</span><span><IconShieldCheck size={15} /> {event.hostRecommendation}</span></div>
            <div className={styles.hostActions}><Link href={`/profile/${encodeURIComponent(event.host)}`}>View profile</Link><button type="button" onClick={() => setStatus("Message composer opened.")}><IconMessageCircle size={15} /> Message host</button></div>
          </section>

          <section className={styles.locationCard}>
            <span>Location</span>
            <h2>{event.studioName}</h2>
            <p>{event.address}</p>
            <small>{event.type === "Online" ? "Joining details are sent after booking." : "The exact entrance details are provided after booking."}</small>
            {event.type === "In person" ? <iframe title={`Map showing ${event.location}`} src="https://www.openstreetmap.org/export/embed.html?bbox=105.802%2C21.045%2C105.835%2C21.075&layer=mapnik&marker=21.06%2C105.818" loading="lazy" /> : <div className={styles.onlineVenue}><IconWorld size={44} /><strong>Join from anywhere</strong></div>}
          </section>
        </section>

        <section id="faq" className={styles.faqSection}>
          <span>FAQ</span>
          <h2>Practical details before you book.</h2>
          <div className={styles.faqList}>
            {event.faqs.map((faq, index) => {
              const isOpen = openFaq === faq.question;
              const answerId = `event-faq-${index}`;
              return (
                <article className={isOpen ? styles.faqOpen : undefined} key={faq.question}>
                  <button type="button" aria-expanded={isOpen} aria-controls={answerId} onClick={() => setOpenFaq(isOpen ? null : faq.question)}><span>{faq.question}</span><IconPlus size={19} /></button>
                  {isOpen && <div id={answerId} role="region" aria-label={faq.question}><p>{faq.answer}</p></div>}
                </article>
              );
            })}
          </div>
        </section>

        <section id="reviews" className={styles.reviewsSection}>
          <div className={styles.sectionHeading}><span>Reviews</span><h2><IconStarFilled size={18} /> {event.rating} ({event.reviewCount})</h2></div>
          <div className={styles.reviewGrid}>
            {event.reviews.map((review) => (
              <article key={review.name}>
                <div><Image src={review.avatar} alt="" width={42} height={42} unoptimized /><span><strong>{review.name}</strong><small>{review.attended}</small></span></div>
                <p>{review.body}</p>
              </article>
            ))}
          </div>
        </section>

        {event.beforeYouAttend.length > 0 && (
          <section className={styles.beforeSection}>
            {event.beforeYouAttend.map((group) => <div key={group.title}><h3>{group.title}</h3><ul>{group.items.map((item) => <li key={item}><IconCheck size={14} />{item}</li>)}</ul></div>)}
          </section>
        )}

        <section className={styles.similarSection}>
          <div className={styles.sectionHeading}><span>More experiences</span><h2>You may also like</h2><Link href="/events">See more</Link></div>
          <div className={styles.similarList}>
            {similarEvents.map((item) => <Link href={`/events/${item.slug}`} key={item.slug}><Image src={item.image} alt="" width={96} height={76} unoptimized={item.image.startsWith("http")} /><span><strong>{item.title}</strong><small>{item.host}</small><small>{item.price}</small></span></Link>)}
          </div>
        </section>
      </main>

      <div className={styles.mobileBookingBar}>
        <div><strong>{formatTotal(event.price, participants)}</strong><span>{selectedSession?.date || "Choose a session"}</span></div>
        <button type="button" onClick={handleBooking}>Book workshop</button>
      </div>
      <p className={styles.status} role="status" aria-live="polite">{status}</p>
    </div>
  );
}
