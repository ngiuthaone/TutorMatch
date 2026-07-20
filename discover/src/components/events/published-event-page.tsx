"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import type { EventDetail, EventListing } from "@/lib/event-data";
import { PUBLISHED_EVENTS_EVENT, PUBLISHED_EVENTS_KEY } from "@/lib/event-data";
import { EventDetailPage } from "./event-detail-page";

export function PublishedEventPage({ slug, fallback, similarEvents }: { slug: string; fallback?: EventDetail; similarEvents: EventListing[] }) {
  const snapshot = useSyncExternalStore(
    (onChange) => {
      const onStorage = (event: StorageEvent) => { if (event.key === PUBLISHED_EVENTS_KEY) onChange(); };
      window.addEventListener(PUBLISHED_EVENTS_EVENT, onChange);
      window.addEventListener("storage", onStorage);
      return () => { window.removeEventListener(PUBLISHED_EVENTS_EVENT, onChange); window.removeEventListener("storage", onStorage); };
    },
    () => window.localStorage.getItem(PUBLISHED_EVENTS_KEY) || "[]",
    () => "[]",
  );
  const event = useMemo(() => {
    try {
      const published = JSON.parse(snapshot) as EventDetail[];
      return published.find((item) => item.slug === slug) || fallback;
    } catch {
      return fallback;
    }
  }, [fallback, slug, snapshot]);

  if (!event) return <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "white", textAlign: "center" }}><div><h1>Event not found</h1><p>This event is not available in this browser.</p><Link href="/events">Back to events</Link></div></main>;
  return <EventDetailPage event={event} similarEvents={similarEvents} />;
}
