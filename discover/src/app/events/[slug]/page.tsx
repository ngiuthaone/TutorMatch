import type { Metadata } from "next";
import { PublishedEventPage } from "@/components/events/published-event-page";
import { allEvents, getEventBySlug, getSimilarEvents } from "@/lib/event-data";
import { getSharedEventBySlug } from "@/lib/published-event-store";

export const dynamicParams = true;

export function generateStaticParams() {
  return allEvents.map((event) => ({ slug: event.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = getEventBySlug(slug) ?? await getSharedEventBySlug(slug);

  if (!event) return { title: "Event not found | Tutoria" };

  return {
    title: `${event.title} | Tutoria Events`,
    description: event.subtitle,
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = getEventBySlug(slug) ?? await getSharedEventBySlug(slug);

  return <PublishedEventPage slug={slug} fallback={event} similarEvents={getSimilarEvents(slug)} />;
}
