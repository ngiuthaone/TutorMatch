"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconAccessible,
  IconArrowLeft,
  IconBookmark,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconLanguage,
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

export function EventDetailPage({ event, similarEvents }: EventDetailPageProps) {
  const defaultSelection = `${event.sessions[0]?.id}|${event.sessions[0]?.times[0]}`;
  const [selectedSlot, setSelectedSlot] = useState(defaultSelection);
  const [participants, setParticipants] = useState(1);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const selectedSession = useMemo(() => {
    const [sessionId, time] = selectedSlot.split("|");
    const session = event.sessions.find((item) => item.id === sessionId);
    return session ? { date: session.date, time } : null;
  }, [event.sessions, selectedSlot]);

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
      <main className={styles.shell}>
        <div className={styles.topLine}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/events"><IconArrowLeft size={16} /> Events</Link>
            <IconChevronRight size={14} aria-hidden="true" />
            <span>{event.topic}</span>
            <IconChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">{event.title}</span>
          </nav>
          <div className={styles.topActions}>
            <button type="button" onClick={handleShare}><IconShare size={17} /> Share</button>
            <button type="button" className={saved ? styles.savedAction : undefined} onClick={() => { setSaved((current) => !current); setStatus(saved ? "Removed from saved events." : "Saved to your events."); }}>
              <IconBookmark size={17} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>

        <div className={styles.detailGrid}>
          <div className={styles.contentColumn}>
            <section className={styles.hero} aria-labelledby="event-title">
              <Image className={styles.heroImage} src={event.image} alt={`Hands-on moment from ${event.title}`} fill priority unoptimized={event.image.startsWith("http")} sizes="(max-width: 980px) 100vw, 900px" />
              <div className={styles.heroScrim} />
              <div className={styles.heroContent}>
                <p>{event.type} / {event.level}</p>
                <h1 id="event-title">{event.title}</h1>
                <span>{event.subtitle}</span>
                <div className={styles.heroMeta}>
                  <span><IconStarFilled size={15} /> {event.rating} ({event.reviewCount} reviews)</span>
                  <span><IconClock size={15} /> {event.duration}</span>
                  <span><IconMapPin size={15} /> {event.location}</span>
                </div>
              </div>
              <button type="button" className={styles.photoButton} onClick={() => document.getElementById("workshop-plan")?.scrollIntoView({ behavior: "smooth" })}>
                <IconPhoto size={16} /> View photos
              </button>
            </section>

            <section className={styles.factStrip} aria-label="Event details">
              <div><IconMapPin size={21} /><span><strong>{event.type}</strong><small>{event.studioName}</small></span></div>
              <div><IconClock size={21} /><span><strong>{event.duration}</strong><small>Includes a short break</small></span></div>
              <div><IconLanguage size={21} /><span><strong>Languages</strong><small>{event.languages.join(", ")}</small></span></div>
              <div><IconUsers size={21} /><span><strong>{event.minimumAge}</strong><small>Minimum age</small></span></div>
              <div><IconAccessible size={21} /><span><strong>Accessibility</strong><small>{event.accessibility}</small></span></div>
            </section>

            <section className={styles.contentSection}>
              <h2>About this workshop</h2>
              {event.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              <p className={styles.accentNote}>{event.note}</p>
              <div className={styles.highlights}>
                {event.highlights.map((item) => (
                  <div key={item.title}><IconCheck size={18} /><span><strong>{item.title}</strong><small>{item.description}</small></span></div>
                ))}
              </div>
            </section>

            <section className={`${styles.contentSection} ${styles.learningGrid}`}>
              <div>
                <h2>What you will learn</h2>
                <ul>{event.learn.map((item) => <li key={item}><IconCheck size={15} />{item}</li>)}</ul>
              </div>
              <div>
                <h2>What is included</h2>
                <ul>{event.included.map((item) => <li key={item}><IconCheck size={15} />{item}</li>)}</ul>
              </div>
              <div>
                <h2>What to bring</h2>
                <ul>{event.bring.map((item) => <li key={item}><IconCheck size={15} />{item}</li>)}</ul>
              </div>
            </section>

            <section id="workshop-plan" className={`${styles.contentSection} ${styles.planSection}`}>
              <div>
                <h2>Workshop plan</h2>
                <ol className={styles.planList}>
                  {event.plan.map((item, index) => (
                    <li key={item.title}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div><h3>{item.title}<small>{item.duration}</small></h3><p>{item.description}</p></div>
                    </li>
                  ))}
                </ol>
                <p className={styles.planTotal}>Guided activities: {event.duration}. A short break is included.</p>
              </div>
              <div className={styles.planImage}>
                <Image src={event.galleryImage} alt={`Learners taking part in ${event.title}`} fill unoptimized={event.galleryImage.startsWith("http")} sizes="(max-width: 760px) 100vw, 360px" />
              </div>
            </section>

            <section className={`${styles.contentSection} ${styles.faqSection}`}>
              <h2>Frequently asked questions</h2>
              <p className={styles.faqIntro}>Practical details to help you prepare for the workshop.</p>
              <div className={styles.faqList}>
                {event.faqs.map((faq, index) => {
                  const isOpen = openFaq === faq.question;
                  const answerId = `event-faq-${index}`;
                  return (
                  <div className={styles.faqItem} key={faq.question}>
                    <button
                      type="button"
                      className={`${styles.faqQuestion} ${isOpen ? styles.faqOpen : ""}`}
                      aria-expanded={isOpen}
                      aria-controls={answerId}
                      onClick={() => setOpenFaq(isOpen ? null : faq.question)}
                    >
                      <span>{faq.question}</span>
                      <IconChevronDown size={19} aria-hidden="true" />
                    </button>
                    {isOpen && <div id={answerId} className={styles.faqAnswer} role="region" aria-label={faq.question}><p>{faq.answer}</p></div>}
                  </div>
                  );
                })}
              </div>
            </section>

            <div className={styles.hostLocationGrid}>
              <section className={styles.hostCard}>
                <h2>Meet your host</h2>
                <div className={styles.hostHeader}>
                  <Image src={event.hostImage} alt={event.host} width={76} height={76} unoptimized={event.hostImage.startsWith("http")} />
                  <div><h3>{event.host}</h3><p>{event.hostRole}</p><p>{event.hostExperience}</p></div>
                </div>
                <div className={styles.hostStats}><span><IconStarFilled size={14} /> {event.rating} ({event.reviewCount})</span><span><IconShieldCheck size={15} /> {event.hostRecommendation}</span></div>
                <p>{event.hostBio}</p>
                <div className={styles.dualActions}><button type="button" onClick={() => setStatus("Host profile preview opened.")}>View profile</button><button type="button" onClick={() => setStatus("Message composer opened.")}><IconMessageCircle size={15} /> Message host</button></div>
              </section>

              <section className={styles.locationCard}>
                <h2>Location</h2>
                <h3>{event.studioName}</h3>
                <p>{event.address}</p>
                <small>{event.type === "Online" ? "Joining details are sent after booking." : "The exact entrance details are provided after booking."}</small>
                {event.type === "In person" ? (
                  <iframe title={`Map showing ${event.location}`} src="https://www.openstreetmap.org/export/embed.html?bbox=105.802%2C21.045%2C105.835%2C21.075&layer=mapnik&marker=21.06%2C105.818" loading="lazy" />
                ) : (
                  <div className={styles.onlineVenue}><IconWorld size={44} /><span>Join from anywhere</span></div>
                )}
              </section>
            </div>

            <section className={`${styles.contentSection} ${styles.reviewsSection}`}>
              <div className={styles.sectionHeading}>
                <h2>Reviews <span><IconStarFilled size={15} /> {event.rating} ({event.reviewCount})</span></h2>
                <button type="button" onClick={() => setStatus("All reviews loaded.")}>See all reviews</button>
              </div>
              <div className={styles.reviewGrid}>
                {event.reviews.map((review) => (
                  <article key={review.name}>
                    <div className={styles.reviewer}><Image src={review.avatar} alt="" width={40} height={40} unoptimized /><span><strong>{review.name}</strong><small>{review.attended}</small></span></div>
                    <div className={styles.stars} role="img" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: review.rating }).map((_, index) => <IconStarFilled key={index} size={14} />)}</div>
                    <p>{review.body}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className={styles.sidebar} aria-label="Booking and event information">
            <section className={`${styles.sidebarCard} ${styles.bookingCard}`}>
              <div className={styles.price}><strong>{event.price}</strong><span>per participant</span></div>
              <fieldset>
                <legend>Choose a date and time</legend>
                <div className={styles.sessionList}>
                  {event.sessions.map((session) => (
                    <div className={styles.session} key={session.id}>
                      <strong>{session.date}</strong>
                      <div>
                        {session.times.map((time) => {
                          const value = `${session.id}|${time}`;
                          return (
                            <label key={time} className={selectedSlot === value ? styles.selectedTime : undefined}>
                              <input type="radio" name="event-time" value={value} checked={selectedSlot === value} onChange={() => setSelectedSlot(value)} />
                              <span>{time}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </fieldset>
              <div className={styles.participantsRow}>
                <div><strong>Participants</strong><span>{event.spotsLeft} spots left</span></div>
                <div className={styles.stepper}>
                  <button type="button" aria-label="Remove one participant" onClick={() => setParticipants((value) => Math.max(1, value - 1))} disabled={participants === 1}><IconMinus size={16} /></button>
                  <output aria-live="polite">{participants}</output>
                  <button type="button" aria-label="Add one participant" onClick={() => setParticipants((value) => Math.min(Math.max(event.spotsLeft, 1), value + 1))} disabled={participants >= event.spotsLeft}><IconPlus size={16} /></button>
                </div>
              </div>
              <div className={styles.totalRow}><span>Total</span><strong>{formatTotal(event.price, participants)}</strong></div>
              <button type="button" className={styles.primaryButton} onClick={handleBooking}>Book workshop</button>
              <button type="button" className={styles.secondaryButton} onClick={() => setStatus("You joined the waitlist.")}>Join waitlist</button>
              <p className={styles.protection}><IconShieldCheck size={16} /> Free cancellation up to 24 hours before the start.</p>
            </section>

            <section className={styles.sidebarCard}>
              <h2>Before you attend</h2>
              {event.beforeYouAttend.map((group) => (
                <div className={styles.attendGroup} key={group.title}><h3>{group.title}</h3><ul>{group.items.map((item) => <li key={item}><IconCheck size={14} />{item}</li>)}</ul></div>
              ))}
            </section>

            <section className={styles.sidebarCard}>
              <h2>Cancellation and refund policy</h2>
              {event.cancellation.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              <button type="button" className={styles.textButton} onClick={() => setStatus("Full cancellation policy opened.")}>Read full policy</button>
            </section>

            <section className={styles.sidebarCard}>
              <h2>Have a question?</h2>
              <p>Message the host before booking.</p>
              <button type="button" className={styles.messageButton} onClick={() => setStatus("Message composer opened.")}><IconMessageCircle size={16} /> Message host</button>
              <small>Typically replies within a few hours.</small>
            </section>

            <section className={`${styles.sidebarCard} ${styles.similarCard}`}>
              <div className={styles.similarHeading}><h2>You may also like</h2><Link href="/events">See more</Link></div>
              <div className={styles.similarList}>
                {similarEvents.map((item) => (
                  <Link href={`/events/${item.slug}`} key={item.slug}>
                    <Image src={item.image} alt="" width={76} height={76} unoptimized={item.image.startsWith("http")} />
                    <span><strong>{item.title}</strong><small>{item.host}</small><small>{item.price}</small></span>
                  </Link>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>

      <div className={styles.mobileBookingBar}>
        <div><strong>{formatTotal(event.price, participants)}</strong><span>{selectedSession?.date || "Choose a session"}</span></div>
        <button type="button" onClick={handleBooking}>Book workshop</button>
      </div>
      <p className={styles.status} role="status" aria-live="polite">{status}</p>
    </div>
  );
}
