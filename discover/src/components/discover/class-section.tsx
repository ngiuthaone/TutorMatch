"use client";

import { ClassGrid } from "./class-grid";
import styles from "./discover-home.module.css";

/**
 * Class section rendered on the Discover home page.
 * Fetches real persisted classes from the shared backend via ClassGrid.
 */
export function ClassSection() {
  return (
    <section
      className={`${styles.section} ${styles.workshopSection}`}
      aria-labelledby="classes-heading"
    >
      <div className="tutoria-page-container">
        <ClassGrid
          heading="Classes"
          viewAllHref="/classes"
          limit={6}
        />
      </div>
    </section>
  );
}
