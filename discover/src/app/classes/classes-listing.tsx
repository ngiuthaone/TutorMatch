"use client";

import { ClassGrid } from "@/components/discover/class-grid";
import styles from "@/components/discover/marketplace-pages.module.css";

/**
 * Full-page class listing.
 * Fetches all published class sessions from the shared backend
 * and renders them in a responsive grid.
 */
export function ClassesListing() {
  return (
    <div className={`${styles.page} ${styles.solidBlackPage}`}>
      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <h1 className={styles.title}>
              Learn by <em>doing.</em>
            </h1>
            <p className={styles.lead}>
              Focused classes built around practice, participation, and
              real skills you can use right away.
            </p>
          </div>
        </header>

        <section aria-label="Class listings">
          <ClassGrid className={styles.workshopListingGrid} />
        </section>
      </main>
    </div>
  );
}
