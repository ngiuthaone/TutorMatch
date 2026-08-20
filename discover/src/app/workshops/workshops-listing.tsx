"use client";

import { WorkshopGrid } from "@/components/discover/workshop-grid";
import styles from "@/components/discover/marketplace-pages.module.css";

/**
 * Full-page workshop listing.
 * Fetches all published workshop sessions from the shared backend
 * and renders them in a responsive grid.
 */
export function WorkshopsListing() {
  return (
    <div className={`${styles.page} ${styles.solidBlackPage}`}>
      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <h1 className={styles.title}>
              Learn by <em>doing.</em>
            </h1>
            <p className={styles.lead}>
              Hands-on sessions built around practice, participation, and
              real skills you can use right away.
            </p>
          </div>
        </header>

        <section aria-label="Workshop listings">
          <WorkshopGrid className={styles.workshopListingGrid} />
        </section>
      </main>
    </div>
  );
}
