"use client";

import Image from "next/image";
import { useState } from "react";
import {
  IconArrowRight,
  IconBook2,
  IconCalendar,
  IconCheck,
  IconClock,
  IconDeviceLaptop,
  IconHeartHandshake,
  IconHome,
  IconIdBadge2,
  IconLanguage,
  IconMapPin,
  IconMessageCircle,
  IconRosetteDiscountCheck,
  IconSchool,
  IconShieldCheck,
  IconSparkles,
  IconStarFilled,
  IconUsers,
} from "@tabler/icons-react";
import { formatVnd, getTutorProfile } from "./tutor-profile-data";
import styles from "./tutor-profile-redesign.module.css";

const availability = [
  { time: "09:00 - 12:00", days: [true, true, true, true, true, false, false] },
  { time: "14:00 - 18:00", days: [true, true, true, true, true, true, false] },
  { time: "18:00 - 21:00", days: [true, true, true, true, false, false, false] },
];

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const lessonFormats = [
  { icon: IconDeviceLaptop, title: "Online", detail: "Live video lessons with screen sharing and feedback." },
  { icon: IconHome, title: "At my teaching space", detail: "A prepared space with the tools needed for the lesson." },
  { icon: IconMapPin, title: "At your location", detail: "Available in central Ha Noi when the lesson allows it." },
  { icon: IconUsers, title: "Public place", detail: "Libraries, studios, cafes, or community spaces." },
];

const profileFaqs = [
  { question: "How do I book a lesson with this tutor?", answer: "Choose a lesson length, then select an available time. Your booking is confirmed once the tutor accepts it." },
  { question: "Can I reschedule a booked lesson?", answer: "Yes. You can reschedule from your bookings area, subject to the cancellation notice shown above." },
  { question: "What should I prepare for my first lesson?", answer: "Bring your goal, any relevant materials, and a few examples of what you would like to learn. Your tutor will tailor the first session from there." },
  { question: "How are lessons paid for?", answer: "Payments are made securely through Tutoria when you book. The lesson price and any first-session offer are shown before you confirm." },
];

export function ProfileReplacement({ name }: { name?: string }) {
  const profile = getTutorProfile(name);
  const firstName = profile.name.split(" ")[0];
  const rateOptions = [
    { minutes: 30, price: Math.round(profile.price * 0.6 / 10000) * 10000 },
    { minutes: 50, price: Math.round(profile.price * 0.85 / 10000) * 10000 },
    { minutes: 60, price: profile.price, popular: true },
    { minutes: 90, price: Math.round(profile.price * 1.4 / 10000) * 10000 },
  ];
  const [selectedMinutes, setSelectedMinutes] = useState(60);
  const selectedRate = rateOptions.find((rate) => rate.minutes === selectedMinutes) ?? rateOptions[2];
  const selectedFirstLessonPrice = Math.round(selectedRate.price * 0.88 / 5000) * 5000;
  const consultationPrice = Math.round(profile.price * 0.4 / 10000) * 10000;

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <section className={styles.hero} aria-labelledby="profile-name">
            <div className={styles.portrait}>
              <Image
                src={profile.image}
                alt={`${profile.name}, ${profile.role}`}
                fill
                loading="eager"
                unoptimized
                sizes="(max-width: 760px) 100vw, (max-width: 1180px) 38vw, 352px"
              />
            </div>

            <div className={styles.identity}>
              <span className={styles.roleLabel}>{profile.role}</span>
              <div className={styles.verificationRow}>
                <span><IconRosetteDiscountCheck aria-hidden="true" /> Verified tutor</span>
                <span><IconIdBadge2 aria-hidden="true" /> ID verified</span>
              </div>

              <div className={styles.nameRow}>
                <h1 id="profile-name">{profile.name}</h1>
                <span className={styles.rating}><IconStarFilled aria-hidden="true" /> {profile.rating} <small>({profile.reviewCount} reviews)</small></span>
              </div>

              <p className={styles.tagline}>{profile.tagline}</p>

              <div className={styles.keyFacts}>
                <span><IconBook2 aria-hidden="true" /><strong>{profile.lessons}</strong><small>Lessons taught</small></span>
                <span><IconClock aria-hidden="true" /><strong>{profile.responseTime}</strong><small>Average response</small></span>
                <span><IconMapPin aria-hidden="true" /><strong>{profile.location}</strong><small>Local time GMT+7</small></span>
              </div>

              <div className={styles.attributeGroup}>
                <h2>Languages</h2>
                <div>{profile.languages.map((language) => <span key={language}>{language}</span>)}</div>
              </div>

            </div>
          </section>

          <nav className={styles.sectionNav} aria-label="Tutor profile sections">
            <a href="#about">About</a>
            <a href="#lessons">Lessons &amp; pricing</a>
            <a href="#availability">Availability</a>
            <a href="#reviews">Reviews ({profile.reviewCount})</a>
            <a href="#faq">FAQ</a>
          </nav>

          <section className={`${styles.panel} ${styles.aboutPanel}`} id="about">
            <div>
              <h2>About {firstName}</h2>
              {profile.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>

          <div className={styles.trioGrid}>
            <section className={styles.panel}>
              <h2>What I teach</h2>
              <ul className={styles.iconList}>
                {profile.subjects.map((subject) => <li key={subject}><IconSchool aria-hidden="true" />{subject}</li>)}
              </ul>
            </section>
            <section className={styles.panel}>
              <h2>Learner levels</h2>
              <ul className={styles.dotList}>
                {profile.learnerLevels.map((level) => <li key={level}>{level}</li>)}
              </ul>
            </section>
            <section className={styles.panel}>
              <h2>Age groups</h2>
              <ul className={styles.iconList}>
                {profile.ageGroups.map((group) => <li key={group}><IconUsers aria-hidden="true" />{group}</li>)}
              </ul>
            </section>
          </div>

          <section className={`${styles.panel} ${styles.teachingPanel}`}>
            <h2>My teaching style</h2>
            <div className={styles.styleTags}>{profile.teachingStyles.map((style) => <span key={style}>{style}</span>)}</div>
          </section>

          <div className={`${styles.splitGrid} ${styles.outcomeGrid}`}>
            <section className={`${styles.panel} ${styles.outcomesPanel}`}>
              <div className={styles.outcomesIntro}>
                <span>Built for real situations</span>
                <h2>What you can achieve</h2>
                <p>Turn focused practice into speaking skills you can use immediately.</p>
              </div>
              <ul className={styles.checkList}>
                {profile.outcomes.map((outcome) => <li key={outcome}><span>{outcome}</span><IconCheck aria-hidden="true" /></li>)}
              </ul>
            </section>
            <section className={styles.panel}>
              <h2>What happens in a typical lesson</h2>
              <p>{profile.typicalLesson}</p>
            </section>
          </div>

          <section className={`${styles.panel} ${styles.formatsPanel}`}>
            <h2>Lesson formats &amp; teaching locations</h2>
            <div className={styles.formatsGrid}>
              {lessonFormats.map(({ icon: Icon, title, detail }) => (
                <div key={title}>
                  <Icon aria-hidden="true" />
                  <span><strong>{title}</strong><small>{detail}</small></span>
                </div>
              ))}
            </div>
          </section>

          <div className={styles.availabilityGrid} id="availability">
            <section className={`${styles.panel} ${styles.schedulePanel}`}>
              <h2>Weekly availability <small>(Ha Noi time GMT+7)</small></h2>
              <div className={styles.schedule} role="table" aria-label={`${profile.name}'s weekly availability`}>
                <div className={styles.scheduleRow} role="row">
                  <span role="columnheader">Time</span>
                  {weekDays.map((day) => <span role="columnheader" key={day}>{day}</span>)}
                </div>
                {availability.map((row) => (
                  <div className={styles.scheduleRow} role="row" key={row.time}>
                    <span role="rowheader">{row.time}</span>
                    {row.days.map((available, index) => <span role="cell" key={`${row.time}-${weekDays[index]}`} aria-label={available ? "Available" : "Unavailable"}>{available ? <IconCheck aria-hidden="true" /> : "-"}</span>)}
                  </div>
                ))}
              </div>
            </section>

          </div>

          <section className={`${styles.panel} ${styles.ratesPanel}`} id="lessons">
            <h2>Rates &amp; offers</h2>
            <div className={styles.rateCards} role="group" aria-label="Choose a lesson length">
              {rateOptions.map((rate) => {
                const isSelected = selectedMinutes === rate.minutes;
                return (
                  <button
                    className={`${styles.rateOption} ${isSelected ? styles.rateOptionSelected : ""}`}
                    type="button"
                    key={rate.minutes}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedMinutes(rate.minutes)}
                  >
                    {rate.popular && <span className={styles.popularTag}>Popular</span>}
                    <span className={styles.rateDuration}>{rate.minutes} minutes</span>
                    <strong>{formatVnd(rate.price).replace(" đ", "")}</strong>
                    <small>VND</small>
                  </button>
                );
              })}
            </div>

            <div className={styles.offerBanner} aria-live="polite" aria-atomic="true">
              <div>
                <h3>First session offer</h3>
                <p>New learners receive a lower price on their first {selectedMinutes}-minute lesson. Get a feel for the teaching style and start building your plan.</p>
              </div>
              <div className={styles.offerPrice}>
                <span>{formatVnd(selectedRate.price)}</span>
                <strong>{formatVnd(selectedFirstLessonPrice)}</strong>
                <small>First lesson price</small>
              </div>
            </div>
          </section>

          <div className={styles.policyGrid}>
            <section className={styles.panel}>
              <h2>Booking rules &amp; cancellation policy</h2>
              <div className={styles.policyCopy}>
                <div><strong>Same-day booking</strong><p>Available when the tutor has an open time.</p></div>
                <div><strong>No-show</strong><p>The full lesson fee is charged.</p></div>
                <div><strong>Learner cancellation</strong><p>Full refund at least 24 hours before the lesson.</p></div>
                <div><strong>Tutor cancellation</strong><p>Full refund with the option to reschedule.</p></div>
              </div>
            </section>

            <section className={`${styles.panel} ${styles.consultation}`}>
              <h2>Short consultation</h2>
              <p>Ask a focused question or see if the tutor is right for your goal.</p>
              <div><span><IconClock aria-hidden="true" />20 minutes</span><strong>{formatVnd(consultationPrice)}</strong></div>
              <ul>
                <li>Get quick feedback or guidance</li>
                <li>Discuss goals, materials, or project ideas</li>
                <li>Useful for new learners</li>
              </ul>
              <a className={styles.primaryButton} href="#availability">Choose a time</a>
            </section>
          </div>

          <section className={`${styles.panel} ${styles.faqPanel}`} id="faq" aria-labelledby="profile-faq-title">
            <div className={styles.faqHeading}>
              <div>
                <span>Before you book</span>
                <h2 id="profile-faq-title">Frequently asked questions</h2>
              </div>
              <p>Everything you need to know before your first lesson with {firstName}.</p>
            </div>
            <div className={styles.faqList}>
              {profileFaqs.map((faq) => (
                <details key={faq.question} className={styles.faqItem}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.reviewsPanel}`} id="reviews">
            <header>
              <div><h2>What learners say</h2><span><IconStarFilled aria-hidden="true" /> {profile.rating} out of 5 ({profile.reviewCount} reviews)</span></div>
              <a href="#reviews">View all reviews <IconArrowRight aria-hidden="true" /></a>
            </header>
            <div className={styles.reviewGrid}>
              {profile.reviews.map((review) => (
                <article key={review.name}>
                  <div><span className={styles.reviewAvatar} aria-hidden="true">{review.name.charAt(0)}</span><span><strong>{review.name}</strong><small>{review.date}</small></span></div>
                  <span className={styles.stars} aria-label="5 out of 5 stars">★★★★★</span>
                  <p>{review.text}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className={styles.bookingCard} aria-label="Booking summary">
          <p>Lessons from</p>
          <div className={styles.bookingPrice} aria-live="polite" aria-atomic="true"><strong>{formatVnd(selectedRate.price)}</strong><span>/ {selectedMinutes} min</span><small>{selectedRate.popular ? "Popular" : "Selected"}</small></div>
          <a className={styles.primaryButton} href="#availability">View available times</a>
          <a className={styles.secondaryButton} href="#lessons">Book lesson</a>

          <div className={styles.bookingSection}>
            <h2>Lesson formats</h2>
            <ul>
              <li><IconDeviceLaptop aria-hidden="true" />Online</li>
              <li><IconHome aria-hidden="true" />At my teaching space</li>
              <li><IconMapPin aria-hidden="true" />At learner&apos;s location</li>
              <li><IconUsers aria-hidden="true" />Public place</li>
            </ul>
          </div>

          <div className={styles.bookingSection}>
            <h2>Next available</h2>
            <div className={styles.nextAvailable}><IconCalendar aria-hidden="true" /><span><strong>Today, 14:00 - 15:00</strong><small>Ha Noi time (GMT+7)</small></span></div>
            <a className={styles.inlineLink} href="#availability">View full availability <IconArrowRight aria-hidden="true" /></a>
          </div>

          <ul className={styles.trustList}>
            <li><IconShieldCheck aria-hidden="true" />Verified and ID checked tutor</li>
            <li><IconHeartHandshake aria-hidden="true" />Secure payments</li>
            <li><IconMessageCircle aria-hidden="true" />24/7 Tutoria support</li>
            <li><IconLanguage aria-hidden="true" />Lessons in {profile.languages.length} languages</li>
            <li><IconSparkles aria-hidden="true" />Personalized learning plan</li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
