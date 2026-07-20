"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
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
import { formatVnd, getTutorProfile, type TutorProfile } from "./tutor-profile-data";
import styles from "./tutor-profile-redesign.module.css";

const availability = [
  { time: "09:00 - 12:00", days: [true, true, true, true, true, false, false] },
  { time: "14:00 - 18:00", days: [true, true, true, true, true, true, false] },
  { time: "18:00 - 21:00", days: [true, true, true, true, false, false, false] },
];

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const lessonFormats = [
  { value: "Online", icon: IconDeviceLaptop, title: "Online", detail: "Live video lessons with screen sharing and feedback." },
  { value: "At my teaching space", icon: IconHome, title: "At my teaching space", detail: "A prepared space with the tools needed for the lesson." },
  { value: "At learners' location", icon: IconMapPin, title: "At your location", detail: "Available in central Ha Noi when the lesson allows it." },
  { value: "Public place", icon: IconUsers, title: "Public place", detail: "Libraries, studios, cafes, or community spaces." },
];

const profileFaqs = [
  { question: "How do I book a lesson with this tutor?", answer: "Choose a lesson length, then select an available time. Your booking is confirmed once the tutor accepts it." },
  { question: "Can I reschedule a booked lesson?", answer: "Yes. You can reschedule from your bookings area, subject to the cancellation notice shown above." },
  { question: "What should I prepare for my first lesson?", answer: "Bring your goal, any relevant materials, and a few examples of what you would like to learn. Your tutor will tailor the first session from there." },
  { question: "How are lessons paid for?", answer: "Payments are made securely through Tutoria when you book. The lesson price and any first-session offer are shown before you confirm." },
];

type SubmittedTutorFaq = { id?: string; question?: string; answer?: string };
type TutorSubmission = {
  status?: string;
  displayName?: string;
  role?: string;
  headline?: string;
  about?: string;
  photoUrl?: string | null;
  languages?: string[];
  skills?: string[];
  learnerLevels?: string[];
  ageGroups?: string[];
  goals?: string[];
  teachingStyles?: string[];
  lessonDescription?: string;
  lessonFormat?: string;
  sessionLengths?: number[];
  timeSlots?: string[];
  availability?: string[];
  rates?: Record<string, number>;
  consultationEnabled?: boolean;
  consultationDuration?: string;
  consultationPrice?: string;
  consultationPurpose?: string;
  faqs?: SubmittedTutorFaq[];
};

type SubmittedTutorProfile = {
  profile: TutorProfile;
  faqs: { question: string; answer: string }[];
  lessonFormat: string;
  availability: string[];
  timeSlots: string[];
  rates: Record<string, number>;
  sessionLengths: number[];
  consultation: { enabled: boolean; duration: string; price: string; purpose: string };
};
const TUTOR_SUBMISSION_KEY = "tutoria_tutor_profile_submission";

function makeSubmittedTutorProfile(submission: TutorSubmission): SubmittedTutorProfile | null {
  if (submission.status !== "pending_review" || !submission.displayName?.trim()) return null;
  const sessionLength = submission.sessionLengths?.includes(60) ? 60 : submission.sessionLengths?.[0];
  const subjects = submission.skills?.filter(Boolean) ?? [];
  const faqs = submission.faqs?.filter((faq): faq is { question: string; answer: string } => Boolean(faq.question?.trim() && faq.answer?.trim())).map(({ question, answer }) => ({ question, answer })) ?? [];
  return {
    profile: {
      name: submission.displayName.trim(),
      role: submission.role?.trim() || (subjects[0] ? `${subjects[0]} tutor` : "Independent tutor"),
      tagline: submission.headline?.trim() || "A new tutor on Tutoria.",
      image: submission.photoUrl || "/images/tutor-profile-thu-ha.png",
      rating: 0,
      reviewCount: 0,
      lessons: 0,
      responseTime: "New to Tutoria",
      location: "Ha Noi, Vietnam",
      price: sessionLength ? submission.rates?.[String(sessionLength)] || 0 : 0,
      languages: submission.languages?.filter(Boolean) ?? ["Vietnamese"],
      subjects: subjects.length ? subjects : ["Tutoring"],
      about: submission.about?.trim() ? [submission.about.trim()] : ["This tutor has just joined Tutoria and is preparing to welcome new learners."],
      learnerLevels: submission.learnerLevels?.filter(Boolean) ?? ["All learner levels"],
      ageGroups: submission.ageGroups?.filter(Boolean) ?? ["Adults"],
      teachingStyles: submission.teachingStyles?.filter(Boolean) ?? ["Personalized feedback"],
      outcomes: submission.goals?.filter(Boolean) ?? ["Build confidence through focused practice"],
      typicalLesson: submission.lessonDescription?.trim() || "Each lesson is tailored to the learner’s goal, pace, and experience.",
      reviews: [],
    },
    faqs,
    lessonFormat: submission.lessonFormat || "Online",
    availability: submission.availability ?? [],
    timeSlots: submission.timeSlots?.filter((slot) => /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(slot)) ?? ["09:00-12:00", "14:00-18:00", "18:00-21:00"],
    rates: submission.rates ?? {},
    sessionLengths: submission.sessionLengths ?? [],
    consultation: {
      enabled: Boolean(submission.consultationEnabled),
      duration: submission.consultationDuration || "15 minutes",
      price: submission.consultationPrice || "Free",
      purpose: submission.consultationPurpose?.trim() || "Discuss goals and compatibility.",
    },
  };
}

export function ProfileReplacement({ name }: { name?: string }) {
  const [submittedTutor, setSubmittedTutor] = useState<SubmittedTutorProfile | null>(null);
  useEffect(() => {
    try {
      const savedSubmission = JSON.parse(window.localStorage.getItem(TUTOR_SUBMISSION_KEY) || "null") as TutorSubmission | null;
      const nextTutor = savedSubmission ? makeSubmittedTutorProfile(savedSubmission) : null;
      const matchingTutor = nextTutor?.profile.name === name ? nextTutor : null;
      const frame = window.requestAnimationFrame(() => setSubmittedTutor(matchingTutor));
      return () => window.cancelAnimationFrame(frame);
    } catch {
      window.localStorage.removeItem(TUTOR_SUBMISSION_KEY);
    }
  }, [name]);
  const profile = submittedTutor?.profile ?? getTutorProfile(name);
  const faqs = submittedTutor?.faqs.length ? submittedTutor.faqs : profileFaqs;
  const isNewTutor = profile.reviewCount === 0;
  const firstName = profile.name.split(" ")[0];
  const defaultRateOptions = [
    { minutes: 30, price: Math.round(profile.price * 0.6 / 10000) * 10000 },
    { minutes: 50, price: Math.round(profile.price * 0.85 / 10000) * 10000 },
    { minutes: 60, price: profile.price, popular: true },
    { minutes: 90, price: Math.round(profile.price * 1.4 / 10000) * 10000 },
  ];
  const rateOptions = submittedTutor?.sessionLengths.length ? submittedTutor.sessionLengths.map((minutes) => ({ minutes, price: submittedTutor.rates[String(minutes)] || 0, popular: minutes === 60 })) : defaultRateOptions;
  const submittedLessonFormats = submittedTutor ? lessonFormats.filter((format) => format.value === submittedTutor.lessonFormat) : [];
  const displayedLessonFormats = submittedLessonFormats.length ? submittedLessonFormats : lessonFormats;
  const scheduleRows = submittedTutor?.timeSlots.length ? submittedTutor.timeSlots.map((time) => ({ time: time.replace("-", " - "), days: Array.from({ length: weekDays.length }, () => false) })) : availability;
  const scheduleAvailability = submittedTutor ? scheduleRows.map((row) => ({ ...row, days: row.days.map((_, index) => submittedTutor.availability.includes(`${row.time.replace(/\s/g, "")}-${index}`)) })) : availability;
  const firstAvailableSlot = scheduleAvailability.flatMap((row) => row.days.map((isAvailable, index) => isAvailable ? { day: weekDays[index], time: row.time } : null)).find((slot): slot is { day: string; time: string } => slot !== null);
  const nextAvailableLabel = firstAvailableSlot ? `${firstAvailableSlot.day}, ${firstAvailableSlot.time}` : "No times set";
  const [selectedMinutes, setSelectedMinutes] = useState(60);
  const selectedRate = rateOptions.find((rate) => rate.minutes === selectedMinutes) ?? rateOptions[0];
  const selectedFirstLessonPrice = Math.round(selectedRate.price * 0.88 / 5000) * 5000;
  const consultationPrice = Math.round(profile.price * 0.4 / 10000) * 10000;
  const consultation = submittedTutor?.consultation;

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
                {isNewTutor ? <span><IconRosetteDiscountCheck aria-hidden="true" /> New tutor profile</span> : <><span><IconRosetteDiscountCheck aria-hidden="true" /> Verified tutor</span><span><IconIdBadge2 aria-hidden="true" /> ID verified</span></>}
              </div>

              <div className={styles.nameRow}>
                <h1 id="profile-name">{profile.name}</h1>
                <span className={styles.rating}>{isNewTutor ? "New tutor" : <><IconStarFilled aria-hidden="true" /> {profile.rating} <small>({profile.reviewCount} reviews)</small></>}</span>
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
              <h2>Who I teach</h2>
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
              {displayedLessonFormats.map(({ icon: Icon, title, detail }) => (
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
                {scheduleAvailability.map((row) => (
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

            {(!consultation || consultation.enabled) && <section className={`${styles.panel} ${styles.consultation}`}>
              <h2>Short consultation</h2>
              <p>{consultation?.purpose || "Ask a focused question or see if the tutor is right for your goal."}</p>
              <div><span><IconClock aria-hidden="true" />{consultation?.duration || "20 minutes"}</span><strong>{consultation?.price || formatVnd(consultationPrice)}</strong></div>
              <ul>
                <li>Get quick feedback or guidance</li>
                <li>Discuss goals, materials, or project ideas</li>
                <li>Useful for new learners</li>
              </ul>
              <a className={styles.primaryButton} href="#availability">Choose a time</a>
            </section>}
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
              {faqs.map((faq) => (
                <details key={faq.question} className={styles.faqItem}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.reviewsPanel}`} id="reviews">
            <header>
              <div><h2>What learners say</h2><span>{isNewTutor ? "Be the first to book a lesson" : <><IconStarFilled aria-hidden="true" /> {profile.rating} out of 5 ({profile.reviewCount} reviews)</>}</span></div>
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
              {displayedLessonFormats.map(({ icon: Icon, title }) => <li key={title}><Icon aria-hidden="true" />{title}</li>)}
            </ul>
          </div>

          <div className={styles.bookingSection}>
            <h2>Next available</h2>
            <div className={styles.nextAvailable}><IconCalendar aria-hidden="true" /><span><strong>{nextAvailableLabel}</strong><small>Ha Noi time (GMT+7)</small></span></div>
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
