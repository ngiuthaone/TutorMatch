"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconArrowUpRight,
  IconClock,
  IconUsers,
} from "@tabler/icons-react";
import {
  listBookableSessions,
  type BookableSession,
} from "@/lib/booking-api";
import { sortFutureBookableSessions } from "@/lib/bookable-session-projection";
import styles from "./workshop-grid.module.css";

/* ── Helpers ── */

function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)} \u0111`;
}

function durationLabel(startsAt: string, endsAt: string): string {
  const ms = Date.parse(endsAt) - Date.parse(startsAt);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatSessionDate(startsAt: string): string {
  return new Date(startsAt).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatSessionTime(startsAt: string): string {
  return new Date(startsAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/* ── Single card ── */

function WorkshopCard({ session }: { session: BookableSession }) {
  const title = session.offering?.title ?? "Workshop";
  const hostName = session.host?.displayName ?? "Host";
  const unitPrice = session.unitPriceVnd ?? null;
  const isFree = unitPrice === 0;
  const isUnknownPrice = unitPrice === null;
  const duration = durationLabel(session.startsAt, session.endsAt);
  const spotsLeft = session.spotsLeft;
  const nextDate = formatSessionDate(session.startsAt);
  const nextTime = formatSessionTime(session.startsAt);

  const slug = session.offering?.id ?? session.id;
  const href = `/workshops/${encodeURIComponent(slug)}`;

  return (
    <Link href={href} className={styles.card}>
      <span className={styles.cardBody}>
        <span className={styles.cardKicker}>{hostName}</span>
        <h3 className={styles.cardTitle}>{title}</h3>

        <span className={styles.cardMeta}>
          {duration && (
            <span>
              <IconClock size={14} aria-hidden="true" /> {duration}
            </span>
          )}
          {spotsLeft != null && (
            <span>
              <IconUsers size={14} aria-hidden="true" />{" "}
              {spotsLeft > 0 ? `${spotsLeft} left` : "Full"}
            </span>
          )}
        </span>

        <span className={styles.cardSchedule}>
          {nextDate} · {nextTime}
        </span>
      </span>

      <span className={styles.cardFooter}>
        <span className={styles.cardPrice}>
          {isFree ? "Free" : isUnknownPrice ? "\u2014" : formatVnd(unitPrice)}
          {!isFree && !isUnknownPrice && (
            <span className={styles.cardUnit}>/ person</span>
          )}
        </span>
        <IconArrowUpRight size={17} className={styles.cardArrow} aria-hidden="true" />
      </span>
    </Link>
  );
}

/* ── Loading skeleton ── */

function CardSkeleton() {
  return (
    <div className={`${styles.card} ${styles.cardSkeleton}`} aria-hidden="true">
      <span className={styles.cardBody}>
        <span className={styles.skeletonLine} style={{ width: "40%", height: 10 }} />
        <span className={styles.skeletonLine} style={{ width: "80%", height: 18, marginTop: 10 }} />
        <span className={styles.skeletonLine} style={{ width: "55%", height: 12, marginTop: 14 }} />
        <span className={styles.skeletonLine} style={{ width: "45%", height: 12, marginTop: 8 }} />
      </span>
      <span className={styles.cardFooter}>
        <span className={styles.skeletonLine} style={{ width: "35%", height: 14 }} />
      </span>
    </div>
  );
}

/* ── Main grid ── */

interface WorkshopGridProps {
  /** Maximum number of cards to display. Shows all when omitted. */
  limit?: number;
  /** Optional label shown above the grid (e.g. "Workshops"). */
  heading?: string;
  /** Link target for the "View all" link. Omit to hide the link. */
  viewAllHref?: string;
  /** Additional CSS class on the wrapper. */
  className?: string;
}

export function WorkshopGrid({
  limit,
  heading,
  viewAllHref,
  className,
}: WorkshopGridProps) {
  const [sessions, setSessions] = useState<BookableSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await listBookableSessions({ kind: "workshop" });
        if (!active) return;
        setSessions(sortFutureBookableSessions(raw));
      } catch {
        if (active) setError("Unable to load workshops.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const visibleSessions = useMemo(
    () => (limit ? sessions.slice(0, limit) : sessions),
    [sessions, limit],
  );

  return (
    <div className={className}>
      {heading && (
        <div className={styles.gridHeader}>
          <h2 className={styles.gridTitle}>{heading}</h2>
          {viewAllHref && sessions.length > 0 && (
            <Link href={viewAllHref} className={styles.viewAllLink}>
              View all <IconArrowUpRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      {loading && (
        <div className={styles.grid}>
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className={styles.emptyState}>{error}</p>
      )}

      {!loading && !error && visibleSessions.length === 0 && (
        <p className={styles.emptyState}>
          No workshops are available right now. Check back soon.
        </p>
      )}

      {!loading && !error && visibleSessions.length > 0 && (
        <div className={styles.grid}>
          {visibleSessions.map((session) => (
            <WorkshopCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
