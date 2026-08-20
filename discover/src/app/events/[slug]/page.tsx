import type { Metadata } from "next";
import { WorkshopDetailPage } from "@/components/workshop/workshop-detail-page";
import { allEvents, getEventBySlug } from "@/lib/event-data";
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

  if (!event) return { title: "Workshop not found | Tutoria" };

  return {
    title: `${event.title} | Tutoria Workshops`,
    description: event.subtitle,
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <WorkshopDetailPage slug={slug} />;
}
