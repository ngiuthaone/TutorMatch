import type { MetadataRoute } from "next";

import { allEvents, type EventDetail } from "@/lib/event-data";
import { readSharedEvents } from "@/lib/published-event-store";
import { getApiBaseUrl, isLiveMode } from "@/lib/auth/config";

const TOP_LEVEL_ROUTES = ["/", "/events", "/discussions", "/workshops", "/communities"] as const;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";

async function fetchPublishedEvents(apiBase: string): Promise<EventDetail[]> {
  try {
    const response = await fetch(`${apiBase}/api/v1/events`, { cache: "no-store" });
    if (!response.ok) return [];
    const body = (await response.json()) as unknown;
    if (!Array.isArray(body)) return [];
    return body.filter(
      (item): item is EventDetail =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as EventDetail).slug === "string" &&
        typeof (item as EventDetail).title === "string",
    );
  } catch {
    return [];
  }
}

function lastModifiedFor(event: { publishedAt?: string }, fallback: Date): Date {
  return event.publishedAt ? new Date(event.publishedAt) : fallback;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const topLevel: MetadataRoute.Sitemap = TOP_LEVEL_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.7,
  }));

  const events: MetadataRoute.Sitemap = [];

  if (isLiveMode()) {
    const apiBase = getApiBaseUrl();
    if (apiBase) {
      const published = await fetchPublishedEvents(apiBase);
      for (const event of published) {
        events.push({
          url: `${SITE_URL}/events/${event.slug}`,
          lastModified: lastModifiedFor(event, now),
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    }
  } else {
    const shared = await readSharedEvents();
    const staticSlugs = new Set(allEvents.map((event) => event.slug));

    for (const listing of allEvents) {
      events.push({
        url: `${SITE_URL}/events/${listing.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    // Include shared-only events (not already in the static catalog).
    for (const event of shared) {
      if (staticSlugs.has(event.slug)) continue;
      events.push({
        url: `${SITE_URL}/events/${event.slug}`,
        lastModified: lastModifiedFor(event, now),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  return [...topLevel, ...events];
}
