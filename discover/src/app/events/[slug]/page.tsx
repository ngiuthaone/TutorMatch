import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WorkshopDataFrame } from "@/components/events/workshop-data-frame";
import { WorkshopDetailPage } from "@/components/workshop/workshop-detail-page";
import { allEvents, getEventBySlug, type EventDetail } from "@/lib/event-data";
import { getSharedEventBySlug, readSharedEvents } from "@/lib/published-event-store";
import { getApiBaseUrl, isLiveMode } from "@/lib/auth/config";
import { toWorkshopData } from "@/lib/workshop-payload";
import { computeRecommendations } from "@/lib/event-recommendations";

const live = isLiveMode();

/** Fetches the public event from the production backend. Returns null on 404/error. */
async function fetchLiveEvent(slug: string): Promise<EventDetail | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;
  try {
    const response = await fetch(`${apiBase}/api/v1/events/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!response.ok) return null; // includes 404 for unpublished/draft/unknown
    const body = (await response.json()) as EventDetail;
    if (!body || typeof body !== "object" || typeof body.title !== "string" || typeof body.slug !== "string") {
      return null;
    }
    return body;
  } catch {
    return null;
  }
}

const unwrapVnd = (price?: string | number): number => {
  if (typeof price === "number") return price;
  if (typeof price === "string") {
    const digits = price.replace(/[^0-9]/g, "");
    return digits ? Number(digits) : 0;
  }
  return 0;
};

/**
 * Builds the recommendation list for the current event by combining the
 * static event catalog with the demo shared-event store. The actual scoring,
 * filtering and sort live in `@/lib/event-recommendations` and are tested in
 * isolation. This wrapper only collects candidates.
 */
async function buildRecommendations(
  currentSlug: string,
  currentHost: string,
  currentCategory: string,
  currentTitle: string,
) {
  const candidates: EventDetail[] = [];
  const seen = new Set<string>();
  const addCandidate = (event: EventDetail | undefined) => {
    if (!event) return;
    if (seen.has(event.slug)) return;
    seen.add(event.slug);
    candidates.push(event);
  };

  for (const listing of allEvents) {
    addCandidate(getEventBySlug(listing.slug));
  }
  const shared = await readSharedEvents();
  for (const sharedEvent of shared) addCandidate(sharedEvent);

  return computeRecommendations({
    currentSlug,
    currentHost,
    currentCategory,
    currentTitle,
    candidates,
  });
}

export const dynamicParams = true;

export function generateStaticParams() {
  // In live mode the backend is authoritative and slugs are unknown ahead of
  // time, so nothing is pre-rendered and every slug is resolved on demand.
  if (live) return [];
  return allEvents.map((event) => ({ slug: event.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  // Domain is configurable via env (e.g. NEXT_PUBLIC_SITE_URL) so production
  // deployments can point canonical/OG URLs at the real host. Localhost is the
  // safe fallback during development and demo mode.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

  const baseEvent =
    live ? await fetchLiveEvent(slug) : (getEventBySlug(slug) ?? await getSharedEventBySlug(slug));

  if (!baseEvent) {
    return { title: "Event not found | Tutoria" };
  }

  const title = `${baseEvent.title} | Tutoria Events`;
  const description = `${baseEvent.subtitle} on ${baseEvent.date} at ${baseEvent.location}`;
  const coverImage = baseEvent.image || baseEvent.galleryImage;
  const canonical = `${siteUrl}/events/${baseEvent.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      ...(coverImage ? { images: [coverImage] } : {}),
      type: "website",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(coverImage ? { images: [coverImage] } : {}),
    },
  };
}

function buildJsonLd(event: EventDetail) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.date,
    location: {
      "@type": "Place",
      name: event.studioName,
      address: event.address,
    },
    image: event.image,
    description: event.subtitle,
    offers: {
      "@type": "Offer",
      price: unwrapVnd(event.price),
      priceCurrency: "VND",
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (live) {
    const event = await fetchLiveEvent(slug);
    if (!event) notFound();
    const recommendations = await buildRecommendations(
      slug,
      event.host,
      event.topic,
      event.title,
    );
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(event)).replace(/</g, "\\u003c") }}
        />
        <WorkshopDataFrame payload={toWorkshopData(event, recommendations)} />
      </>
    );
  }

  const event = getEventBySlug(slug) ?? await getSharedEventBySlug(slug);

  if (event) {
    const recommendations = await buildRecommendations(
      slug,
      event.host,
      event.topic,
      event.title,
    );
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(event)).replace(/</g, "\\u003c") }}
        />
        <WorkshopDataFrame payload={toWorkshopData(event, recommendations)} />
      </>
    );
  }

  return <WorkshopDetailPage slug={slug} />;
}
