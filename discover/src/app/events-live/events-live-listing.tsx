"use client";

import { EventGrid } from "@/components/discover/event-live-grid";
import styles from "@/components/discover/marketplace-pages.module.css";

/**
 * Full-page event listing.
 * Fetches all published event sessions from the shared backend
 * and renders them in a responsive grid.
 */
export function EventsLiveListing() {
  return (
    <div className={`${styles.page} ${styles.solidBlackPage}`}>
      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <h1 className={styles.title}>
              Join <em>live.</em>
            </h1>
            <p className={styles.lead}>
              Attend events, workshops, and gatherings led by expert hosts.
              Connect with like-minded people and learn together.
            </p>
          </div>
        </header>

        <section aria-label="Event listings">
          <EventGrid className={styles.workshopListingGrid} />
        </section>
      </main>
    </div>
  );
}
