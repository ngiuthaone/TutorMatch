"use client";

import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { EventLiveGrid } from "./event-live-grid";
import styles from "./discover-home.module.css";

export function EventLiveSection() {
  return (
    <section className={`${styles.section}`} aria-labelledby="event-live-heading">
      <div className="tutoria-page-container">
        <header className={styles.sectionHeader}>
          <div>
            <h2 id="event-live-heading">Upcoming events</h2>
            <p className={styles.sectionSubheading}>Live sessions, workshops, and gatherings from the Tutoria community.</p>
          </div>
          <Link className={`${styles.sectionLink} tutoria-text-link`} href="/events-live">
            View all events <IconArrowRight size={16} />
          </Link>
        </header>
        <EventLiveGrid limit={6} />
      </div>
    </section>
  );
}
