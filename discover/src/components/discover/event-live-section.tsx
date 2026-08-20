"use client";

import { EventGrid } from "./event-live-grid";
import styles from "./discover-home.module.css";

/**
 * Event section rendered on the Discover home page.
 * Fetches real persisted events from the shared backend via EventGrid.
 */
export function EventLiveSection() {
  return (
    <section
      className={`${styles.section} ${styles.workshopSection}`}
      aria-labelledby="events-heading"
    >
      <div className="tutoria-page-container">
        <EventGrid
          heading="Events"
          viewAllHref="/events-live"
          limit={6}
        />
      </div>
    </section>
  );
}
