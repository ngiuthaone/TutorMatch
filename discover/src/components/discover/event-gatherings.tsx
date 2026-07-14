"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconClock,
  IconMapPin,
  IconUsers,
} from "@tabler/icons-react";

import styles from "./discover-home.module.css";

const ROTATION_INTERVAL = 4800;

const events = [
  {
    date: "19",
    month: "JUL",
    title: "Beginner pottery workshop",
    location: "Tay Ho, Ha Noi",
    time: "2:00 PM",
    host: "Hosted by Thu Ha",
    format: "Hands-on workshop",
    attendance: "12 of 16 seats",
    description: "Shape your first ceramic cup in a small, relaxed studio session made for complete beginners.",
    image: "https://picsum.photos/seed/tutoria-pottery-room/1400/1100",
  },
  {
    date: "22",
    month: "JUL",
    title: "IELTS speaking circle",
    location: "Online",
    time: "10:00 AM",
    host: "Hosted by Linh Nguyen",
    format: "Live practice room",
    attendance: "8 learners joined",
    description: "Practice real speaking prompts with thoughtful feedback and a friendly group of fellow learners.",
    image: "https://picsum.photos/seed/tutoria-speaking-circle/1400/1100",
  },
  {
    date: "24",
    month: "JUL",
    title: "Startup networking night",
    location: "Hoan Kiem, Ha Noi",
    time: "6:30 PM",
    host: "Hosted by Bao Long",
    format: "Community meetup",
    attendance: "45 attending",
    description: "Meet local builders, trade honest lessons, and find the people who can help move your idea forward.",
    image: "https://picsum.photos/seed/tutoria-startup-night/1400/1100",
  },
  {
    date: "26",
    month: "JUL",
    title: "Street photography walk",
    location: "Old Quarter, Ha Noi",
    time: "4:30 PM",
    host: "Hosted by Duc Pham",
    format: "Photo walk",
    attendance: "14 photographers",
    description: "Read the afternoon light, frame candid moments, and compare photographs over coffee afterward.",
    image: "https://picsum.photos/seed/tutoria-photo-walk/1400/1100",
  },
  {
    date: "28",
    month: "JUL",
    title: "Build your first portfolio",
    location: "Online",
    time: "7:00 PM",
    host: "Hosted by Huy Tran",
    format: "Live workshop",
    attendance: "21 learners joined",
    description: "Turn unfinished work into a clear portfolio story with practical guidance and live peer critique.",
    image: "https://picsum.photos/seed/tutoria-portfolio-workshop/1400/1100",
  },
];

export function EventGatherings() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const interactionIndex = focusedIndex ?? hoveredIndex;
  const selectedIndex = interactionIndex ?? activeIndex;
  const selectedEvent = events[selectedIndex];

  useEffect(() => {
    if (interactionIndex !== null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % events.length);
    }, ROTATION_INTERVAL);

    return () => window.clearInterval(timer);
  }, [interactionIndex]);

  const activateEvent = (index: number) => {
    setActiveIndex(index);
    return index;
  };

  return (
    <section className={`${styles.section} ${styles.gatherSection}`} aria-labelledby="gather-heading">
      <div className={`${styles.gatherInner} tutoria-page-container`}>
        <div className={styles.gatherVisual}>
          {events.map((event, index) => (
            <Image
              key={event.title}
              className={`${styles.eventBackdrop} ${index === selectedIndex ? styles.eventBackdropActive : ""}`}
              src={event.image}
              alt=""
              fill
              sizes="(max-width: 1000px) 100vw, 57vw"
              unoptimized
              aria-hidden="true"
            />
          ))}
          <span className={`${styles.imageShade} ${styles.eventPreviewShade}`} aria-hidden="true" />
          <span className={styles.previewCounter} aria-hidden="true">
            <strong>{String(selectedIndex + 1).padStart(2, "0")}</strong>
            <span>/</span>
            <span>{String(events.length).padStart(2, "0")}</span>
          </span>
          <div className={styles.eventPreview} key={selectedEvent.title}>
            <p className="tutoria-kicker">{selectedEvent.date} {selectedEvent.month} · {selectedEvent.format}</p>
            <h2 id="gather-heading">{selectedEvent.title}</h2>
            <p className={styles.eventPreviewDescription}>{selectedEvent.description}</p>
            <div className={styles.eventPreviewMeta}>
              <span><IconClock size={16} aria-hidden="true" /> {selectedEvent.time}</span>
              <span><IconMapPin size={16} aria-hidden="true" /> {selectedEvent.location}</span>
              <span><IconUsers size={16} aria-hidden="true" /> {selectedEvent.attendance}</span>
            </div>
            <p className={styles.eventPreviewHost}>{selectedEvent.host}</p>
            <Link className={`${styles.sectionLink} ${styles.eventPreviewLink} tutoria-text-link`} href="/events">
              View event <IconArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className={`${styles.agenda} tutoria-glass`}>
          <div className={styles.agendaHeading}>
            <div>
              <small>This week on Tutoria</small>
              <strong>Gatherings worth showing up for</strong>
            </div>
            <Link href="/events" aria-label="View all events"><IconArrowUpRight size={20} /></Link>
          </div>
          <div
            className={styles.eventList}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {events.map((event, index) => {
              const isActive = index === selectedIndex;
              return (
                <Link
                  href="/events"
                  key={event.title}
                  className={isActive ? styles.eventRowActive : undefined}
                  aria-current={isActive ? "true" : undefined}
                  onMouseEnter={() => setHoveredIndex(activateEvent(index))}
                  onFocus={() => setFocusedIndex(activateEvent(index))}
                  onBlur={() => setFocusedIndex(null)}
                >
                  <span className={styles.dateBlock}><strong>{event.date}</strong><small>{event.month}</small></span>
                  <span className={styles.eventCopy}>
                    <strong>{event.title}</strong>
                    <span className={styles.eventLocation}><IconMapPin size={14} aria-hidden="true" /> {event.location}</span>
                    <span className={styles.eventDetails}>
                      <span>{event.host}</span>
                      <span>{event.format}</span>
                      <span><IconUsers size={13} aria-hidden="true" /> {event.attendance}</span>
                    </span>
                  </span>
                  <span className={styles.eventTime}>{event.time}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
