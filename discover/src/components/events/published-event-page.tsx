"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { EventDetail, EventListing } from "@/lib/event-data";
import { PUBLISHED_EVENTS_EVENT, PUBLISHED_EVENTS_KEY } from "@/lib/event-data";
import { PizzaWorkshopFrame } from "./pizza-workshop-frame";

export function PublishedEventPage({ slug, fallback }: { slug: string; fallback?: EventDetail; similarEvents: EventListing[] }) {
  const [sharedEvent, setSharedEvent] = useState<EventDetail | undefined>(fallback);
  const [sharedLoaded, setSharedLoaded] = useState(Boolean(fallback));
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
  useEffect(() => {
    let active = true;
    fetch("/api/events", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Unable to load events")))
      .then((payload: { events?: EventDetail[] }) => {
        if (!active) return;
        setSharedEvent(payload.events?.find((item) => item.slug === slug) || fallback);
      })
      .catch(() => {
        if (active) setSharedEvent(fallback);
      })
      .finally(() => {
        if (active) setSharedLoaded(true);
      });
    return () => { active = false; };
  }, [fallback, slug]);
  const event = useMemo(() => {
    try {
      const published = JSON.parse(snapshot) as EventDetail[];
      return published.find((item) => item.slug === slug) || sharedEvent || fallback;
    } catch {
      return sharedEvent || fallback;
    }
  }, [fallback, sharedEvent, slug, snapshot]);

  if (!event && !sharedLoaded) return <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "white", textAlign: "center" }}><div><h1>Loading event…</h1></div></main>;
  if (!event) return <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "white", textAlign: "center" }}><div><h1>Event not found</h1><p>This event has not been published.</p><Link href="/events">Back to events</Link></div></main>;
  return <PizzaWorkshopFrame event={event} />;
}
