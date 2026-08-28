"use client";

import { WorkshopGrid } from "./workshop-grid";
import styles from "./discover-home.module.css";

/**
 * Workshop section rendered on the Discover home page.
 * Fetches real persisted workshops from the shared backend via WorkshopGrid.
 */
export function WorkshopSection() {
  return (
    <section
      className={`${styles.section} ${styles.workshopSection}`}
      aria-labelledby="workshops-heading"
    >
      <div className="tutoria-page-container">
        <WorkshopGrid
          heading="Workshops"
          viewAllHref="/workshops"
          limit={6}
        />
      </div>
    </section>
  );
}
