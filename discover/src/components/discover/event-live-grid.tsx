"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { IconClock, IconMapPin, IconUsers, IconWorld } from "@tabler/icons-react";
import type { EventOffering, EventSession, EventWithHost } from "@/lib/event-booking-api";
import {
  isFreeEvent,
  formatEventPriceVnd,
  formatDuration,
  formatDateShort,
  formatTimeShort,
} from "@/lib/event-booking-api";
import styles from "./event-live-grid.module.css";

interface EventLiveGridProps {
  limit?: number;
}

export function EventLiveGrid({ limit = 6 }: EventLiveGridProps) {
  const [events, setEvents] = useState<EventWithHost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { listBookableEvents } = await import("@/lib/event-booking-api");
        const data = await listBookableEvents();
        if (!cancelled) {
          setEvents(data.slice(0, limit));
        }
      } catch {
        // Silent fail — grid shows empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [limit]);

  if (loading) {
    return (
      <div className={styles.grid}>
        {Array.from({ length: Math.min(limit, 3) }).map((_, i) => (
          <div className={`${styles.card} ${styles.skeleton}`} key={`skeleton-${i}`}>
            <div className={styles.imageSkeleton} />
            <div className={styles.bodySkeleton}>
              <div className={styles.lineShort} />
              <div className={styles.lineLong} />
              <div className={styles.lineMedium} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div className={styles.grid}>
      {events.map(({ offering, sessions, hostDisplayName }) => {
        const free = isFreeEvent(offering);
        const priceLabel = formatEventPriceVnd(offering);
        const totalSpots = sessions.reduce((s, session) => s + session.spotsLeft, 0);
        const nextSession = [...sessions]
          .filter((s) => s.status === "scheduled" && new Date(s.startsAt) > new Date())
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

        return (
          <Link className={styles.card} href={`/events-live/${offering.id}`} key={offering.id}>
            <div className={styles.imageWrap}>
              <Image
                src={`https://picsum.photos/seed/event-${offering.id}/680/430`}
                alt={offering.title}
                fill
                sizes="(max-width: 600px) 100vw, 33vw"
                unoptimized
              />
              <span className={styles.formatBadge}>
                <IconWorld size={12} /> Online
              </span>
              {free && <span className={styles.freeBadge}>Free</span>}
            </div>
            <div className={styles.body}>
              <p className={styles.host}>{hostDisplayName}</p>
              <h3 className={styles.title}>{offering.title}</h3>
              {nextSession && (
                <div className={styles.meta}>
                  <span><IconClock size={14} /> {formatDateShort(nextSession.startsAt)} · {formatTimeShort(nextSession.startsAt)}</span>
                  <span><IconUsers size={14} /> {totalSpots} spots left</span>
                </div>
              )}
              <div className={styles.priceRow}>
                <span className={`${styles.price} ${free ? styles.freePrice : ""}`}>{priceLabel}</span>
                {!free && <span className={styles.perPerson}>/ participant</span>}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
