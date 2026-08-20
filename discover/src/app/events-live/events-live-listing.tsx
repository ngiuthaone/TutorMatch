"use client";

import { useEffect, useState } from "react";
import { EventLiveGrid } from "@/components/discover/event-live-grid";
import styles from "./events-live-listing.module.css";

export function EventsLiveListing() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <h1 className={styles.title}>Events <em>live now.</em></h1>
            <p className={styles.lead}>Join live sessions, workshops, and gatherings from the Tutoria community. Register for free events or book paid sessions.</p>
          </div>
        </header>

        <section className={styles.gridSection}>
          <EventLiveGrid limit={12} />
        </section>
      </main>
    </div>
  );
}
